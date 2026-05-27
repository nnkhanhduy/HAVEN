from fastapi import HTTPException
from jose import jwt

from app.core import auth


def test_decode_supabase_jwt_accepts_valid_token(monkeypatch):
    monkeypatch.setattr(auth.settings, "supabase_jwt_secret", "test-secret")
    token = jwt.encode(
        {"sub": "user-123", "aud": "authenticated"},
        "test-secret",
        algorithm="HS256",
    )

    payload = auth._decode_supabase_jwt(token)

    assert payload["sub"] == "user-123"


def test_decode_supabase_jwt_rejects_invalid_token(monkeypatch):
    monkeypatch.setattr(auth.settings, "supabase_jwt_secret", "test-secret")
    token = jwt.encode(
        {"sub": "user-123", "aud": "authenticated"},
        "wrong-secret",
        algorithm="HS256",
    )

    try:
        auth._decode_supabase_jwt(token)
    except HTTPException as exc:
        assert exc.status_code == 401
        assert exc.detail == "Invalid authentication token"
    else:
        raise AssertionError("Expected HTTPException")
