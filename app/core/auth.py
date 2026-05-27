from dataclasses import dataclass

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import settings
from app.services.supabase_client import supabase

bearer = HTTPBearer(auto_error=True)


@dataclass(frozen=True)
class AuthenticatedUser:
    user_id: str


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
    authenticated_user = await get_authenticated_user(credentials)
    user_id = authenticated_user.user_id

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


async def get_authenticated_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> AuthenticatedUser:
    token = credentials.credentials
    try:
        payload = _decode_supabase_jwt(token)
    except HTTPException:
        payload = await _fetch_supabase_user(token)

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing user id")
    return AuthenticatedUser(user_id=user_id)


async def _fetch_supabase_user(token: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(
                f"{settings.supabase_url}/auth/v1/user",
                headers={
                    "apikey": settings.supabase_service_role_key,
                    "Authorization": f"Bearer {token}",
                },
            )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        ) from exc

    if response.status_code != status.HTTP_200_OK:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )

    data = response.json()
    return {"sub": data.get("id")}
