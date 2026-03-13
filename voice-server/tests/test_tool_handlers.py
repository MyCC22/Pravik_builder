"""Tier 3 tests for tool handlers created by src.tools.create_tool_handlers.

Each handler is an async function that receives a FunctionCallParams-like
object with .arguments (dict) and .result_callback (async callable).

We test the handlers by:
1. Creating a ToolContext with test values
2. Calling create_tool_handlers(ctx) to get the handler dict
3. Patching broadcast functions and get_supabase_client at their import paths
4. Calling individual handlers with mock params and asserting behavior

Key mock insight: get_supabase_client() is async, but the returned Supabase
client's .table(), .update(), .eq() are synchronous. Only .execute() is async.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.tools import ToolContext, create_tool_handlers


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


class MockParams:
    """Mimics pipecat FunctionCallParams: .arguments and .result_callback."""

    def __init__(self, arguments=None):
        self.arguments = arguments or {}
        self.result_callback = AsyncMock()


def _make_ctx(**overrides) -> ToolContext:
    """Create a ToolContext with sensible test defaults."""
    defaults = dict(
        call_sid="test-call",
        session_id="test-session",
        user_id="test-user",
        project_id="test-project",
        phone_number="+15551234567",
        builder_api_url="http://localhost:3000",
    )
    defaults.update(overrides)
    return ToolContext(**defaults)


def _make_chain_mock(data=None):
    """Build a chainable Supabase mock (sync chain, async execute)."""
    mock_client = MagicMock()
    mock_table = MagicMock()
    mock_client.table.return_value = mock_table
    mock_table.insert.return_value = mock_table
    mock_table.update.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.single.return_value = mock_table
    result_obj = MagicMock()
    result_obj.data = data if data is not None else [{"id": "row-1"}]
    mock_table.execute = AsyncMock(return_value=result_obj)
    return mock_client, mock_table


def _patch_supabase_for_tools(mock_client):
    """Patch get_supabase_client at the src.tools import path."""
    async def fake_get_client():
        return mock_client

    return patch("src.tools.get_supabase_client", side_effect=fake_get_client)


# ---------------------------------------------------------------------------
# setup_call_forwarding
# ---------------------------------------------------------------------------


async def test_setup_call_forwarding_valid_number():
    """setup_call_forwarding saves forwarding_number to DB and broadcasts step_completed."""
    ctx = _make_ctx()
    handlers = create_tool_handlers(ctx)
    params = MockParams(arguments={"forwarding_number": "+15125559999"})

    mock_client, mock_table = _make_chain_mock()

    with (
        _patch_supabase_for_tools(mock_client),
        patch("src.tools.broadcast_step_completed", new_callable=AsyncMock) as mock_broadcast,
        patch("src.tools.save_call_message", new_callable=AsyncMock),
    ):
        await handlers["setup_call_forwarding"](params)

    # Should have saved to projects table
    mock_client.table.assert_called_with("projects")
    update_arg = mock_table.update.call_args.args[0]
    assert update_arg == {"forwarding_phone": "+15125559999"}
    mock_table.eq.assert_called_with("id", "test-project")

    # result_callback should have been called with success message
    params.result_callback.assert_awaited_once()
    result = params.result_callback.call_args.args[0]
    assert "message" in result


async def test_setup_call_forwarding_empty_number():
    """setup_call_forwarding returns error if forwarding_number is empty."""
    ctx = _make_ctx()
    handlers = create_tool_handlers(ctx)
    params = MockParams(arguments={"forwarding_number": ""})

    mock_client, _ = _make_chain_mock()

    with _patch_supabase_for_tools(mock_client):
        await handlers["setup_call_forwarding"](params)

    # result_callback should indicate error
    params.result_callback.assert_awaited_once()
    result = params.result_callback.call_args.args[0]
    assert "need" in result["message"].lower()

    # Should NOT have called table operations
    mock_client.table.assert_not_called()


# ---------------------------------------------------------------------------
# complete_action_step
# ---------------------------------------------------------------------------


async def test_complete_action_step_valid_id():
    """complete_action_step with valid step_id broadcasts step_completed."""
    ctx = _make_ctx()
    handlers = create_tool_handlers(ctx)
    params = MockParams(arguments={"step_id": "contact_form"})

    with patch(
        "src.tools.broadcast_step_completed", new_callable=AsyncMock
    ) as mock_broadcast:
        await handlers["complete_action_step"](params)

    mock_broadcast.assert_awaited_once_with("test-call", "contact_form")
    params.result_callback.assert_awaited_once()
    result = params.result_callback.call_args.args[0]
    assert "completed" in result["message"].lower()


async def test_complete_action_step_invalid_id():
    """complete_action_step with invalid step_id returns error without broadcasting."""
    ctx = _make_ctx()
    handlers = create_tool_handlers(ctx)
    params = MockParams(arguments={"step_id": "nonexistent_step"})

    with patch(
        "src.tools.broadcast_step_completed", new_callable=AsyncMock
    ) as mock_broadcast:
        await handlers["complete_action_step"](params)

    # Should NOT broadcast
    mock_broadcast.assert_not_awaited()

    # Should return error message listing valid IDs
    params.result_callback.assert_awaited_once()
    result = params.result_callback.call_args.args[0]
    assert "invalid" in result["message"].lower() or "Invalid" in result["message"]


async def test_complete_action_step_empty_id():
    """complete_action_step with empty step_id returns error."""
    ctx = _make_ctx()
    handlers = create_tool_handlers(ctx)
    params = MockParams(arguments={"step_id": ""})

    with patch(
        "src.tools.broadcast_step_completed", new_callable=AsyncMock
    ) as mock_broadcast:
        await handlers["complete_action_step"](params)

    mock_broadcast.assert_not_awaited()
    params.result_callback.assert_awaited_once()
    result = params.result_callback.call_args.args[0]
    assert "invalid" in result["message"].lower() or "Invalid" in result["message"]


# ---------------------------------------------------------------------------
# open_action_menu
# ---------------------------------------------------------------------------


async def test_open_action_menu_broadcasts():
    """open_action_menu broadcasts open_action_menu event."""
    ctx = _make_ctx()
    handlers = create_tool_handlers(ctx)
    params = MockParams()

    with patch(
        "src.tools.broadcast_open_action_menu", new_callable=AsyncMock
    ) as mock_broadcast:
        await handlers["open_action_menu"](params)

    mock_broadcast.assert_awaited_once_with("test-call")
    params.result_callback.assert_awaited_once()
    result = params.result_callback.call_args.args[0]
    assert "menu" in result["message"].lower() or "action" in result["message"].lower()


# ---------------------------------------------------------------------------
# close_action_menu
# ---------------------------------------------------------------------------


async def test_close_action_menu_broadcasts():
    """close_action_menu broadcasts close_action_menu event."""
    ctx = _make_ctx()
    handlers = create_tool_handlers(ctx)
    params = MockParams()

    with patch(
        "src.tools.broadcast_close_action_menu", new_callable=AsyncMock
    ) as mock_broadcast:
        await handlers["close_action_menu"](params)

    mock_broadcast.assert_awaited_once_with("test-call")
    params.result_callback.assert_awaited_once()
    result = params.result_callback.call_args.args[0]
    assert "closed" in result["message"].lower() or "menu" in result["message"].lower()
