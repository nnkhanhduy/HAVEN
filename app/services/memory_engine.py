import base64
import json
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from openai import AsyncOpenAI

from app.core.auth import CurrentUser
from app.core.config import settings
from app.models.schemas import AskResponse, MemoryResponse, MemoryUpdate, RetrievedMemory, SuggestResponse
from app.services.supabase_client import supabase


class MemoryEngine:
    def __init__(self) -> None:
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)

    async def create_memory(
        self,
        user: CurrentUser,
        content: str,
        location: str | None,
        occurred_at: str | None,
        image: UploadFile | None,
    ) -> dict[str, Any]:
        image_url = None
        image_caption = None
        raw_image_bytes = None

        if image:
            raw_image_bytes = await image.read()
            image_url = self._upload_image(user.couple_id, image, raw_image_bytes)
            image_caption = await self._describe_image(image, raw_image_bytes)

        normalized_content = "\n\n".join(
            part for part in [content.strip(), self._caption_block(image_caption)] if part
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
            "image_url": image_url,
            "vector_embedding": embedding,
            "location": location or metadata.get("location"),
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
            .select("id,content,image_url,location,sentiment,timestamp,created_at")
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

    async def _describe_image(self, image: UploadFile, image_bytes: bytes) -> str:
        content_type = image.content_type or "image/jpeg"
        encoded = base64.b64encode(image_bytes).decode("ascii")
        response = await self.client.chat.completions.create(
            model=settings.openai_vision_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Extract useful memory details from the image. Include visible text, "
                        "people, activities, objects, mood, possible location clues, and date clues."
                    ),
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Describe this couple memory for retrieval."},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{content_type};base64,{encoded}"},
                        },
                    ],
                },
            ],
            temperature=0.2,
        )
        return response.choices[0].message.content or ""

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

    def _get_couple_memory(self, couple_id: str, memory_id: str) -> dict[str, Any]:
        result = (
            supabase.table("memories")
            .select("id,content,image_url,location,sentiment,timestamp,created_at")
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

    def _caption_block(self, image_caption: str | None) -> str | None:
        if not image_caption:
            return None
        return f"Image analysis:\n{image_caption}"

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
