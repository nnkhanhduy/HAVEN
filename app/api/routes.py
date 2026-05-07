from fastapi import APIRouter, Depends, File, Form, Query, UploadFile

from app.core.auth import CurrentUser, get_current_user
from app.models.schemas import AskResponse, MemoryCreateResponse, SuggestResponse
from app.services.memory_engine import memory_engine

router = APIRouter()


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
