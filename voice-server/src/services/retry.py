"""Retry with exponential backoff for async functions."""

import asyncio
import logging

import httpx

logger = logging.getLogger(__name__)

# Exceptions that are safe to retry (transient failures)
RETRYABLE_EXCEPTIONS: tuple = (
    httpx.TimeoutException,
    httpx.HTTPStatusError,
    ConnectionError,
    OSError,
)


async def retry_with_backoff(
    func,
    *args,
    max_retries: int = 2,
    base_delay: float = 1.0,
    retryable_exceptions: tuple = RETRYABLE_EXCEPTIONS,
    **kwargs,
):
    """Retry an async function with exponential backoff.

    Calls `func(*args, **kwargs)` up to `max_retries + 1` times.
    Sleeps `base_delay * 2^attempt` seconds between retries.
    Non-retryable exceptions propagate immediately.

    Args:
        func: Async function to call.
        max_retries: Maximum number of retry attempts (0 = no retries).
        base_delay: Base delay in seconds (doubles each retry).
        retryable_exceptions: Tuple of exception types that trigger retry.
    """
    last_exception = None

    for attempt in range(max_retries + 1):
        try:
            return await func(*args, **kwargs)
        except retryable_exceptions as e:
            last_exception = e
            if attempt < max_retries:
                delay = base_delay * (2 ** attempt)  # 1s, 2s, 4s, ...
                logger.info(
                    f"Retry {attempt + 1}/{max_retries} after "
                    f"{type(e).__name__}, waiting {delay:.1f}s"
                )
                await asyncio.sleep(delay)
            continue
        except Exception:
            raise  # Non-retryable errors fail immediately

    raise last_exception
