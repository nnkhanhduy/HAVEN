from typing import Any

from pydantic import BaseModel, Field


class ProfileResponse(BaseModel):
    user_id: str
    couple_id: str
    display_name: str | None = None
    role: str | None = None


class CreateCoupleRequest(BaseModel):
    display_name: str | None = Field(default=None, max_length=120)
    role: str = Field(default="partner_1", max_length=40)
    anniversary_date: str | None = None


class InviteResponse(BaseModel):
    code: str
    couple_id: str
    expires_at: str | None = None


class CreateCoupleResponse(BaseModel):
    couple_id: str
    profile: ProfileResponse
    invite: InviteResponse | None = None


class JoinCoupleRequest(BaseModel):
    code: str = Field(min_length=4, max_length=40)
    display_name: str | None = Field(default=None, max_length=120)
    role: str = Field(default="partner_2", max_length=40)


class PreferenceCreate(BaseModel):
    category: str = Field(min_length=1, max_length=80)
    detail_json: dict[str, Any] = Field(default_factory=dict)
    user_id: str | None = None


class PreferenceUpdate(BaseModel):
    category: str | None = Field(default=None, min_length=1, max_length=80)
    detail_json: dict[str, Any] | None = None


class PreferenceResponse(BaseModel):
    id: str
    user_id: str | None = None
    category: str
    detail_json: dict[str, Any] = Field(default_factory=dict)
    updated_at: str | None = None


class WishlistItemCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str | None = None
    category: str | None = Field(default=None, max_length=80)
    target_for_user_id: str | None = None
    status: str = Field(default="open", max_length=40)
    metadata: dict[str, Any] = Field(default_factory=dict)


class WishlistItemUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = None
    category: str | None = Field(default=None, max_length=80)
    target_for_user_id: str | None = None
    status: str | None = Field(default=None, max_length=40)
    metadata: dict[str, Any] | None = None


class WishlistItemResponse(BaseModel):
    id: str
    title: str
    description: str | None = None
    category: str | None = None
    target_for_user_id: str | None = None
    status: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str | None = None
    updated_at: str | None = None


class ImportantDateCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    date_value: str
    date_type: str = Field(default="anniversary", max_length=80)
    notes: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ImportantDateUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    date_value: str | None = None
    date_type: str | None = Field(default=None, max_length=80)
    notes: str | None = None
    metadata: dict[str, Any] | None = None


class ImportantDateResponse(BaseModel):
    id: str
    title: str
    date_value: str
    date_type: str
    notes: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str | None = None
    updated_at: str | None = None


class LoveMapMemory(BaseModel):
    id: str
    content: str | None = None
    image_url: str | None = None
    location: str
    sentiment: str | None = None
    timestamp: str | None = None


class MemoryUpdate(BaseModel):
    content: str | None = None
    location: str | None = None
    occurred_at: str | None = None
    sentiment: str | None = None


class MemoryResponse(BaseModel):
    id: str
    content: str | None = None
    image_url: str | None = None
    image_signed_url: str | None = None
    location: str | None = None
    sentiment: str | None = None
    timestamp: str | None = None
    created_at: str | None = None


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
