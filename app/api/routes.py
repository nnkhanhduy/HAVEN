from typing import Any

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile

from app.core.auth import AuthenticatedUser, CurrentUser, get_authenticated_user, get_current_user
from app.models.schemas import (
    AskResponse,
    CreateCoupleRequest,
    CreateCoupleResponse,
    ImportantDateCreate,
    ImportantDateResponse,
    ImportantDateUpdate,
    InviteResponse,
    JoinCoupleRequest,
    LoveMapMemory,
    MemoryCreateResponse,
    MemoryResponse,
    MemoryUpdate,
    PreferenceCreate,
    PreferenceResponse,
    PreferenceUpdate,
    ProfileResponse,
    SuggestResponse,
    WishlistItemCreate,
    WishlistItemResponse,
    WishlistItemUpdate,
)
from app.services.couple_wiki import couple_wiki
from app.services.memory_engine import memory_engine
from app.services.onboarding import onboarding

router = APIRouter()


@router.get("/onboarding/profile", response_model=ProfileResponse | None)
async def get_onboarding_profile(
    authenticated_user: AuthenticatedUser = Depends(get_authenticated_user),
) -> ProfileResponse | None:
    return onboarding.get_profile(authenticated_user)


@router.post("/onboarding/couple", response_model=CreateCoupleResponse)
async def create_couple(
    payload: CreateCoupleRequest,
    authenticated_user: AuthenticatedUser = Depends(get_authenticated_user),
) -> CreateCoupleResponse:
    return onboarding.create_couple(authenticated_user, payload)


@router.post("/onboarding/invite", response_model=InviteResponse)
async def create_invite(
    authenticated_user: AuthenticatedUser = Depends(get_authenticated_user),
) -> InviteResponse:
    return onboarding.create_invite(authenticated_user)


@router.post("/onboarding/join", response_model=ProfileResponse)
async def join_couple(
    payload: JoinCoupleRequest,
    authenticated_user: AuthenticatedUser = Depends(get_authenticated_user),
) -> ProfileResponse:
    return onboarding.join_couple(authenticated_user, payload)


@router.get("/memories", response_model=list[MemoryResponse])
async def list_memories(
    limit: int = Query(default=50, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[MemoryResponse]:
    return memory_engine.list_memories(current_user, limit=limit)


@router.post("/memories", response_model=MemoryCreateResponse)
async def create_memory(
    content: str = Form(default=""),
    location: str | None = Form(default=None),
    occurred_at: str | None = Form(default=None),
    image: UploadFile | None = File(default=None),
    current_user: CurrentUser = Depends(get_current_user),
) -> MemoryCreateResponse:
    memory = await memory_engine.create_memory(
        user=current_user,
        content=content,
        location=location,
        occurred_at=occurred_at,
        image=image,
    )
    return MemoryCreateResponse(memory_id=memory["id"], metadata=memory)


@router.get("/memories/{memory_id}", response_model=MemoryResponse)
async def get_memory(
    memory_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> MemoryResponse:
    return memory_engine.get_memory(current_user, memory_id)


@router.patch("/memories/{memory_id}", response_model=MemoryResponse)
async def update_memory(
    memory_id: str,
    payload: MemoryUpdate,
    current_user: CurrentUser = Depends(get_current_user),
) -> MemoryResponse:
    return await memory_engine.update_memory(current_user, memory_id, payload)


@router.delete("/memories/{memory_id}")
async def delete_memory(
    memory_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, str]:
    return memory_engine.delete_memory(current_user, memory_id)


@router.get("/ask", response_model=AskResponse)
async def ask(
    question: str = Query(min_length=2),
    current_user: CurrentUser = Depends(get_current_user),
) -> AskResponse:
    return await memory_engine.answer_question(current_user, question)


@router.get("/suggest", response_model=SuggestResponse)
async def suggest(
    context: str = Query(default="upcoming date or holiday"),
    current_user: CurrentUser = Depends(get_current_user),
) -> SuggestResponse:
    return await memory_engine.suggest(current_user, context)


@router.get("/love-map", response_model=list[LoveMapMemory])
async def love_map(
    current_user: CurrentUser = Depends(get_current_user),
) -> list[LoveMapMemory]:
    return couple_wiki.love_map(current_user)


@router.get("/preferences", response_model=list[PreferenceResponse])
async def list_preferences(
    current_user: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    return couple_wiki.list_preferences(current_user)


@router.post("/preferences", response_model=PreferenceResponse)
async def create_preference(
    payload: PreferenceCreate,
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return couple_wiki.create_preference(current_user, payload)


@router.patch("/preferences/{preference_id}", response_model=PreferenceResponse)
async def update_preference(
    preference_id: str,
    payload: PreferenceUpdate,
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return couple_wiki.update_preference(current_user, preference_id, payload)


@router.delete("/preferences/{preference_id}")
async def delete_preference(
    preference_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, str]:
    return couple_wiki.delete_preference(current_user, preference_id)


@router.get("/wishlist", response_model=list[WishlistItemResponse])
async def list_wishlist(
    current_user: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    return couple_wiki.list_wishlist(current_user)


@router.post("/wishlist", response_model=WishlistItemResponse)
async def create_wishlist_item(
    payload: WishlistItemCreate,
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return couple_wiki.create_wishlist_item(current_user, payload)


@router.patch("/wishlist/{item_id}", response_model=WishlistItemResponse)
async def update_wishlist_item(
    item_id: str,
    payload: WishlistItemUpdate,
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return couple_wiki.update_wishlist_item(current_user, item_id, payload)


@router.delete("/wishlist/{item_id}")
async def delete_wishlist_item(
    item_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, str]:
    return couple_wiki.delete_wishlist_item(current_user, item_id)


@router.get("/important-dates", response_model=list[ImportantDateResponse])
async def list_important_dates(
    current_user: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    return couple_wiki.list_important_dates(current_user)


@router.post("/important-dates", response_model=ImportantDateResponse)
async def create_important_date(
    payload: ImportantDateCreate,
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return couple_wiki.create_important_date(current_user, payload)


@router.patch("/important-dates/{date_id}", response_model=ImportantDateResponse)
async def update_important_date(
    date_id: str,
    payload: ImportantDateUpdate,
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return couple_wiki.update_important_date(current_user, date_id, payload)


@router.delete("/important-dates/{date_id}")
async def delete_important_date(
    date_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, str]:
    return couple_wiki.delete_important_date(current_user, date_id)
