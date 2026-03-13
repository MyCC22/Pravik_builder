"""Circuit breaker for protecting against cascading failures."""

import asyncio
import logging
import time
from enum import StrEnum

logger = logging.getLogger(__name__)


class CircuitState(StrEnum):
    CLOSED = "closed"        # Normal operation — requests pass through
    OPEN = "open"            # Fast-fail all requests
    HALF_OPEN = "half_open"  # Allow one test request to check recovery


class CircuitOpenError(Exception):
    """Raised when the circuit is open and fast-failing requests."""
    pass


class CircuitBreaker:
    """Simple async circuit breaker.

    After `failure_threshold` consecutive failures, the circuit opens and
    fast-fails all requests with CircuitOpenError. After `recovery_timeout`
    seconds, the circuit moves to half-open, allowing one test request.
    If it succeeds, the circuit closes; if it fails, it reopens.

    Usage:
        breaker = CircuitBreaker(failure_threshold=3, recovery_timeout=30.0)
        result = await breaker.call(some_async_function, arg1, arg2)
    """

    def __init__(
        self,
        failure_threshold: int = 3,
        recovery_timeout: float = 30.0,
        name: str = "default",
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.name = name
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._last_failure_time = 0.0
        self._lock = asyncio.Lock()

    @property
    def state(self) -> CircuitState:
        """Current circuit state, accounting for recovery timeout."""
        if self._state == CircuitState.OPEN:
            if time.monotonic() - self._last_failure_time > self.recovery_timeout:
                return CircuitState.HALF_OPEN
        return self._state

    async def call(self, func, *args, **kwargs):
        """Execute an async function through the circuit breaker.

        Raises CircuitOpenError if the circuit is open.
        Re-raises the original exception if the call fails.
        """
        async with self._lock:
            current_state = self.state

            if current_state == CircuitState.OPEN:
                raise CircuitOpenError(
                    f"Circuit '{self.name}' is open — "
                    f"fast-failing. Retry after {self.recovery_timeout}s."
                )

            # If half-open, let one request through (we're inside the lock)
            if current_state == CircuitState.HALF_OPEN:
                logger.info(f"Circuit '{self.name}' half-open — allowing test request")

        try:
            result = await func(*args, **kwargs)
            await self._on_success()
            return result
        except Exception:
            await self._on_failure()
            raise

    async def _on_success(self):
        async with self._lock:
            if self._failure_count > 0 or self._state != CircuitState.CLOSED:
                logger.info(
                    f"Circuit '{self.name}' success — "
                    f"closing (was {self._state}, failures={self._failure_count})"
                )
            self._failure_count = 0
            self._state = CircuitState.CLOSED

    async def _on_failure(self):
        async with self._lock:
            self._failure_count += 1
            self._last_failure_time = time.monotonic()
            if self._failure_count >= self.failure_threshold:
                if self._state != CircuitState.OPEN:
                    logger.warning(
                        f"Circuit '{self.name}' OPEN after "
                        f"{self._failure_count} failures"
                    )
                self._state = CircuitState.OPEN
            else:
                logger.info(
                    f"Circuit '{self.name}' failure "
                    f"{self._failure_count}/{self.failure_threshold}"
                )
