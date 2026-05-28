import json
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from openai import AsyncOpenAI

from app.core.auth import CurrentUser
from app.core.config import settings
from app.models.schemas import MEMORY_TYPES, AskResponse, MemoryResponse, MemoryUpdate, RetrievedMemory, SuggestResponse
from app.services.supabase_client import supabase


class MemoryEngine:
    def __init__(self) -> None:
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)

    async def create_memory(
        self,
        user: CurrentUser,
        content: str,
        memory_type: str,
        location: str | None,
        place_name: str | None,
        latitude: float | None,
        longitude: float | None,
        location_note: str | None,
        occurred_at: str | None,
        image: UploadFile | None,
    ) -> dict[str, Any]:
        self._validate_place(memory_type, latitude, longitude)
        image_url = None
        raw_image_bytes = None

        if image:
            raw_image_bytes = await image.read()
            self._validate_image(image, raw_image_bytes)
            image_url = self._upload_image(user.couple_id, image, raw_image_bytes)

        normalized_content = "\n\n".join(
            part
            for part in [
                content.strip(),
                self._check_in_block(memory_type, place_name, location_note),
            ]
            if part
        )
        if not normalized_content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Memory content or image is required",
            )

        metadata = await self._extract_metadata(normalized_content)
        embedding = await self.embed_text(normalized_content)
        memory_row = {
            "couple_id": user.couple_id,
            "content": normalized_content,
            "memory_type": memory_type,
            "image_url": image_url,
            "vector_embedding": embedding,
            "location": location or place_name or metadata.get("location"),
            "place_name": place_name,
            "latitude": latitude,
            "longitude": longitude,
            "location_note": location_note,
            "sentiment": metadata.get("sentiment"),
            "timestamp": occurred_at or datetime.now(UTC).isoformat(),
        }

        result = supabase.table("memories").insert(memory_row).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Could not create memory")
        return self._with_signed_image_url(result.data[0])

    def list_memories(self, user: CurrentUser, limit: int = 50) -> list[MemoryResponse]:
        result = (
            supabase.table("memories")
            .select(
                "id,content,memory_type,image_url,location,place_name,latitude,longitude,"
                "location_note,sentiment,timestamp,created_at"
            )
            .eq("couple_id", user.couple_id)
            .order("timestamp", desc=True)
            .limit(limit)
            .execute()
        )
        return [MemoryResponse(**self._with_signed_image_url(item)) for item in result.data or []]

    def get_memory(self, user: CurrentUser, memory_id: str) -> MemoryResponse:
        memory = self._get_couple_memory(user.couple_id, memory_id)
        return MemoryResponse(**self._with_signed_image_url(memory))

    async def update_memory(
        self,
        user: CurrentUser,
        memory_id: str,
        payload: MemoryUpdate,
    ) -> MemoryResponse:
        updates = payload.model_dump(exclude_unset=True)
        if not updates:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

        if "occurred_at" in updates:
            updates["timestamp"] = updates.pop("occurred_at")
        if "memory_type" in updates or "latitude" in updates or "longitude" in updates:
            self._validate_place(
                updates.get("memory_type", "memory"),
                updates.get("latitude"),
                updates.get("longitude"),
            )
        if "content" in updates and updates["content"] is not None:
            updates["vector_embedding"] = await self.embed_text(updates["content"])

        result = (
            supabase.table("memories")
            .update(updates)
            .eq("id", memory_id)
            .eq("couple_id", user.couple_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found")
        return MemoryResponse(**self._with_signed_image_url(result.data[0]))

    def delete_memory(self, user: CurrentUser, memory_id: str) -> dict[str, str]:
        memory = self._get_couple_memory(user.couple_id, memory_id)
        supabase.table("memories").delete().eq("id", memory_id).eq("couple_id", user.couple_id).execute()
        if memory.get("image_url"):
            supabase.storage.from_(settings.supabase_memory_bucket).remove([memory["image_url"]])
        return {"status": "deleted"}

    async def embed_text(self, text: str) -> list[float]:
        response = await self.client.embeddings.create(
            model=settings.openai_embedding_model,
            input=text,
        )
        return response.data[0].embedding

    async def retrieve_memories(
        self,
        couple_id: str,
        query: str,
        match_count: int = 6,
    ) -> list[RetrievedMemory]:
        query_embedding = await self.embed_text(query)
        result = supabase.rpc(
            "match_memories",
            {
                "query_embedding": query_embedding,
                "query_text": query,
                "target_couple_id": couple_id,
                "match_count": match_count,
            },
        ).execute()

        memories = []
        for item in result.data or []:
            if "memory_timestamp" in item:
                item["timestamp"] = item.pop("memory_timestamp")
            memories.append(RetrievedMemory(**item))
        return memories

    async def answer_question(self, user: CurrentUser, question: str) -> AskResponse:
        memories = await self.retrieve_memories(user.couple_id, question)
        context = self._format_memories(memories)
        response = await self.client.chat.completions.create(
            model=settings.openai_chat_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are Soulmate AI for one couple. Answer only from the provided "
                        "couple-isolated memories and profile context. If the answer is not "
                        "supported, say you do not know yet and suggest what memory to add."
                    ),
                },
                {"role": "user", "content": f"Memories:\n{context}\n\nQuestion: {question}"},
            ],
            temperature=0.4,
        )
        return AskResponse(
            answer=response.choices[0].message.content or "",
            sources=memories,
        )

    async def suggest(self, user: CurrentUser, context: str) -> SuggestResponse:
        memories = await self.retrieve_memories(user.couple_id, context, match_count=8)
        preferences = self._get_preferences(user.couple_id)
        response = await self.client.chat.completions.create(
            model=settings.openai_chat_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You suggest intimate, practical date or gift ideas for a couple. "
                        "Use only the provided memories and preferences. Return strict JSON "
                        "with keys suggestions (array of strings) and rationale (string)."
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "context": context,
                            "preferences": preferences,
                            "memories": [m.model_dump() for m in memories],
                        },
                        ensure_ascii=True,
                    ),
                },
            ],
            temperature=0.7,
            response_format={"type": "json_object"},
        )
        payload = json.loads(response.choices[0].message.content or "{}")
        return SuggestResponse(
            suggestions=payload.get("suggestions", []),
            rationale=payload.get("rationale", ""),
        )

    async def _extract_metadata(self, content: str) -> dict[str, Any]:
        response = await self.client.chat.completions.create(
            model=settings.openai_chat_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Extract compact metadata from a couple memory. Return strict JSON "
                        "with optional keys location and sentiment. Sentiment should be one "
                        "short label like joyful, nostalgic, calm, tense, romantic, or unknown."
                    ),
                },
                {"role": "user", "content": content},
            ],
            temperature=0.1,
            response_format={"type": "json_object"},
        )
        try:
            return json.loads(response.choices[0].message.content or "{}")
        except json.JSONDecodeError:
            return {}

    def _upload_image(self, couple_id: str, image: UploadFile, image_bytes: bytes) -> str:
        extension = (image.filename or "memory.jpg").rsplit(".", 1)[-1]
        object_path = f"{couple_id}/{uuid4()}.{extension}"
        supabase.storage.from_(settings.supabase_memory_bucket).upload(
            object_path,
            image_bytes,
            {"content-type": image.content_type or "application/octet-stream"},
        )
        return object_path

    def _validate_image(self, image: UploadFile, image_bytes: bytes) -> None:
        if len(image_bytes) > settings.max_image_upload_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Image upload is too large",
            )

        content_type = image.content_type or ""
        if content_type not in settings.allowed_image_content_type_list:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported image type",
            )

    def _validate_place(self, memory_type: str, latitude: float | None, longitude: float | None) -> None:
        if memory_type not in MEMORY_TYPES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported memory type")
        if latitude is not None and not -90 <= latitude <= 90:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Latitude is out of range")
        if longitude is not None and not -180 <= longitude <= 180:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Longitude is out of range")
        if (latitude is None) != (longitude is None):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Latitude and longitude must be provided together",
            )

    def _get_couple_memory(self, couple_id: str, memory_id: str) -> dict[str, Any]:
        result = (
            supabase.table("memories")
            .select(
                "id,content,memory_type,image_url,location,place_name,latitude,longitude,"
                "location_note,sentiment,timestamp,created_at"
            )
            .eq("id", memory_id)
            .eq("couple_id", couple_id)
            .limit(1)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found")
        return result.data[0]

    def _with_signed_image_url(self, memory: dict[str, Any]) -> dict[str, Any]:
        image_path = memory.get("image_url")
        memory["image_signed_url"] = None
        if not image_path:
            return memory

        signed = supabase.storage.from_(settings.supabase_memory_bucket).create_signed_url(
            image_path,
            3600,
        )
        memory["image_signed_url"] = signed.get("signedURL") or signed.get("signedUrl")
        return memory

    def _get_preferences(self, couple_id: str) -> list[dict[str, Any]]:
        result = (
            supabase.table("preferences")
            .select("user_id,category,detail_json")
            .eq("couple_id", couple_id)
            .execute()
        )
        return result.data or []

    def _check_in_block(self, memory_type: str, place_name: str | None, location_note: str | None) -> str | None:
        if memory_type != "check_in":
            return None
        lines = []
        if place_name:
            lines.append(f"Checked in at {place_name}.")
        if location_note:
            lines.append(f"Location note: {location_note}")
        return "\n".join(lines) or None

    def _format_memories(self, memories: list[RetrievedMemory]) -> str:
        if not memories:
            return "No relevant memories found."
        return "\n\n".join(
            (
                f"- id: {memory.id}\n"
                f"  when: {memory.timestamp}\n"
                f"  where: {memory.location}\n"
                f"  sentiment: {memory.sentiment}\n"
                f"  content: {memory.content}"
            )
            for memory in memories
        )


memory_engine = MemoryEngine()
