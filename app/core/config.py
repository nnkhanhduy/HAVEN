from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "haven"
    api_v1_prefix: str = "/api"

    supabase_url: str
    supabase_service_role_key: str
    supabase_jwt_secret: str
    supabase_memory_bucket: str = "memories"

    openai_api_key: str
    openai_embedding_model: str = "text-embedding-3-small"
    openai_chat_model: str = "gpt-4o"
    openai_vision_model: str = "gpt-4o"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
