"""Supabase Realtime broadcast operations for live voice call updates."""

import asyncio
import logging
from typing import Any, Callable

from src.events import CallEvent, WebActionType, make_payload
from src.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

# Active channels keyed by call_sid
_channels: dict[str, object] = {}


async def _get_channel(call_sid: str):
    """Get or create a Realtime channel for a call."""
    if call_sid in _channels:
        return _channels[call_sid]
    supabase = await get_supabase_client()
    channel = supabase.channel(f"call:{call_sid}")
    _channels[call_sid] = channel
    return channel


async def subscribe_to_call_channel(
    call_sid: str,
    on_page_opened: Callable,
    on_web_action: Callable | None = None,
) -> None:
    """Subscribe to broadcast events on the call channel."""
    channel = await _get_channel(call_sid)

    def _on_page_opened(payload):
        logger.info(f"[{call_sid}] Page opened event received")
        on_page_opened()

    def _on_web_action(payload):
        logger.info(f"[{call_sid}] Web action received: {payload}")
        if on_web_action:
            on_web_action(payload.get("payload", {}))

    channel.on_broadcast(CallEvent.PAGE_OPENED, _on_page_opened)
    channel.on_broadcast(CallEvent.WEB_ACTION, _on_web_action)
    await channel.subscribe()
    logger.info(f"[{call_sid}] Subscribed to Realtime channel")


async def broadcast_preview_update(
    call_sid: str,
    action: str,
    message: str,
    project_id: str,
) -> bool:
    """Broadcast preview_updated event to the browser. Returns True on success."""
    try:
        channel = await _get_channel(call_sid)
        await channel.send_broadcast(
            CallEvent.PREVIEW_UPDATED,
            make_payload(action=action, message=message, projectId=project_id),
        )
        return True
    except Exception as e:
        logger.warning(f"[{call_sid}] Failed to broadcast {CallEvent.PREVIEW_UPDATED}: {e}")
        return False


async def broadcast_voice_message(
    call_sid: str,
    role: str,
    content: str,
) -> bool:
    """Broadcast voice_message event (user/assistant transcript). Returns True on success."""
    try:
        channel = await _get_channel(call_sid)
        await channel.send_broadcast(
            CallEvent.VOICE_MESSAGE,
            make_payload(role=role, content=content),
        )
        return True
    except Exception as e:
        logger.warning(f"[{call_sid}] Failed to broadcast {CallEvent.VOICE_MESSAGE}: {e}")
        return False


async def broadcast_project_selected(call_sid: str, project_id: str) -> bool:
    """Broadcast project_selected event to the frontend (dashboard/build page). Returns True on success."""
    try:
        channel = await _get_channel(call_sid)
        await channel.send_broadcast(
            CallEvent.PROJECT_SELECTED,
            make_payload(projectId=project_id),
        )
        return True
    except Exception as e:
        logger.warning(f"[{call_sid}] Failed to broadcast {CallEvent.PROJECT_SELECTED}: {e}")
        return False


async def broadcast_open_action_menu(call_sid: str) -> bool:
    """Broadcast open_action_menu event to show the action steps drawer. Returns True on success."""
    try:
        channel = await _get_channel(call_sid)
        await channel.send_broadcast(
            CallEvent.OPEN_ACTION_MENU,
            make_payload(),
        )
        return True
    except Exception as e:
        logger.warning(f"[{call_sid}] Failed to broadcast {CallEvent.OPEN_ACTION_MENU}: {e}")
        return False


async def broadcast_close_action_menu(call_sid: str) -> bool:
    """Broadcast close_action_menu event to hide the action steps drawer. Returns True on success."""
    try:
        channel = await _get_channel(call_sid)
        await channel.send_broadcast(
            CallEvent.CLOSE_ACTION_MENU,
            make_payload(),
        )
        return True
    except Exception as e:
        logger.warning(f"[{call_sid}] Failed to broadcast {CallEvent.CLOSE_ACTION_MENU}: {e}")
        return False


async def broadcast_step_completed(call_sid: str, step_id: str) -> bool:
    """Broadcast step_completed event to check off a step in the drawer. Returns True on success."""
    try:
        channel = await _get_channel(call_sid)
        await channel.send_broadcast(
            CallEvent.STEP_COMPLETED,
            make_payload(stepId=step_id),
        )
        return True
    except Exception as e:
        logger.warning(f"[{call_sid}] Failed to broadcast {CallEvent.STEP_COMPLETED}: {e}")
        return False


async def broadcast_call_ended(call_sid: str) -> bool:
    """Broadcast call_ended event. Returns True on success."""
    try:
        channel = await _get_channel(call_sid)
        await channel.send_broadcast(
            CallEvent.CALL_ENDED,
            make_payload(),
        )
        return True
    except Exception as e:
        logger.warning(f"[{call_sid}] Failed to broadcast {CallEvent.CALL_ENDED}: {e}")
        return False


async def cleanup_channel(call_sid: str) -> None:
    """Remove and unsubscribe from a call channel."""
    channel = _channels.pop(call_sid, None)
    if channel:
        try:
            supabase = await get_supabase_client()
            await supabase.remove_channel(channel)
        except Exception as e:
            logger.warning(f"[{call_sid}] Failed to cleanup channel: {e}")


async def inject_web_context_into_llm(
    llm: Any,
    action_type: str,
    payload: dict[str, Any],
) -> None:
    """Inject a web page action as factual context into the OpenAI Realtime session.

    Uses conversation.item.create to add context. For actionable events, also
    sends response.create to trigger an immediate AI response. For page_opened,
    only injects the context silently — the AI will incorporate it when it next
    speaks, avoiding overlapping audio during the greeting.

    The context text is deliberately factual — it describes WHAT happened, not
    HOW the AI should respond. Response behavior is governed by the general
    "Web events" rules in the system prompt.
    """
    import pipecat.services.openai.realtime.events as events

    image_urls = payload.get("imageUrls", [])
    message_text = payload.get("message", "")

    # page_opened is injected silently — no forced response (the AI is likely
    # mid-greeting and forcing a response creates overlapping audio).
    force_response = action_type != WebActionType.PAGE_OPENED

    # Build factual context — describe what happened, not how to respond.
    if action_type == WebActionType.PAGE_OPENED:
        context_text = "[WEB EVENT: page_opened — The user opened the builder page on their phone.]"

    elif action_type == WebActionType.TEXT_MESSAGE_SENT:
        if image_urls:
            urls_str = ", ".join(image_urls)
            count = len(image_urls)
            context_text = (
                f"[WEB EVENT: text_with_images — The user typed on the web page: "
                f"\"{message_text}\" and uploaded {count} image(s). Image URLs: {urls_str}]"
            )
        else:
            context_text = (
                f"[WEB EVENT: text_message — The user typed on the web page: \"{message_text}\"]"
            )

    elif action_type == WebActionType.PROJECT_SELECTED_FROM_WEB:
        project_id = payload.get("projectId", "")
        context_text = (
            f"[WEB EVENT: project_selected — The user selected a project from the "
            f"dashboard on their phone. Call select_project with project_id: \"{project_id}\". "
            f"Do NOT ask which project — they already chose.]"
        )

    elif action_type == WebActionType.NEW_PROJECT_REQUESTED:
        context_text = (
            "[WEB EVENT: new_project — The user tapped 'Build New Website' on the dashboard. "
            "Call create_new_project, then ask what kind of website they want to build.]"
        )

    elif action_type == WebActionType.STEP_SELECTED:
        step_label = payload.get("stepLabel", "a step")
        context_text = f"[WEB EVENT: step_selected — The user tapped \"{step_label}\" in the action steps menu.]"

    elif action_type == WebActionType.IMAGE_UPLOADED:
        urls_str = ", ".join(image_urls) if image_urls else "unknown"
        count = len(image_urls) if image_urls else 0
        context_text = (
            f"[WEB EVENT: image_uploaded — The user uploaded {count} image(s) "
            f"on the web page. Image URLs: {urls_str}. "
            f"Ask what they want to do with the image(s) — e.g. 'Want me to use that "
            f"as the hero background, or somewhere else on the site?' While processing, "
            f"keep talking: 'I'm swapping that in now, give me just a moment...']"
        )

    else:
        context_text = f"[WEB EVENT: {action_type} — Details: {payload}]"

    try:
        # Inject context as a user message into the conversation
        item = events.ConversationItem(
            type="message",
            role="user",
            content=[events.ItemContent(type="input_text", text=context_text)],
        )
        await llm.send_client_event(events.ConversationItemCreateEvent(item=item))

        if force_response:
            # Trigger the AI to respond to the injected context
            await llm.send_client_event(
                events.ResponseCreateEvent(
                    response=events.ResponseProperties(modalities=["audio", "text"])
                )
            )
            logger.info(f"Injected web context into LLM (with response): {action_type}")
        else:
            logger.info(f"Injected web context into LLM (silent): {action_type}")
    except Exception as e:
        logger.error(f"Failed to inject web context into LLM: {e}", exc_info=True)
