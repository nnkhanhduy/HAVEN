from datetime import UTC, datetime, timedelta
from uuid import uuid4

from fastapi import HTTPException, status

from app.core.auth import AuthenticatedUser
from app.models.schemas import (
    CreateCoupleRequest,
    CreateCoupleResponse,
    InviteResponse,
    JoinCoupleRequest,
    ProfileResponse,
)
from app.services.supabase_client import supabase


class OnboardingService:
    def get_profile(self, user: AuthenticatedUser) -> ProfileResponse | None:
        result = (
            supabase.table("profiles")
            .select("user_id,couple_id,display_name,role")
            .eq("user_id", user.user_id)
            .limit(1)
            .execute()
        )
        if not result.data:
            return None
        return ProfileResponse(**result.data[0])

    def create_couple(
        self,
        user: AuthenticatedUser,
        payload: CreateCoupleRequest,
    ) -> CreateCoupleResponse:
        existing_profile = self.get_profile(user)
        if existing_profile:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User already belongs to a couple",
            )

        couple_row = {"partner_1_id": user.user_id, "anniversary_date": payload.anniversary_date}
        couple_result = supabase.table("couples").insert(couple_row).execute()
        if not couple_result.data:
            raise HTTPException(status_code=500, detail="Could not create couple")

        couple_id = couple_result.data[0]["id"]
        profile = self._create_profile(
            user_id=user.user_id,
            couple_id=couple_id,
            display_name=payload.display_name,
            role=payload.role,
        )
        return CreateCoupleResponse(couple_id=couple_id, profile=ProfileResponse(**profile))

    def create_invite(self, user: AuthenticatedUser) -> InviteResponse:
        profile = self.get_profile(user)
        if not profile:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Profile not found")

        code = uuid4().hex[:10].upper()
        expires_at = (datetime.now(UTC) + timedelta(days=7)).isoformat()
        row = {
            "couple_id": profile.couple_id,
            "created_by_user_id": user.user_id,
            "code": code,
            "expires_at": expires_at,
        }
        result = supabase.table("couple_invites").insert(row).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Could not create invite")
        return InviteResponse(code=code, couple_id=profile.couple_id, expires_at=expires_at)

    def join_couple(
        self,
        user: AuthenticatedUser,
        payload: JoinCoupleRequest,
    ) -> ProfileResponse:
        existing_profile = self.get_profile(user)
        if existing_profile:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User already belongs to a couple",
            )

        invite = self._get_active_invite(payload.code)
        profile = self._create_profile(
            user_id=user.user_id,
            couple_id=invite["couple_id"],
            display_name=payload.display_name,
            role=payload.role,
        )
        self._mark_invite_accepted(invite["id"], user.user_id)
        self._fill_second_partner(invite["couple_id"], user.user_id)
        return ProfileResponse(**profile)

    def _create_profile(
        self,
        user_id: str,
        couple_id: str,
        display_name: str | None,
        role: str,
    ) -> dict:
        result = (
            supabase.table("profiles")
            .insert(
                {
                    "user_id": user_id,
                    "couple_id": couple_id,
                    "display_name": display_name,
                    "role": role,
                }
            )
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=500, detail="Could not create profile")
        return result.data[0]

    def _get_active_invite(self, code: str) -> dict:
        result = (
            supabase.table("couple_invites")
            .select("id,couple_id,expires_at,accepted_by_user_id")
            .eq("code", code.upper())
            .limit(1)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")

        invite = result.data[0]
        if invite.get("accepted_by_user_id"):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invite already used")
        expires_at = invite.get("expires_at")
        if expires_at and datetime.fromisoformat(expires_at.replace("Z", "+00:00")) < datetime.now(UTC):
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="Invite expired")
        return invite

    def _mark_invite_accepted(self, invite_id: str, user_id: str) -> None:
        supabase.table("couple_invites").update(
            {"accepted_by_user_id": user_id, "accepted_at": datetime.now(UTC).isoformat()}
        ).eq("id", invite_id).execute()

    def _fill_second_partner(self, couple_id: str, user_id: str) -> None:
        supabase.table("couples").update({"partner_2_id": user_id}).eq("id", couple_id).is_(
            "partner_2_id", "null"
        ).execute()


onboarding = OnboardingService()
