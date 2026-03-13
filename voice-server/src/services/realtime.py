"""Supabase Realtime broadcast operations for live voice call updates."""

import asyncio
import logging
import time
from typing import Any, Callable

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

    channel.on_broadcast("page_opened", _on_page_opened)
    channel.on_broadcast("web_action", _on_web_action)
    await channel.subscribe()
    logger.info(f"[{call_sid}] Subscribed to Realtime channel")


async def broadcast_preview_update(
    call_sid: str,
    action: str,
    message: str,
    project_id: str,
) -> None:
    """Broadcast preview_updated event to the browser."""
    channel = await _get_channel(call_sid)
    await channel.send_broadcast(
        "preview_updated",
        {
            "action": action,
            "message": message,
            "projectId": project_id,
            "timestamp": int(time.time() * 1000),
        },
    )


async def broadcast_voice_message(
    call_sid: str,
    role: str,
    content: str,
) -> None:
    """Broadcast voice_message event (user/assistant transcript)."""
    channel = await _get_channel(call_sid)
    await channel.send_broadcast(
        "voice_message",
        {
            "role": role,
            "content": content,
            "timestamp": int(time.time() * 1000),
        },
    )


async def broadcast_project_selected(call_sid: str, project_id: str) -> None:
    """Broadcast project_selected event to the frontend (dashboard/build page)."""
    channel = await _get_channel(call_sid)
    await channel.send_broadcast(
        "project_selected",
        {
            "projectId": project_id,
            "timestamp": int(time.time() * 1000),
        },
    )


async def broadcast_open_action_menu(call_sid: str) -> None:
    """Broadcast open_action_menu event to show the action steps drawer."""
    channel = await _get_channel(call_sid)
    await channel.send_broadcast(
        "open_action_menu",
        {"timestamp": int(time.time() * 1000)},
    )


async def broadcast_close_action_menu(call_sid: str) -> None:
    """Broadcast close_action_menu event to hide the action steps drawer."""
    channel = await _get_channel(call_sid)
    await channel.send_broadcast(
        "close_action_menu",
        {"timestamp": int(time.time() * 1000)},
    )


async def broadcast_step_completed(call_sid: str, step_id: str) -> None:
    """Broadcast step_completed event to check off a step in the drawer."""
    channel = await _get_channel(call_sid)
    await channel.send_broadcast(
        "step_completed",
        {
            "stepId": step_id,
            "timestamp": int(time.time() * 1000),
        },
    )


async def broadcast_call_ended(call_sid: str) -> None:
    """Broadcast call_ended event."""
    channel = await _get_channel(call_sid)
    await channel.send_broadcast(
        "call_ended",
        {"timestamp": int(time.time() * 1000)},
    )


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
    """Inject a web page action as context into the OpenAI Realtime session.

    Uses conversation.item.create + response.create to make the AI
    immediately aware of and respond to web page events.
    """
    import pipecat.services.openai.realtime.events as events

    # Build context message based on action type
    image_urls = payload.get("imageUrls", [])
    message_text = payload.get("message", "")

    if action_type == "page_opened":
        context_text = (
            "[WEB PAGE UPDATE: The user just opened the builder page on their phone. "
            "Briefly acknowledge it — something like 'Great, I see you have the page open!' "
            "Then continue with the conversation naturally. Do NOT repeat the greeting or re-introduce yourself.]"
        )
    elif action_type == "text_message_sent":
        if image_urls:
            urls_str = ", ".join(image_urls)
            context_text = (
                f"[WEB PAGE UPDATE: The user just uploaded {'an image' if len(image_urls) == 1 else f'{len(image_urls)} images'} "
                f"on the web page and typed: \"{message_text}\". "
                f"Image URLs: {urls_str}. "
                f"Acknowledge the image upload naturally. If they described what to do with it, "
                f"go ahead and use the edit_website or build_website tool. "
                f"The image URLs will be automatically included when you call the tool.]"
            )
        else:
            context_text = (
                f"[WEB PAGE UPDATE: The user typed a message on the web page: \"{message_text}\". "
                f"The builder already processed this request on the page. "
                f"Briefly acknowledge it — say something like 'I see you made a change on the page' — "
                f"and ask if there's anything else they'd like to adjust.]"
            )
    elif action_type == "project_selected_from_web":
        project_id = payload.get("projectId", "")
        context_text = (
            f"[WEB PAGE UPDATE: The user just selected a project from the dashboard on their phone. "
            f"Project ID: {project_id}. "
            f"Acknowledge this naturally — say something like 'Great choice, let me pull that up!' "
            f"Then call select_project with project_id=\"{project_id}\" to load the context.]"
        )
    elif action_type == "new_project_requested":
        context_text = (
            "[WEB PAGE UPDATE: The user tapped 'Build New Website' on the dashboard. "
            "Acknowledge this — 'Awesome, let's start fresh!' Then call create_new_project.]"
        )
    elif action_type == "step_selected":
        step_label = payload.get("stepLabel", "a step")
        context_text = (
            f"[WEB PAGE UPDATE: The user tapped '{step_label}' in the action steps menu. "
            f"They want to work on this next. Acknowledge their choice and proceed to help them with it.]"
        )
    elif action_type == "image_uploaded":
        urls_str = ", ".join(image_urls) if image_urls else "unknown"
        context_text = (
            f"[WEB PAGE UPDATE: The user just uploaded {'an image' if len(image_urls) == 1 else f'{len(image_urls)} images'} "
            f"on the web page. Image URLs: {urls_str}. "
            f"Acknowledge the upload and ask what they'd like to do with it — "
            f"use it as a hero background, section image, logo, etc. "
            f"The image URLs will be automatically included when you call the build or edit tool.]"
        )
    else:
        context_text = (
            f"[WEB PAGE UPDATE: The user performed an action on the web page: {action_type}. "
            f"Details: {payload}. Acknowledge this naturally.]"
        )

    try:
        # Inject context as a user message into the conversation
        item = events.ConversationItem(
            type="message",
            role="user",
            content=[events.ItemContent(type="input_text", text=context_text)],
        )
        await llm.send_client_event(events.ConversationItemCreateEvent(item=item))

        # Trigger the AI to respond to the injected context
        await llm.send_client_event(
            events.ResponseCreateEvent(
                response=events.ResponseProperties(modalities=["audio", "text"])
            )
        )
        logger.info(f"Injected web context into LLM: {action_type}")
    except Exception as e:
        logger.error(f"Failed to inject web context into LLM: {e}", exc_info=True)
