"""Tests for CircuitBreaker — state transitions and failure tracking."""

import pytest
import time
from unittest.mock import AsyncMock, patch

from src.services.circuit_breaker import CircuitBreaker, CircuitState, CircuitOpenError


@pytest.fixture
def breaker():
    return CircuitBreaker(failure_threshold=3, recovery_timeout=1.0, name="test")


async def test_closed_state_passes_through(breaker):
    """Circuit closed — call succeeds and returns result."""
    func = AsyncMock(return_value={"action": "generated"})
    result = await breaker.call(func, "arg1")

    assert result == {"action": "generated"}
    func.assert_awaited_once_with("arg1")
    assert breaker.state == CircuitState.CLOSED


async def test_failure_increments_count(breaker):
    """Single failure increments count but keeps circuit closed."""
    func = AsyncMock(side_effect=Exception("boom"))

    with pytest.raises(Exception, match="boom"):
        await breaker.call(func)

    assert breaker._failure_count == 1
    assert breaker.state == CircuitState.CLOSED


async def test_opens_after_threshold(breaker):
    """Circuit opens after failure_threshold consecutive failures."""
    func = AsyncMock(side_effect=Exception("fail"))

    for _ in range(3):
        with pytest.raises(Exception):
            await breaker.call(func)

    assert breaker.state == CircuitState.OPEN
    assert breaker._failure_count == 3


async def test_open_circuit_fast_fails(breaker):
    """Open circuit raises CircuitOpenError without calling the function."""
    func = AsyncMock(side_effect=Exception("fail"))

    # Open the circuit
    for _ in range(3):
        with pytest.raises(Exception):
            await breaker.call(func)

    # Now it should fast-fail
    new_func = AsyncMock()
    with pytest.raises(CircuitOpenError):
        await breaker.call(new_func)

    new_func.assert_not_awaited()


async def test_half_open_after_timeout(breaker):
    """Circuit transitions to half-open after recovery_timeout."""
    func = AsyncMock(side_effect=Exception("fail"))

    for _ in range(3):
        with pytest.raises(Exception):
            await breaker.call(func)

    assert breaker.state == CircuitState.OPEN

    # Simulate time passing beyond recovery_timeout
    breaker._last_failure_time = time.monotonic() - 2.0

    assert breaker.state == CircuitState.HALF_OPEN


async def test_half_open_success_closes(breaker):
    """Successful call in half-open state closes the circuit."""
    fail_func = AsyncMock(side_effect=Exception("fail"))

    for _ in range(3):
        with pytest.raises(Exception):
            await breaker.call(fail_func)

    # Force half-open
    breaker._last_failure_time = time.monotonic() - 2.0
    assert breaker.state == CircuitState.HALF_OPEN

    # Successful call should close
    success_func = AsyncMock(return_value="ok")
    result = await breaker.call(success_func)

    assert result == "ok"
    assert breaker.state == CircuitState.CLOSED
    assert breaker._failure_count == 0


async def test_half_open_failure_reopens(breaker):
    """Failed call in half-open state reopens the circuit."""
    fail_func = AsyncMock(side_effect=Exception("fail"))

    for _ in range(3):
        with pytest.raises(Exception):
            await breaker.call(fail_func)

    # Force half-open
    breaker._last_failure_time = time.monotonic() - 2.0

    # Failure should reopen
    with pytest.raises(Exception):
        await breaker.call(fail_func)

    assert breaker.state == CircuitState.OPEN


async def test_success_resets_failure_count(breaker):
    """Success after partial failures resets the failure count."""
    fail_func = AsyncMock(side_effect=Exception("fail"))
    success_func = AsyncMock(return_value="ok")

    # 2 failures (below threshold)
    for _ in range(2):
        with pytest.raises(Exception):
            await breaker.call(fail_func)

    assert breaker._failure_count == 2

    # Success resets
    await breaker.call(success_func)

    assert breaker._failure_count == 0
    assert breaker.state == CircuitState.CLOSED
