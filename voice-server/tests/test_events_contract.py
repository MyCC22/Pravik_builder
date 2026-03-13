"""Tests for the Python event contract — ensures enums and make_payload work correctly."""

from src.events import CallEvent, WebActionType, make_payload


def test_call_event_enum_has_nine_values():
    """CallEvent enum should have exactly 9 members."""
    assert len(CallEvent) == 9


def test_call_event_values_match_expected():
    """CallEvent values match the expected event name strings."""
    expected = {
        "preview_updated",
        "voice_message",
        "project_selected",
        "open_action_menu",
        "close_action_menu",
        "step_completed",
        "call_ended",
        "page_opened",
        "web_action",
    }
    actual = {e.value for e in CallEvent}
    assert actual == expected


def test_web_action_type_has_six_values():
    """WebActionType enum should have exactly 6 members."""
    assert len(WebActionType) == 6
    expected = {
        "page_opened",
        "text_message_sent",
        "image_uploaded",
        "project_selected_from_web",
        "new_project_requested",
        "step_selected",
    }
    actual = {e.value for e in WebActionType}
    assert actual == expected


def test_make_payload_includes_timestamp():
    """make_payload always includes a positive integer timestamp."""
    result = make_payload(stepId="contact_form")
    assert "timestamp" in result
    assert isinstance(result["timestamp"], int)
    assert result["timestamp"] > 0


def test_make_payload_preserves_kwargs():
    """make_payload passes through all keyword arguments."""
    result = make_payload(stepId="x", projectId="y", action="generated")
    assert result["stepId"] == "x"
    assert result["projectId"] == "y"
    assert result["action"] == "generated"
    assert "timestamp" in result
