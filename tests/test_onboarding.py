from datetime import UTC, datetime, timedelta

from fastapi import HTTPException

from app.core.auth import AuthenticatedUser
from app.models.schemas import CreateCoupleRequest, InviteResponse, JoinCoupleRequest, ProfileResponse
from app.services.onboarding import OnboardingService


def test_create_couple_rejects_user_with_existing_profile(monkeypatch):
    service = OnboardingService()
    user = AuthenticatedUser(user_id="user-1")
    monkeypatch.setattr(
        service,
        "get_profile",
        lambda _: ProfileResponse(user_id="user-1", couple_id="couple-1"),
    )

    try:
        service.create_couple(user, CreateCoupleRequest(display_name="Alex"))
    except HTTPException as exc:
        assert exc.status_code == 409
    else:
        raise AssertionError("Expected HTTPException")


def test_create_couple_returns_invite(monkeypatch):
    service = OnboardingService()
    user = AuthenticatedUser(user_id="user-1")

    monkeypatch.setattr(service, "get_profile", lambda _: None)
    monkeypatch.setattr(
        service,
        "_create_profile",
        lambda **_: {
            "user_id": "user-1",
            "couple_id": "couple-1",
            "display_name": "Alex",
            "role": "partner_1",
        },
    )
    monkeypatch.setattr(
        service,
        "_create_invite_for_profile",
        lambda _user_id, _couple_id: InviteResponse(code="ABC123", couple_id="couple-1"),
    )

    class FakeTable:
        def insert(self, _row):
            return self

        def execute(self):
            return type("Result", (), {"data": [{"id": "couple-1"}]})()

    class FakeSupabase:
        def table(self, name):
            assert name == "couples"
            return FakeTable()

    from app.services import onboarding

    monkeypatch.setattr(onboarding, "supabase", FakeSupabase())

    result = service.create_couple(user, CreateCoupleRequest(display_name="Alex"))

    assert result.couple_id == "couple-1"
    assert result.invite.code == "ABC123"


def test_get_active_invite_rejects_expired_invite(monkeypatch):
    service = OnboardingService()
    expired_at = (datetime.now(UTC) - timedelta(minutes=1)).isoformat()

    class FakeTable:
        def select(self, _fields):
            return self

        def eq(self, _field, _value):
            return self

        def limit(self, _count):
            return self

        def execute(self):
            return type(
                "Result",
                (),
                {
                    "data": [
                        {
                            "id": "invite-1",
                            "couple_id": "couple-1",
                            "expires_at": expired_at,
                            "accepted_by_user_id": None,
                        }
                    ]
                },
            )()

    class FakeSupabase:
        def table(self, name):
            assert name == "couple_invites"
            return FakeTable()

    from app.services import onboarding

    monkeypatch.setattr(onboarding, "supabase", FakeSupabase())

    try:
        service._get_active_invite("ABC123")
    except HTTPException as exc:
        assert exc.status_code == 410
        assert exc.detail == "Invite expired"
    else:
        raise AssertionError("Expected HTTPException")


def test_get_active_invite_rejects_missing_invite(monkeypatch):
    service = OnboardingService()

    class FakeTable:
        def select(self, _fields):
            return self

        def eq(self, _field, _value):
            return self

        def limit(self, _count):
            return self

        def execute(self):
            return type("Result", (), {"data": []})()

    class FakeSupabase:
        def table(self, name):
            assert name == "couple_invites"
            return FakeTable()

    from app.services import onboarding

    monkeypatch.setattr(onboarding, "supabase", FakeSupabase())

    try:
        service._get_active_invite("MISSING")
    except HTTPException as exc:
        assert exc.status_code == 404
        assert exc.detail == "Invite not found"
    else:
        raise AssertionError("Expected HTTPException")


def test_get_active_invite_rejects_used_invite(monkeypatch):
    service = OnboardingService()

    class FakeTable:
        def select(self, _fields):
            return self

        def eq(self, _field, _value):
            return self

        def limit(self, _count):
            return self

        def execute(self):
            return type(
                "Result",
                (),
                {
                    "data": [
                        {
                            "id": "invite-1",
                            "couple_id": "couple-1",
                            "expires_at": None,
                            "accepted_by_user_id": "user-2",
                        }
                    ]
                },
            )()

    class FakeSupabase:
        def table(self, name):
            assert name == "couple_invites"
            return FakeTable()

    from app.services import onboarding

    monkeypatch.setattr(onboarding, "supabase", FakeSupabase())

    try:
        service._get_active_invite("USED")
    except HTTPException as exc:
        assert exc.status_code == 409
        assert exc.detail == "Invite already used"
    else:
        raise AssertionError("Expected HTTPException")


def test_join_couple_rejects_user_with_existing_profile(monkeypatch):
    service = OnboardingService()
    user = AuthenticatedUser(user_id="user-1")
    monkeypatch.setattr(
        service,
        "get_profile",
        lambda _: ProfileResponse(user_id="user-1", couple_id="couple-1"),
    )

    try:
        service.join_couple(user, JoinCoupleRequest(code="ABC123"))
    except HTTPException as exc:
        assert exc.status_code == 409
    else:
        raise AssertionError("Expected HTTPException")


def test_join_couple_creates_profile_and_marks_invite(monkeypatch):
    service = OnboardingService()
    user = AuthenticatedUser(user_id="user-2")
    calls = []

    monkeypatch.setattr(service, "get_profile", lambda _: None)
    monkeypatch.setattr(
        service,
        "_get_active_invite",
        lambda code: {"id": "invite-1", "couple_id": "couple-1"} if code == "ABC123" else None,
    )
    monkeypatch.setattr(
        service,
        "_create_profile",
        lambda **kwargs: {
            "user_id": kwargs["user_id"],
            "couple_id": kwargs["couple_id"],
            "display_name": kwargs["display_name"],
            "role": kwargs["role"],
        },
    )
    monkeypatch.setattr(service, "_mark_invite_accepted", lambda invite_id, user_id: calls.append(("accepted", invite_id, user_id)))
    monkeypatch.setattr(service, "_fill_second_partner", lambda couple_id, user_id: calls.append(("partner", couple_id, user_id)))

    result = service.join_couple(user, JoinCoupleRequest(code="ABC123", display_name="Sam"))

    assert result.user_id == "user-2"
    assert result.couple_id == "couple-1"
    assert calls == [("accepted", "invite-1", "user-2"), ("partner", "couple-1", "user-2")]
