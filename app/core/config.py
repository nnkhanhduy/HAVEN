from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "haven"
    api_v1_prefix: str = "/api"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    supabase_url: str
    supabase_service_role_key: str
    supabase_jwt_secret: str
    supabase_memory_bucket: str = "memories"

    openai_api_key: str
    openai_embedding_model: str = "text-embedding-3-small"
    openai_chat_model: str = "gpt-4o-mini"
    openai_vision_model: str = "gpt-4o-mini"

    max_image_upload_bytes: int = 8 * 1024 * 1024
    allowed_image_content_types: str = "image/jpeg,image/png,image/webp"

    @property
    def cors_origin_list(self) -> list[str]:
        return self._parse_csv_list(self.cors_origins)

    @property
    def allowed_image_content_type_list(self) -> list[str]:
        return self._parse_csv_list(self.allowed_image_content_types)

    def _parse_csv_list(self, value: str) -> list[str]:
        return [item.strip() for item in value.split(",") if item.strip()]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
