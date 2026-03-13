"""Tests for ToolContext dataclass and _VALID_STEP_IDS — pure data, no mocking."""

import pytest

from src.tools import ToolContext, _VALID_STEP_IDS


def test_default_values():
    ctx = ToolContext(
        call_sid="test", session_id="sess", user_id="user",
        project_id="proj", phone_number="+1555", builder_api_url="http://localhost"
    )
    assert ctx.link_sent is False
    assert ctx.page_opened is False
    assert ctx.pending_image_urls == []
    assert ctx.is_new_user is True
    assert ctx.last_edit_summary == ""


def test_required_fields():
    with pytest.raises(TypeError):
        ToolContext()  # Missing required args


def test_mutable_list_per_instance():
    ctx1 = ToolContext(
        call_sid="a", session_id="s", user_id="u",
        project_id="p", phone_number="+1", builder_api_url="http://x",
    )
    ctx2 = ToolContext(
        call_sid="b", session_id="s", user_id="u",
        project_id="p", phone_number="+1", builder_api_url="http://x",
    )
    ctx1.pending_image_urls.append("img.jpg")
    assert len(ctx2.pending_image_urls) == 0


def test_valid_step_ids_contains_expected():
    expected = {"build_site", "contact_form", "phone_number", "call_forwarding"}
    assert expected.issubset(_VALID_STEP_IDS)


def test_valid_step_ids_excludes_coming_soon():
    assert "ai_phone" not in _VALID_STEP_IDS
