"""Tests for retry_with_backoff — exponential retry logic."""

import pytest
from unittest.mock import AsyncMock, patch

import httpx

from src.services.retry import retry_with_backoff


async def test_succeeds_first_try():
    """No failures — function called once."""
    func = AsyncMock(return_value="result")

    result = await retry_with_backoff(func, max_retries=2)

    assert result == "result"
    assert func.await_count == 1


@patch("src.services.retry.asyncio.sleep", new_callable=AsyncMock)
async def test_retries_on_timeout(mock_sleep):
    """First call times out, second succeeds — function called twice."""
    func = AsyncMock(side_effect=[httpx.TimeoutException("timeout"), "success"])

    result = await retry_with_backoff(func, max_retries=2, base_delay=1.0)

    assert result == "success"
    assert func.await_count == 2
    mock_sleep.assert_awaited_once_with(1.0)  # base_delay * 2^0


@patch("src.services.retry.asyncio.sleep", new_callable=AsyncMock)
async def test_retries_on_http_error(mock_sleep):
    """First call returns 500, second succeeds."""
    response = httpx.Response(500, request=httpx.Request("POST", "http://test"))
    func = AsyncMock(
        side_effect=[httpx.HTTPStatusError("500", request=response.request, response=response), "ok"]
    )

    result = await retry_with_backoff(func, max_retries=2, base_delay=1.0)

    assert result == "ok"
    assert func.await_count == 2


@patch("src.services.retry.asyncio.sleep", new_callable=AsyncMock)
async def test_exponential_delay(mock_sleep):
    """Delays follow exponential backoff: base * 2^attempt."""
    func = AsyncMock(
        side_effect=[
            httpx.TimeoutException("1"),
            httpx.TimeoutException("2"),
            "success",
        ]
    )

    result = await retry_with_backoff(func, max_retries=2, base_delay=1.0)

    assert result == "success"
    assert mock_sleep.await_count == 2
    mock_sleep.assert_any_await(1.0)  # 1.0 * 2^0
    mock_sleep.assert_any_await(2.0)  # 1.0 * 2^1


@patch("src.services.retry.asyncio.sleep", new_callable=AsyncMock)
async def test_max_retries_exceeded(mock_sleep):
    """All calls fail — raises last exception after max_retries+1 attempts."""
    func = AsyncMock(side_effect=httpx.TimeoutException("always fails"))

    with pytest.raises(httpx.TimeoutException):
        await retry_with_backoff(func, max_retries=2, base_delay=0.1)

    assert func.await_count == 3  # 1 initial + 2 retries


async def test_non_retryable_fails_immediately():
    """ValueError is not retryable — fails immediately without retry."""
    func = AsyncMock(side_effect=ValueError("bad input"))

    with pytest.raises(ValueError, match="bad input"):
        await retry_with_backoff(func, max_retries=2)

    assert func.await_count == 1  # No retry


async def test_respects_max_retries_zero():
    """max_retries=0 means only 1 attempt, no retries."""
    func = AsyncMock(side_effect=httpx.TimeoutException("fail"))

    with pytest.raises(httpx.TimeoutException):
        await retry_with_backoff(func, max_retries=0)

    assert func.await_count == 1
