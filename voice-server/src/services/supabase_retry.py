"""Retry wrapper for Supabase operations with exponential backoff."""

import asyncio
import logging
from typing import Any, Callable

logger = logging.getLogger(__name__)

# Exceptions safe to retry (transient network / DB issues)
_RETRYABLE = (ConnectionError, OSError, TimeoutError)


async def with_supabase_retry(
    func: Callable[..., Any],
    *args: Any,
    max_retries: int = 2,
    base_delay: float = 0.5,
    **kwargs: Any,
) -> Any:
    """Call an async function with retry on transient failures.

    Non-retryable exceptions (ValueError, KeyError, etc.) propagate immediately.
    """
    last_err: Exception | None = None
    for attempt in range(max_retries + 1):
        try:
            return await func(*args, **kwargs)
        except _RETRYABLE as e:
            last_err = e
            if attempt < max_retries:
                delay = base_delay * (2 ** attempt)
                logger.warning(
                    f"Supabase retry {attempt + 1}/{max_retries} after {type(e).__name__}: {e} "
                    f"(next attempt in {delay:.1f}s)"
                )
                await asyncio.sleep(delay)
            else:
                raise
        except Exception:
            raise  # Non-retryable — propagate immediately
    raise last_err  # Safety net
