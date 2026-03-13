"""Test that broadcast functions handle errors gracefully."""
import pytest
from unittest.mock import AsyncMock, MagicMock


@pytest.mark.asyncio
async def test_broadcast_preview_update_handles_send_failure():
    """broadcast_preview_update should return False on failure, not raise."""
    from src.services.realtime import broadcast_preview_update, _channels

    mock_channel = MagicMock()
    mock_channel.send_broadcast = AsyncMock(side_effect=Exception("Realtime down"))
    _channels["test-call"] = mock_channel

    result = await broadcast_preview_update("test-call", "build", "Done", "proj-1")
    assert result is False

    _channels.pop("test-call", None)


@pytest.mark.asyncio
async def test_broadcast_preview_update_returns_true_on_success():
    """broadcast_preview_update returns True when send succeeds."""
    from src.services.realtime import broadcast_preview_update, _channels

    mock_channel = MagicMock()
    mock_channel.send_broadcast = AsyncMock(return_value=None)
    _channels["test-call"] = mock_channel

    result = await broadcast_preview_update("test-call", "build", "Done", "proj-1")
    assert result is True

    _channels.pop("test-call", None)


@pytest.mark.asyncio
async def test_broadcast_step_completed_handles_failure():
    """broadcast_step_completed should not raise on send failure."""
    from src.services.realtime import broadcast_step_completed, _channels

    mock_channel = MagicMock()
    mock_channel.send_broadcast = AsyncMock(side_effect=ConnectionError("timeout"))
    _channels["test-call"] = mock_channel

    result = await broadcast_step_completed("test-call", "build_site")
    assert result is False

    _channels.pop("test-call", None)


@pytest.mark.asyncio
async def test_broadcast_call_ended_handles_failure():
    """broadcast_call_ended should not raise on send failure."""
    from src.services.realtime import broadcast_call_ended, _channels

    mock_channel = MagicMock()
    mock_channel.send_broadcast = AsyncMock(side_effect=OSError("network error"))
    _channels["test-call"] = mock_channel

    result = await broadcast_call_ended("test-call")
    assert result is False

    _channels.pop("test-call", None)
