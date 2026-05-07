from typing import Any

from pydantic import BaseModel, Field


class MemoryCreateResponse(BaseModel):
    memory_id: str
    metadata: dict[str, Any]


class RetrievedMemory(BaseModel):
    id: str
    content: str | None = None
    image_url: str | None = None
    location: str | None = None
    sentiment: str | None = None
    timestamp: str | None = None
    similarity: float | None = None


class AskResponse(BaseModel):
    answer: str
    sources: list[RetrievedMemory] = Field(default_factory=list)


class SuggestResponse(BaseModel):
    suggestions: list[str]
    rationale: str
