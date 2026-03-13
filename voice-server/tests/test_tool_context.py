"""Tests for ToolContext composition and _VALID_STEP_IDS — pure data, no mocking."""

import pytest

from src.tools import ToolContext, _VALID_STEP_IDS
from src.tools._base import CallIdentity, CallState, TurnContext


def _quick_ctx(**overrides) -> ToolContext:
    """Minimal ToolContext for tests that just need a valid instance."""
    return ToolContext(
        identity=CallIdentity(
            call_sid=overrides.get("call_sid", "test"),
            session_id=overrides.get("session_id", "sess"),
            user_id=overrides.get("user_id", "user"),
            phone_number=overrides.get("phone_number", "+1555"),
            builder_api_url=overrides.get("builder_api_url", "http://localhost"),
            is_new_user=overrides.get("is_new_user", True),
        ),
        state=CallState(_project_id=overrides.get("project_id", "proj")),
        turn=TurnContext(),
    )


def test_default_values():
    ctx = _quick_ctx()
    assert ctx.state.link_sent is False
    assert ctx.state.page_opened is False
    assert ctx.turn.pending_image_urls == []
    assert ctx.identity.is_new_user is True
    assert ctx.turn.last_edit_summary == ""


def test_required_fields():
    with pytest.raises(TypeError):
        ToolContext()  # Missing required args


def test_mutable_list_per_instance():
    ctx1 = _quick_ctx(call_sid="a")
    ctx2 = _quick_ctx(call_sid="b")
    ctx1.turn.pending_image_urls.append("img.jpg")
    assert len(ctx2.turn.pending_image_urls) == 0


def test_identity_accessible_through_ctx():
    ctx = _quick_ctx(call_sid="abc", user_id="uid-1")
    assert ctx.identity.call_sid == "abc"
    assert ctx.identity.user_id == "uid-1"


def test_state_accessible_through_ctx():
    ctx = _quick_ctx(project_id="proj-99")
    assert ctx.state.project_id == "proj-99"


def test_valid_step_ids_contains_expected():
    expected = {"build_site", "contact_form", "phone_number", "call_forwarding"}
    assert expected.issubset(_VALID_STEP_IDS)


def test_valid_step_ids_excludes_coming_soon():
    assert "ai_phone" not in _VALID_STEP_IDS
