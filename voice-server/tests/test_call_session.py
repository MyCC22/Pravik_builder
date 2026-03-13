"""Tier 2 tests for src.services.call_session DB operations.

Each function calls get_supabase_client() and performs chained Supabase
query operations like .table().insert().execute().

Key mock insight: get_supabase_client() is async, but the returned Supabase
client's .table(), .insert(), .update(), .eq(), .select() are all synchronous
chain builders. Only .execute() at the end of the chain is async.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.services.call_session import (
    create_call_session,
    update_call_state,
    mark_page_opened,
    end_call_session,
    save_call_message,
    update_call_session_project,
)

CALL_SID = "CA_test_456"


def _make_chain_mock(data=None):
    """Build a chainable Supabase query mock.

    .table() and all chain methods are synchronous (MagicMock).
    .execute() is async (AsyncMock).
    """
    mock_client = MagicMock()
    mock_table = MagicMock()
    mock_client.table.return_value = mock_table

    # Each chainable method returns itself so calls can be chained
    mock_table.insert.return_value = mock_table
    mock_table.update.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.single.return_value = mock_table
    mock_table.maybe_single.return_value = mock_table
    mock_table.order.return_value = mock_table
    mock_table.limit.return_value = mock_table

    # .execute() is async and returns an object with .data
    result = MagicMock()
    result.data = data if data is not None else [{"id": "row-1"}]
    mock_table.execute = AsyncMock(return_value=result)

    return mock_client, mock_table


def _patch_supabase(mock_client):
    """Patch get_supabase_client to return mock_client from an async function."""
    async def fake_get_client():
        return mock_client

    return patch(
        "src.services.call_session.get_supabase_client",
        side_effect=fake_get_client,
    )


# ---- create_call_session ----


async def test_create_call_session_inserts_correct_data():
    """create_call_session inserts into 'call_sessions' with the right fields."""
    mock_client, mock_table = _make_chain_mock(
        data=[{"id": "sess-1", "call_sid": CALL_SID}]
    )

    with _patch_supabase(mock_client):
        result = await create_call_session(
            call_sid=CALL_SID,
            user_id="user-1",
            project_id="proj-1",
            phone_number="+15551234567",
            is_new_user=True,
        )

    mock_client.table.assert_called_with("call_sessions")
    insert_arg = mock_table.insert.call_args.args[0]
    assert insert_arg["call_sid"] == CALL_SID
    assert insert_arg["user_id"] == "user-1"
    assert insert_arg["project_id"] == "proj-1"
    assert insert_arg["phone_number"] == "+15551234567"
    assert insert_arg["is_new_user"] is True
    assert insert_arg["state"] == "greeting"
    assert result["id"] == "sess-1"


# ---- update_call_state ----


async def test_update_call_state_sends_correct_update():
    """update_call_state updates the state field filtered by call_sid."""
    mock_client, mock_table = _make_chain_mock()

    with _patch_supabase(mock_client):
        await update_call_state(CALL_SID, "building")

    mock_client.table.assert_called_with("call_sessions")
    update_arg = mock_table.update.call_args.args[0]
    assert update_arg == {"state": "building"}
    mock_table.eq.assert_called_with("call_sid", CALL_SID)


# ---- mark_page_opened ----


async def test_mark_page_opened_sets_flag_and_timestamp():
    """mark_page_opened sets page_opened=True and page_opened_at."""
    mock_client, mock_table = _make_chain_mock()

    with _patch_supabase(mock_client):
        await mark_page_opened(CALL_SID)

    mock_client.table.assert_called_with("call_sessions")
    update_arg = mock_table.update.call_args.args[0]
    assert update_arg["page_opened"] is True
    assert "page_opened_at" in update_arg
    # page_opened_at should be an ISO format string
    assert "T" in update_arg["page_opened_at"]
    mock_table.eq.assert_called_with("call_sid", CALL_SID)


# ---- end_call_session ----


async def test_end_call_session_sets_state_and_ended_at():
    """end_call_session sets state='ended' and ended_at timestamp."""
    mock_client, mock_table = _make_chain_mock()

    with _patch_supabase(mock_client):
        await end_call_session(CALL_SID)

    mock_client.table.assert_called_with("call_sessions")
    update_arg = mock_table.update.call_args.args[0]
    assert update_arg["state"] == "ended"
    assert "ended_at" in update_arg
    assert "T" in update_arg["ended_at"]
    mock_table.eq.assert_called_with("call_sid", CALL_SID)


# ---- save_call_message ----


async def test_save_call_message_inserts_correct_data():
    """save_call_message inserts into 'call_messages' with role/content/intent."""
    mock_client, mock_table = _make_chain_mock()

    with _patch_supabase(mock_client):
        await save_call_message(
            call_session_id="sess-1",
            role="assistant",
            content="Website built!",
            intent="build_website",
        )

    mock_client.table.assert_called_with("call_messages")
    insert_arg = mock_table.insert.call_args.args[0]
    assert insert_arg["call_session_id"] == "sess-1"
    assert insert_arg["role"] == "assistant"
    assert insert_arg["content"] == "Website built!"
    assert insert_arg["intent"] == "build_website"


# ---- update_call_session_project ----


async def test_update_call_session_project_updates_project_id():
    """update_call_session_project updates project_id filtered by call_sid."""
    mock_client, mock_table = _make_chain_mock()

    with _patch_supabase(mock_client):
        await update_call_session_project(CALL_SID, "proj-new")

    mock_client.table.assert_called_with("call_sessions")
    update_arg = mock_table.update.call_args.args[0]
    assert update_arg == {"project_id": "proj-new"}
    mock_table.eq.assert_called_with("call_sid", CALL_SID)
