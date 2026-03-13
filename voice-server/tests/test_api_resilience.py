"""Integration tests for API resilience — circuit breaker + retry in tool handlers."""

import pytest
import time
from unittest.mock import AsyncMock, patch

from src.services.circuit_breaker import CircuitState
from src.tools._base import CallIdentity, CallState, TurnContext, ToolContext
from src.tools._helpers import builder_api_circuit, call_api_with_retry


class MockParams:
    def __init__(self, arguments=None):
        self.arguments = arguments or {}
        self.result_callback = AsyncMock()


def _make_ctx(**overrides) -> ToolContext:
    return ToolContext(
        identity=CallIdentity(
            call_sid=overrides.get("call_sid", "test-call"),
            session_id=overrides.get("session_id", "test-session"),
            user_id=overrides.get("user_id", "test-user"),
            phone_number=overrides.get("phone_number", "+15551234567"),
            builder_api_url=overrides.get("builder_api_url", "http://localhost:3000"),
            is_new_user=overrides.get("is_new_user", True),
        ),
        state=CallState(_project_id=overrides.get("project_id", "test-project")),
        turn=TurnContext(),
    )


@pytest.fixture(autouse=True)
def _reset_circuit():
    """Reset the shared circuit breaker before each test."""
    builder_api_circuit._state = CircuitState.CLOSED
    builder_api_circuit._failure_count = 0
    builder_api_circuit._last_failure_time = 0.0
    yield
    # Clean up after test too
    builder_api_circuit._state = CircuitState.CLOSED
    builder_api_circuit._failure_count = 0
    builder_api_circuit._last_failure_time = 0.0


async def test_build_website_circuit_open_returns_error():
    """build_website returns structured error when circuit is open."""
    from src.tools.build_website import handle

    # Force circuit open
    builder_api_circuit._state = CircuitState.OPEN
    builder_api_circuit._last_failure_time = time.monotonic()

    ctx = _make_ctx()
    params = MockParams(arguments={"description": "A yoga studio website"})

    with (
        patch("src.tools.build_website.send_sms_if_needed", new_callable=AsyncMock),
        patch("src.tools.build_website.update_call_state", new_callable=AsyncMock),
    ):
        await handle(ctx, params)

    params.result_callback.assert_awaited_once()
    result = params.result_callback.call_args.args[0]
    assert "temporarily unavailable" in result["message"]
    assert result["status"] == "temporary_error"


async def test_edit_website_circuit_open_returns_error():
    """edit_website returns structured error when circuit is open."""
    from src.tools.edit_website import handle

    # Force circuit open
    builder_api_circuit._state = CircuitState.OPEN
    builder_api_circuit._last_failure_time = time.monotonic()

    ctx = _make_ctx()
    params = MockParams(arguments={"instruction": "Change the headline"})

    with patch("src.tools.edit_website.fetch_site_state", new_callable=AsyncMock, return_value={"blocks": [{"block_type": "hero"}], "tools": []}):
        await handle(ctx, params)

    params.result_callback.assert_awaited_once()
    result = params.result_callback.call_args.args[0]
    assert "temporarily unavailable" in result["message"]
    assert result["status"] == "temporary_error"


async def test_circuit_recovers_after_timeout():
    """Circuit recovers and allows calls after recovery_timeout."""
    ctx = _make_ctx()

    # Force circuit open, but with old failure time (past recovery)
    builder_api_circuit._state = CircuitState.OPEN
    builder_api_circuit._failure_count = 3
    builder_api_circuit._last_failure_time = time.monotonic() - builder_api_circuit.recovery_timeout - 1

    assert builder_api_circuit.state == CircuitState.HALF_OPEN

    # Next call should go through (circuit allows one test request)
    with patch("src.tools._helpers.call_builder_api", new_callable=AsyncMock, return_value={"action": "generated", "message": "Done!"}):
        result = await call_api_with_retry(ctx, "build a site")

    assert result["action"] == "generated"
    assert builder_api_circuit.state == CircuitState.CLOSED
