"""Tier 2 tests for src.services.realtime broadcast functions.

Each broadcast function gets a Supabase Realtime channel via _get_channel()
and calls send_broadcast() with a specific event name and payload.

We mock get_supabase_client so no real Supabase connection is made,
and verify the correct event names and payload shapes.

Key mock insight: get_supabase_client() is async, but the returned client's
.channel() method is synchronous. Only .send_broadcast() is async.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.services.realtime import (
    _channels,
    broadcast_preview_update,
    broadcast_step_completed,
    broadcast_open_action_menu,
    broadcast_close_action_menu,
    broadcast_project_selected,
    broadcast_call_ended,
    broadcast_voice_message,
)

CALL_SID = "CA_test_123"


@pytest.fixture(autouse=True)
def clear_channels():
    """Clear the module-level _channels cache before each test."""
    _channels.clear()
    yield
    _channels.clear()


@pytest.fixture
def mock_supabase():
    """Provide a mock Supabase client with a channel mock.

    - get_supabase_client is async, so we patch it as an async function.
    - supabase.channel() is synchronous, returns a channel object.
    - channel.send_broadcast() is async.
    """
    mock_client = MagicMock()
    mock_channel = AsyncMock()
    mock_client.channel.return_value = mock_channel

    async def fake_get_client():
        return mock_client

    with patch(
        "src.services.realtime.get_supabase_client",
        side_effect=fake_get_client,
    ):
        yield mock_channel


# ---- broadcast_preview_update ----


async def test_broadcast_preview_update_event_and_payload(mock_supabase):
    """broadcast_preview_update sends 'preview_updated' with correct keys."""
    await broadcast_preview_update(
        call_sid=CALL_SID,
        action="generated",
        message="Website built!",
        project_id="proj-1",
    )

    mock_supabase.send_broadcast.assert_awaited_once()
    event, payload = mock_supabase.send_broadcast.call_args.args
    assert event == "preview_updated"
    assert payload["action"] == "generated"
    assert payload["message"] == "Website built!"
    assert payload["projectId"] == "proj-1"
    assert "timestamp" in payload
    assert isinstance(payload["timestamp"], int)


async def test_broadcast_preview_update_channel_cached(mock_supabase):
    """The channel is cached in _channels after first access."""
    await broadcast_preview_update(CALL_SID, "edited", "done", "proj-1")

    assert CALL_SID in _channels
    assert _channels[CALL_SID] is mock_supabase


# ---- broadcast_step_completed ----


async def test_broadcast_step_completed_payload(mock_supabase):
    """broadcast_step_completed sends 'step_completed' with stepId."""
    await broadcast_step_completed(CALL_SID, "contact_form")

    mock_supabase.send_broadcast.assert_awaited_once()
    event, payload = mock_supabase.send_broadcast.call_args.args
    assert event == "step_completed"
    assert payload["stepId"] == "contact_form"
    assert "timestamp" in payload


# ---- broadcast_open_action_menu ----


async def test_broadcast_open_action_menu_event(mock_supabase):
    """broadcast_open_action_menu sends 'open_action_menu' event."""
    await broadcast_open_action_menu(CALL_SID)

    mock_supabase.send_broadcast.assert_awaited_once()
    event, payload = mock_supabase.send_broadcast.call_args.args
    assert event == "open_action_menu"
    assert "timestamp" in payload


# ---- broadcast_close_action_menu ----


async def test_broadcast_close_action_menu_event(mock_supabase):
    """broadcast_close_action_menu sends 'close_action_menu' event."""
    await broadcast_close_action_menu(CALL_SID)

    mock_supabase.send_broadcast.assert_awaited_once()
    event, payload = mock_supabase.send_broadcast.call_args.args
    assert event == "close_action_menu"
    assert "timestamp" in payload


# ---- broadcast_project_selected ----


async def test_broadcast_project_selected_payload(mock_supabase):
    """broadcast_project_selected sends 'project_selected' with projectId."""
    await broadcast_project_selected(CALL_SID, "proj-42")

    mock_supabase.send_broadcast.assert_awaited_once()
    event, payload = mock_supabase.send_broadcast.call_args.args
    assert event == "project_selected"
    assert payload["projectId"] == "proj-42"
    assert "timestamp" in payload


# ---- broadcast_call_ended ----


async def test_broadcast_call_ended_event(mock_supabase):
    """broadcast_call_ended sends 'call_ended' event."""
    await broadcast_call_ended(CALL_SID)

    mock_supabase.send_broadcast.assert_awaited_once()
    event, payload = mock_supabase.send_broadcast.call_args.args
    assert event == "call_ended"
    assert "timestamp" in payload


# ---- broadcast_voice_message ----


async def test_broadcast_voice_message_payload(mock_supabase):
    """broadcast_voice_message sends 'voice_message' with role/content."""
    await broadcast_voice_message(CALL_SID, role="user", content="Hello there")

    mock_supabase.send_broadcast.assert_awaited_once()
    event, payload = mock_supabase.send_broadcast.call_args.args
    assert event == "voice_message"
    assert payload["role"] == "user"
    assert payload["content"] == "Hello there"
    assert "timestamp" in payload
