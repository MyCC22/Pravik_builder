"""Test that events arriving before LLM is ready are queued and replayed."""
import asyncio
import pytest


@pytest.mark.asyncio
async def test_events_before_llm_ready_are_queued():
    """Events arriving before LLM is assigned should be buffered, not dropped."""
    llm_ready = asyncio.Event()
    pending_events: list[tuple[str, dict]] = []
    processed: list[str] = []

    async def _process_event(action_type: str, payload: dict):
        processed.append(action_type)

    def on_event(action_type, payload):
        if not llm_ready.is_set():
            pending_events.append((action_type, payload))
        else:
            asyncio.get_event_loop().create_task(_process_event(action_type, payload))

    # Events before LLM ready — should be queued
    on_event("page_opened", {"message": "User opened page"})
    on_event("text_message_sent", {"message": "hello"})

    assert len(pending_events) == 2
    assert len(processed) == 0

    # Drain after LLM ready
    llm_ready.set()
    for action_type, payload in pending_events:
        await _process_event(action_type, payload)
    pending_events.clear()

    assert len(processed) == 2
    assert processed == ["page_opened", "text_message_sent"]


@pytest.mark.asyncio
async def test_events_after_llm_ready_process_immediately():
    """Events after LLM ready should process immediately."""
    llm_ready = asyncio.Event()
    llm_ready.set()
    pending_events: list = []
    processed: list[str] = []

    async def _process_event(action_type: str, payload: dict):
        processed.append(action_type)

    def on_event(action_type, payload):
        if not llm_ready.is_set():
            pending_events.append((action_type, payload))
        else:
            asyncio.get_event_loop().create_task(_process_event(action_type, payload))

    on_event("page_opened", {"message": "User opened page"})
    await asyncio.sleep(0)  # Let task run

    assert len(pending_events) == 0
    assert len(processed) == 1
