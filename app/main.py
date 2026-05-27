from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import settings
from app.services.supabase_client import supabase


app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router, prefix=settings.api_v1_prefix)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}


@app.get("/ready")
def ready() -> dict[str, str]:
    supabase.table("profiles").select("id").limit(1).execute()
    return {"status": "ready", "service": settings.app_name}
