# Issue 007: Circuit Breaker for Builder API

**Criticality**: Medium
**Impact**: Bad UX during outages
**Effort**: Small (few hours)

---

## Problem

When the Builder API (Next.js `/api/builder/generate`) is down or slow, the voice server retries **once on timeout only** and then fails. There is:

1. **No exponential backoff**: Retry is immediate, adding load to an already-struggling service
2. **No circuit breaker**: If API is down, every call attempt hits the dead endpoint
3. **No graceful degradation**: User hears nothing — the AI goes silent because tool execution fails
4. **No error classification**: Timeout, 500, 429, and network errors all handled the same way
5. **No user-facing error communication**: AI gets a generic error message and must improvise a response

### Current Retry Logic

```python
# voice-server/src/tools.py:370-385
async def _call_api_with_retry(message, image_urls=None):
    """Call builder API with one retry on timeout."""
    try:
        return await call_builder_api(ctx.builder_api_url, message, ctx.project_id, image_urls)
    except httpx.TimeoutException:
        logger.warning("Builder API timeout, retrying...")
        return await call_builder_api(ctx.builder_api_url, message, ctx.project_id, image_urls)
```

**Problems**:
- Only catches `TimeoutException` — 500 errors crash the handler
- Immediate retry — no backoff
- No tracking of failure rate
- No circuit-open state to fast-fail subsequent calls

### Error Handling in Tool Handlers

```python
# voice-server/src/tools.py:475-537 (build_website handler)
except Exception as e:
    logger.error(f"build_website error: {e}", exc_info=True)
    await params.result_callback({
        "message": "Sorry, there was an error building your website. Please try again."
    })
```

AI receives "Sorry, there was an error" but doesn't know:
- If it's transient (try again in 5 seconds) or permanent (API is down)
- If it should tell the user to wait or offer alternatives
- If other tools that depend on the API will also fail

### Files Affected

| File | Lines | Content |
|------|-------|---------|
| `voice-server/src/tools.py` | 370-385 | `_call_api_with_retry` |
| `voice-server/src/tools.py` | 475-537 | build_website error handling |
| `voice-server/src/tools.py` | 539-667 | edit_website error handling |
| `voice-server/src/services/builder_api.py` | 13-30 | `call_builder_api` |

---

## Proposed Solution: Circuit Breaker + Retry with Backoff

### Circuit Breaker Class

```python
# voice-server/src/services/circuit_breaker.py
import asyncio
import time
from enum import StrEnum

class CircuitState(StrEnum):
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Fast-fail all requests
    HALF_OPEN = "half_open"  # Allow one test request

class CircuitBreaker:
    """Simple circuit breaker for async API calls."""

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
        if self._state == CircuitState.OPEN:
            if time.time() - self._last_failure_time > self.recovery_timeout:
                return CircuitState.HALF_OPEN
        return self._state

    async def call(self, func, *args, **kwargs):
        """Execute function through circuit breaker."""
        async with self._lock:
            current_state = self.state

            if current_state == CircuitState.OPEN:
                raise CircuitOpenError(
                    f"Circuit '{self.name}' is open. "
                    f"Retry after {self.recovery_timeout}s."
                )

        try:
            result = await func(*args, **kwargs)
            await self._on_success()
            return result
        except Exception as e:
            await self._on_failure()
            raise

    async def _on_success(self):
        async with self._lock:
            self._failure_count = 0
            self._state = CircuitState.CLOSED

    async def _on_failure(self):
        async with self._lock:
            self._failure_count += 1
            self._last_failure_time = time.time()
            if self._failure_count >= self.failure_threshold:
                self._state = CircuitState.OPEN

class CircuitOpenError(Exception):
    pass
```

### Retry with Exponential Backoff

```python
# voice-server/src/services/retry.py
import asyncio
import httpx

async def retry_with_backoff(
    func,
    *args,
    max_retries: int = 2,
    base_delay: float = 1.0,
    retryable_exceptions: tuple = (httpx.TimeoutException, httpx.HTTPStatusError),
    **kwargs,
):
    """Retry async function with exponential backoff."""
    last_exception = None

    for attempt in range(max_retries + 1):
        try:
            return await func(*args, **kwargs)
        except retryable_exceptions as e:
            last_exception = e
            if attempt < max_retries:
                delay = base_delay * (2 ** attempt)  # 1s, 2s, 4s
                await asyncio.sleep(delay)
            continue
        except Exception:
            raise  # Non-retryable errors fail immediately

    raise last_exception
```

### Updated API Call

```python
# In tools.py or builder_api.py
_builder_circuit = CircuitBreaker(
    failure_threshold=3,
    recovery_timeout=30.0,
    name="builder_api"
)

async def _call_api_with_retry(message, image_urls=None):
    """Call builder API through circuit breaker with backoff."""
    try:
        return await _builder_circuit.call(
            retry_with_backoff,
            call_builder_api,
            ctx.builder_api_url, message, ctx.project_id, image_urls,
            max_retries=2,
            base_delay=1.0,
        )
    except CircuitOpenError:
        return {
            "action": "error",
            "message": "The website builder is temporarily unavailable. "
                       "Please wait a moment and try again.",
            "retryable": True,
        }
    except Exception as e:
        return {
            "action": "error",
            "message": f"Failed to reach the builder service: {type(e).__name__}",
            "retryable": False,
        }
```

### Structured Error Responses

```python
# Tool handlers return structured errors
async def handle_build_website(params):
    result = await _call_api_with_retry(description)

    if result.get("action") == "error":
        if result.get("retryable"):
            await params.result_callback({
                "message": result["message"],
                "status": "temporary_error",
                "suggestion": "Tell the user the system is busy and you'll try again shortly."
            })
        else:
            await params.result_callback({
                "message": result["message"],
                "status": "permanent_error",
                "suggestion": "Apologize and suggest the user try again in a few minutes."
            })
        return

    # ... normal success path
```

---

## Implementation Steps

1. Create `voice-server/src/services/circuit_breaker.py`
2. Create `voice-server/src/services/retry.py`
3. Instantiate `CircuitBreaker` for builder API (shared across all tool handlers)
4. Replace `_call_api_with_retry` with circuit breaker + backoff version
5. Add structured error responses to all tool handlers that call builder API
6. Add logging for circuit state transitions (open/close)
7. Add error broadcasting to frontend (optional: show "service recovering" indicator)

---

## Test Cases

### Unit Tests: `voice-server/tests/test_circuit_breaker.py`

| # | Test | Description | Expected |
|---|------|-------------|----------|
| 1 | `test_closed_state_passes_through` | Circuit closed, call succeeds | Returns result |
| 2 | `test_failure_increments_count` | Call fails | `_failure_count == 1` |
| 3 | `test_opens_after_threshold` | 3 failures | `state == CircuitState.OPEN` |
| 4 | `test_open_circuit_fast_fails` | Circuit open, new call | Raises `CircuitOpenError` immediately |
| 5 | `test_half_open_after_timeout` | Circuit open, wait recovery_timeout | `state == CircuitState.HALF_OPEN` |
| 6 | `test_half_open_success_closes` | Half-open, call succeeds | `state == CircuitState.CLOSED` |
| 7 | `test_half_open_failure_reopens` | Half-open, call fails | `state == CircuitState.OPEN` |
| 8 | `test_success_resets_failure_count` | 2 failures then success | `_failure_count == 0` |

### Unit Tests: `voice-server/tests/test_retry_backoff.py`

| # | Test | Description | Expected |
|---|------|-------------|----------|
| 1 | `test_succeeds_first_try` | No failures | Function called once |
| 2 | `test_retries_on_timeout` | First call times out, second succeeds | Function called twice |
| 3 | `test_retries_on_http_error` | First call returns 500, second succeeds | Function called twice |
| 4 | `test_exponential_delay` | Track sleep times | Delays are 1s, 2s |
| 5 | `test_max_retries_exceeded` | All calls fail | Raises last exception after max_retries+1 attempts |
| 6 | `test_non_retryable_fails_immediately` | ValueError raised | No retry, raises immediately |
| 7 | `test_respects_max_retries_param` | `max_retries=0` | Only 1 attempt |

### Integration Tests: `voice-server/tests/test_api_resilience.py`

| # | Test | Description | Expected |
|---|------|-------------|----------|
| 1 | `test_build_website_circuit_open_returns_error` | Circuit open | Handler returns user-friendly error |
| 2 | `test_edit_website_circuit_open_returns_error` | Circuit open | Handler returns user-friendly error |
| 3 | `test_circuit_recovers_after_timeout` | Open, wait, retry | Succeeds after recovery |

---

## Acceptance Criteria

- [ ] Builder API failures don't cause silent AI pauses
- [ ] Circuit opens after 3 consecutive failures
- [ ] Circuit auto-recovers after 30 seconds
- [ ] Retry uses exponential backoff (1s, 2s, 4s)
- [ ] Non-retryable errors (400, auth) fail immediately
- [ ] Tool handlers return structured errors the AI can act on
- [ ] Circuit state transitions are logged
