"""Test Supabase retry wrapper."""
import pytest
from unittest.mock import AsyncMock


@pytest.mark.asyncio
async def test_supabase_retry_succeeds_first_try():
    from src.services.supabase_retry import with_supabase_retry
    func = AsyncMock(return_value={"id": "test"})
    result = await with_supabase_retry(func)
    assert result == {"id": "test"}
    assert func.call_count == 1


@pytest.mark.asyncio
async def test_supabase_retry_succeeds_after_transient_failure():
    from src.services.supabase_retry import with_supabase_retry
    func = AsyncMock(side_effect=[ConnectionError("timeout"), {"id": "test"}])
    result = await with_supabase_retry(func, max_retries=1, base_delay=0.01)
    assert result == {"id": "test"}
    assert func.call_count == 2


@pytest.mark.asyncio
async def test_supabase_retry_raises_after_max_retries():
    from src.services.supabase_retry import with_supabase_retry
    func = AsyncMock(side_effect=ConnectionError("persistent failure"))
    with pytest.raises(ConnectionError):
        await with_supabase_retry(func, max_retries=2, base_delay=0.01)
    assert func.call_count == 3  # 1 initial + 2 retries


@pytest.mark.asyncio
async def test_supabase_retry_no_retry_on_value_error():
    from src.services.supabase_retry import with_supabase_retry
    func = AsyncMock(side_effect=ValueError("bad input"))
    with pytest.raises(ValueError):
        await with_supabase_retry(func, max_retries=2, base_delay=0.01)
    assert func.call_count == 1  # Should not retry non-transient errors


@pytest.mark.asyncio
async def test_supabase_retry_retries_on_os_error():
    from src.services.supabase_retry import with_supabase_retry
    func = AsyncMock(side_effect=[OSError("broken pipe"), {"ok": True}])
    result = await with_supabase_retry(func, max_retries=1, base_delay=0.01)
    assert result == {"ok": True}
    assert func.call_count == 2
