from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import settings
from app.services.supabase_client import supabase

bearer = HTTPBearer(auto_error=True)


@dataclass(frozen=True)
class CurrentUser:
    user_id: str
    couple_id: str
    display_name: str | None = None
    role: str | None = None


def _decode_supabase_jwt(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        ) from exc


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> CurrentUser:
    payload = _decode_supabase_jwt(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing user id")

    profile_result = (
        supabase.table("profiles")
        .select("user_id,couple_id,display_name,role")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not profile_result.data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Profile not found")

    profile = profile_result.data[0]
    return CurrentUser(
        user_id=profile["user_id"],
        couple_id=profile["couple_id"],
        display_name=profile.get("display_name"),
        role=profile.get("role"),
    )
