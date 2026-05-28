from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status

from app.core.auth import CurrentUser
from app.models.schemas import (
    ImportantDateCreate,
    ImportantDateUpdate,
    LoveMapMemory,
    PreferenceCreate,
    PreferenceUpdate,
    WishlistItemCreate,
    WishlistItemUpdate,
)
from app.core.config import settings
from app.services.supabase_client import supabase


class CoupleWikiService:
    def list_preferences(self, user: CurrentUser) -> list[dict[str, Any]]:
        result = (
            supabase.table("preferences")
            .select("id,user_id,category,detail_json,updated_at")
            .eq("couple_id", user.couple_id)
            .order("category")
            .execute()
        )
        return result.data or []

    def create_preference(self, user: CurrentUser, payload: PreferenceCreate) -> dict[str, Any]:
        row = {
            "couple_id": user.couple_id,
            "user_id": payload.user_id or user.user_id,
            "category": payload.category,
            "detail_json": payload.detail_json,
        }
        return self._insert_row("preferences", row)

    def update_preference(
        self,
        user: CurrentUser,
        preference_id: str,
        payload: PreferenceUpdate,
    ) -> dict[str, Any]:
        updates = payload.model_dump(exclude_unset=True)
        if not updates:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
        updates["updated_at"] = self._now()
        return self._update_couple_row("preferences", preference_id, user.couple_id, updates)

    def delete_preference(self, user: CurrentUser, preference_id: str) -> dict[str, str]:
        self._delete_couple_row("preferences", preference_id, user.couple_id)
        return {"status": "deleted"}

    def list_wishlist(self, user: CurrentUser) -> list[dict[str, Any]]:
        result = (
            supabase.table("wishlist_items")
            .select(
                "id,title,description,category,target_for_user_id,status,metadata,created_at,updated_at"
            )
            .eq("couple_id", user.couple_id)
            .order("created_at", desc=True)
            .execute()
        )
        return result.data or []

    def create_wishlist_item(self, user: CurrentUser, payload: WishlistItemCreate) -> dict[str, Any]:
        row = {
            "couple_id": user.couple_id,
            "created_by_user_id": user.user_id,
            "target_for_user_id": payload.target_for_user_id,
            "title": payload.title,
            "description": payload.description,
            "category": payload.category,
            "status": payload.status,
            "metadata": payload.metadata,
        }
        return self._insert_row("wishlist_items", row)

    def update_wishlist_item(
        self,
        user: CurrentUser,
        item_id: str,
        payload: WishlistItemUpdate,
    ) -> dict[str, Any]:
        updates = payload.model_dump(exclude_unset=True)
        if not updates:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
        updates["updated_at"] = self._now()
        return self._update_couple_row("wishlist_items", item_id, user.couple_id, updates)

    def delete_wishlist_item(self, user: CurrentUser, item_id: str) -> dict[str, str]:
        self._delete_couple_row("wishlist_items", item_id, user.couple_id)
        return {"status": "deleted"}

    def list_important_dates(self, user: CurrentUser) -> list[dict[str, Any]]:
        result = (
            supabase.table("important_dates")
            .select("id,title,date_value,date_type,notes,metadata,created_at,updated_at")
            .eq("couple_id", user.couple_id)
            .order("date_value")
            .execute()
        )
        return result.data or []

    def create_important_date(self, user: CurrentUser, payload: ImportantDateCreate) -> dict[str, Any]:
        row = {
            "couple_id": user.couple_id,
            "title": payload.title,
            "date_value": payload.date_value,
            "date_type": payload.date_type,
            "notes": payload.notes,
            "metadata": payload.metadata,
        }
        return self._insert_row("important_dates", row)

    def update_important_date(
        self,
        user: CurrentUser,
        date_id: str,
        payload: ImportantDateUpdate,
    ) -> dict[str, Any]:
        updates = payload.model_dump(exclude_unset=True)
        if not updates:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
        updates["updated_at"] = self._now()
        return self._update_couple_row("important_dates", date_id, user.couple_id, updates)

    def delete_important_date(self, user: CurrentUser, date_id: str) -> dict[str, str]:
        self._delete_couple_row("important_dates", date_id, user.couple_id)
        return {"status": "deleted"}

    def love_map(self, user: CurrentUser) -> list[LoveMapMemory]:
        result = (
            supabase.table("memories")
            .select(
                "id,content,memory_type,image_url,location,place_name,latitude,longitude,"
                "location_note,sentiment,timestamp"
            )
            .eq("couple_id", user.couple_id)
            .order("timestamp", desc=True)
            .execute()
        )
        map_items = [
            item
            for item in result.data or []
            if item.get("latitude") is not None or item.get("location") or item.get("place_name")
        ]
        return [LoveMapMemory(**self._with_signed_image_url(item)) for item in map_items]

    def _with_signed_image_url(self, memory: dict[str, Any]) -> dict[str, Any]:
        image_path = memory.get("image_url")
        memory["image_signed_url"] = None
        if not image_path:
            return memory
        signed = supabase.storage.from_(settings.supabase_memory_bucket).create_signed_url(image_path, 3600)
        memory["image_signed_url"] = signed.get("signedURL") or signed.get("signedUrl")
        return memory

    def _insert_row(self, table: str, row: dict[str, Any]) -> dict[str, Any]:
        result = supabase.table(table).insert(row).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail=f"Could not create {table} row")
        return result.data[0]

    def _update_couple_row(
        self,
        table: str,
        row_id: str,
        couple_id: str,
        updates: dict[str, Any],
    ) -> dict[str, Any]:
        result = (
            supabase.table(table)
            .update(updates)
            .eq("id", row_id)
            .eq("couple_id", couple_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
        return result.data[0]

    def _delete_couple_row(self, table: str, row_id: str, couple_id: str) -> None:
        existing = (
            supabase.table(table)
            .select("id")
            .eq("id", row_id)
            .eq("couple_id", couple_id)
            .limit(1)
            .execute()
        )
        if not existing.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
        supabase.table(table).delete().eq("id", row_id).eq("couple_id", couple_id).execute()

    def _now(self) -> str:
        return datetime.now(UTC).isoformat()


couple_wiki = CoupleWikiService()
