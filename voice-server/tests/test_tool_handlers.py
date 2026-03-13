"""Tier 3 tests for tool handlers — direct handler testing.

Each handler has signature: async def handle(ctx: ToolContext, params)
where params has .arguments (dict) and .result_callback (async callable).

We test handlers by:
1. Creating a ToolContext with test values
2. Importing the handle function directly from the tool module
3. Patching service imports at the tool module path
4. Calling handle(ctx, params) and asserting behavior
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.tools._base import CallIdentity, CallState, TurnContext, ToolContext


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


class MockParams:
    """Mimics pipecat FunctionCallParams: .arguments and .result_callback."""

    def __init__(self, arguments=None):
        self.arguments = arguments or {}
        self.result_callback = AsyncMock()


# Keys that belong to each sub-object
_IDENTITY_KEYS = {"call_sid", "session_id", "user_id", "phone_number", "builder_api_url", "is_new_user"}
_STATE_KEYS = {"project_id", "project_count", "latest_project_id", "latest_project_name"}


def _make_ctx(**overrides) -> ToolContext:
    """Create a ToolContext with sensible test defaults."""
    identity_defaults = dict(
        call_sid="test-call",
        session_id="test-session",
        user_id="test-user",
        phone_number="+15551234567",
        builder_api_url="http://localhost:3000",
        is_new_user=True,
    )
    state_defaults = dict(
        _project_id="test-project",
    )

    # Route overrides to the right sub-object
    for k, v in overrides.items():
        if k in _IDENTITY_KEYS:
            identity_defaults[k] = v
        elif k == "project_id":
            state_defaults["_project_id"] = v
        elif k in _STATE_KEYS:
            state_defaults[k] = v

    return ToolContext(
        identity=CallIdentity(**identity_defaults),
        state=CallState(**state_defaults),
        turn=TurnContext(),
    )


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


# ---------------------------------------------------------------------------
# setup_call_forwarding
# ---------------------------------------------------------------------------


async def test_setup_call_forwarding_valid_number():
    """setup_call_forwarding saves forwarding_number to DB and broadcasts step_completed."""
    from src.tools.setup_call_forwarding import handle

    ctx = _make_ctx()
    params = MockParams(arguments={"forwarding_number": "+15125559999"})

    mock_client, mock_table = _make_chain_mock()

    async def fake_get_client():
        return mock_client

    with (
        patch("src.tools.setup_call_forwarding.get_supabase_client", side_effect=fake_get_client),
        patch("src.tools.setup_call_forwarding.broadcast_step_completed", new_callable=AsyncMock) as mock_broadcast,
        patch("src.tools.setup_call_forwarding.save_call_message", new_callable=AsyncMock),
    ):
        await handle(ctx, params)

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
    from src.tools.setup_call_forwarding import handle

    ctx = _make_ctx()
    params = MockParams(arguments={"forwarding_number": ""})

    await handle(ctx, params)

    # result_callback should indicate error
    params.result_callback.assert_awaited_once()
    result = params.result_callback.call_args.args[0]
    assert "need" in result["message"].lower()


# ---------------------------------------------------------------------------
# complete_action_step
# ---------------------------------------------------------------------------


async def test_complete_action_step_valid_id():
    """complete_action_step with valid step_id broadcasts step_completed."""
    from src.tools.complete_action_step import handle

    ctx = _make_ctx()
    params = MockParams(arguments={"step_id": "contact_form"})

    with patch(
        "src.tools.complete_action_step.broadcast_step_completed", new_callable=AsyncMock
    ) as mock_broadcast:
        await handle(ctx, params)

    mock_broadcast.assert_awaited_once_with("test-call", "contact_form")
    params.result_callback.assert_awaited_once()
    result = params.result_callback.call_args.args[0]
    assert "completed" in result["message"].lower()


async def test_complete_action_step_invalid_id():
    """complete_action_step with invalid step_id returns error without broadcasting."""
    from src.tools.complete_action_step import handle

    ctx = _make_ctx()
    params = MockParams(arguments={"step_id": "nonexistent_step"})

    with patch(
        "src.tools.complete_action_step.broadcast_step_completed", new_callable=AsyncMock
    ) as mock_broadcast:
        await handle(ctx, params)

    # Should NOT broadcast
    mock_broadcast.assert_not_awaited()

    # Should return error message listing valid IDs
    params.result_callback.assert_awaited_once()
    result = params.result_callback.call_args.args[0]
    assert "invalid" in result["message"].lower() or "Invalid" in result["message"]


async def test_complete_action_step_empty_id():
    """complete_action_step with empty step_id returns error."""
    from src.tools.complete_action_step import handle

    ctx = _make_ctx()
    params = MockParams(arguments={"step_id": ""})

    with patch(
        "src.tools.complete_action_step.broadcast_step_completed", new_callable=AsyncMock
    ) as mock_broadcast:
        await handle(ctx, params)

    mock_broadcast.assert_not_awaited()
    params.result_callback.assert_awaited_once()
    result = params.result_callback.call_args.args[0]
    assert "invalid" in result["message"].lower() or "Invalid" in result["message"]


# ---------------------------------------------------------------------------
# open_action_menu
# ---------------------------------------------------------------------------


async def test_open_action_menu_broadcasts():
    """open_action_menu broadcasts open_action_menu event."""
    from src.tools.open_action_menu import handle

    ctx = _make_ctx()
    params = MockParams()

    with patch(
        "src.tools.open_action_menu.broadcast_open_action_menu", new_callable=AsyncMock
    ) as mock_broadcast:
        await handle(ctx, params)

    mock_broadcast.assert_awaited_once_with("test-call")
    params.result_callback.assert_awaited_once()
    result = params.result_callback.call_args.args[0]
    assert "menu" in result["message"].lower() or "action" in result["message"].lower()


# ---------------------------------------------------------------------------
# close_action_menu
# ---------------------------------------------------------------------------


async def test_close_action_menu_broadcasts():
    """close_action_menu broadcasts close_action_menu event."""
    from src.tools.close_action_menu import handle

    ctx = _make_ctx()
    params = MockParams()

    with patch(
        "src.tools.close_action_menu.broadcast_close_action_menu", new_callable=AsyncMock
    ) as mock_broadcast:
        await handle(ctx, params)

    mock_broadcast.assert_awaited_once_with("test-call")
    params.result_callback.assert_awaited_once()
    result = params.result_callback.call_args.args[0]
    assert "closed" in result["message"].lower() or "menu" in result["message"].lower()
