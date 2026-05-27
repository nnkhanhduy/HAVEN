from app.services.memory_engine import MemoryEngine
from fastapi import HTTPException


class FakeStorageBucket:
    def create_signed_url(self, image_path, expires_in):
        assert image_path == "couple-1/memory.jpg"
        assert expires_in == 3600
        return {"signedURL": "https://signed.example/memory.jpg"}


class FakeStorage:
    def from_(self, bucket):
        assert bucket == "memories"
        return FakeStorageBucket()


class FakeSupabase:
    storage = FakeStorage()


def test_caption_block_returns_none_without_caption():
    engine = MemoryEngine()

    assert engine._caption_block(None) is None


def test_caption_block_formats_caption():
    engine = MemoryEngine()

    assert engine._caption_block("A happy dinner") == "Image analysis:\nA happy dinner"


def test_format_memories_handles_empty_list():
    engine = MemoryEngine()

    assert engine._format_memories([]) == "No relevant memories found."


def test_with_signed_image_url_adds_signed_url(monkeypatch):
    from app.services import memory_engine

    monkeypatch.setattr(memory_engine, "supabase", FakeSupabase())
    monkeypatch.setattr(memory_engine.settings, "supabase_memory_bucket", "memories")

    memory = {"id": "memory-1", "image_url": "couple-1/memory.jpg"}
    result = MemoryEngine()._with_signed_image_url(memory)

    assert result["image_signed_url"] == "https://signed.example/memory.jpg"


def test_with_signed_image_url_handles_text_only_memory():
    memory = {"id": "memory-1", "image_url": None}
    result = MemoryEngine()._with_signed_image_url(memory)

    assert result["image_signed_url"] is None


class FakeUploadFile:
    content_type = "image/gif"


def test_validate_image_rejects_unsupported_content_type(monkeypatch):
    from app.services import memory_engine

    monkeypatch.setattr(memory_engine.settings, "allowed_image_content_types", ["image/jpeg"])

    try:
        MemoryEngine()._validate_image(FakeUploadFile(), b"image-bytes")
    except HTTPException as exc:
        assert exc.status_code == 400
        assert exc.detail == "Unsupported image type"
    else:
        raise AssertionError("Expected HTTPException")


def test_validate_image_rejects_large_upload(monkeypatch):
    from app.services import memory_engine

    monkeypatch.setattr(memory_engine.settings, "max_image_upload_bytes", 3)

    try:
        MemoryEngine()._validate_image(FakeUploadFile(), b"image-bytes")
    except HTTPException as exc:
        assert exc.status_code == 413
        assert exc.detail == "Image upload is too large"
    else:
        raise AssertionError("Expected HTTPException")
