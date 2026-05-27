from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "haven"
    api_v1_prefix: str = "/api"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    supabase_url: str
    supabase_service_role_key: str
    supabase_jwt_secret: str
    supabase_memory_bucket: str = "memories"

    openai_api_key: str
    openai_embedding_model: str = "text-embedding-3-small"
    openai_chat_model: str = "gpt-4o-mini"
    openai_vision_model: str = "gpt-4o-mini"

    max_image_upload_bytes: int = 8 * 1024 * 1024
    allowed_image_content_types: list[str] = ["image/jpeg", "image/png", "image/webp"]

    @field_validator("cors_origins", "allowed_image_content_types", mode="before")
    @classmethod
    def _parse_csv_list(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
