"""Shared helper functions for tool handlers."""

import logging
from typing import Any

from src.services.builder_api import call_builder_api, fetch_site_state
from src.services.call_session import save_call_message, update_call_state
from src.services.circuit_breaker import CircuitBreaker, CircuitOpenError
from src.services.retry import retry_with_backoff
from src.services.supabase_client import get_supabase_client
from src.services.twilio_sms import send_sms
from src.tools._base import ToolContext

logger = logging.getLogger(__name__)


def make_error_result(
    message: str,
    *,
    retryable: bool = False,
    suggestion: str = "",
) -> dict[str, Any]:
    """Build a consistent error result dict for tool handlers."""
    if not suggestion:
        suggestion = (
            "Tell the user the system is temporarily busy and ask them to try again in a moment."
            if retryable
            else "Apologize to the user and suggest trying a different approach."
        )
    return {
        "message": message,
        "status": "temporary_error" if retryable else "permanent_error",
        "retryable": retryable,
        "suggestion": suggestion,
    }


# Shared circuit breaker for the Builder API — one instance across all tool handlers.
# Opens after 3 consecutive failures, recovers after 30 seconds.
builder_api_circuit = CircuitBreaker(
    failure_threshold=3,
    recovery_timeout=30.0,
    name="builder_api",
)


async def send_sms_if_needed(ctx: ToolContext):
    """Auto-send the builder link SMS if the AI skipped send_builder_link."""
    if ctx.state.link_sent or ctx.state.page_opened:
        if ctx.state.page_opened:
            logger.info(f"[{ctx.identity.call_sid}] Page already open — skipping auto SMS")
        return
    ctx.state.mark_link_sent()
    links_url = f"{ctx.identity.builder_api_url}/links"
    if ctx.identity.phone_number:
        try:
            sms_body = (
                f"Your website builder is ready! Open this link to see your "
                f"website being built in real time: {links_url}"
            )
            logger.info(f"[{ctx.identity.call_sid}] Auto-sending SMS (AI skipped send_builder_link)...")
            sms_sid = await send_sms(ctx.identity.phone_number, sms_body)
            logger.info(f"[{ctx.identity.call_sid}] Auto SMS sent: {sms_sid}")
        except Exception as e:
            logger.error(f"[{ctx.identity.call_sid}] Auto SMS failed: {e}")
    else:
        logger.warning(f"[{ctx.identity.call_sid}] No phone number — auto SMS skipped")


async def call_api_with_retry(
    ctx: ToolContext,
    message: str,
    image_urls: list[str] | None = None,
) -> dict[str, Any]:
    """Call builder API through circuit breaker with exponential backoff.

    Returns a dict with {action, message}. On failure, returns a structured
    error dict with action="error" so tool handlers can give the AI useful
    guidance rather than going silent.
    """
    try:
        return await builder_api_circuit.call(
            retry_with_backoff,
            call_builder_api,
            ctx.identity.builder_api_url,
            message,
            ctx.state.project_id,
            image_urls=image_urls,
            max_retries=2,
            base_delay=1.0,
        )
    except CircuitOpenError:
        logger.warning(f"[{ctx.identity.call_sid}] Builder API circuit open — fast-failing")
        return {
            "action": "error",
            "message": (
                "The website builder is temporarily unavailable. "
                "Please wait a moment and try again."
            ),
            "retryable": True,
        }
    except Exception as e:
        logger.error(f"[{ctx.identity.call_sid}] Builder API failed after retries: {e}")
        return {
            "action": "error",
            "message": f"Failed to reach the builder service: {type(e).__name__}",
            "retryable": False,
        }


async def inject_site_context(ctx: ToolContext):
    """Fetch current site state and inject as silent context into the LLM."""
    if not ctx.llm_ref:
        return
    try:
        state = await fetch_site_state(ctx.state.project_id)
        blocks = state.get("blocks", [])
        tools = state.get("tools", [])

        if not blocks:
            return

        block_list = ", ".join(b["block_type"] for b in blocks)

        tool_summary = ""
        for t in tools:
            if t.get("tool_type") == "booking":
                cfg = t.get("config") or {}
                fields = ", ".join(f.get("label", f.get("name", "?")) for f in cfg.get("fields", []))
                tool_summary = f" Booking form: title=\"{cfg.get('title', '')}\", fields=[{fields}]."

        context_text = (
            f"[SITE STATE: Website sections: {block_list}.{tool_summary} "
            f"Use this when the user asks about what's on their site.]"
        )

        import pipecat.services.openai.realtime.events as events

        item = events.ConversationItem(
            type="message",
            role="user",
            content=[events.ItemContent(type="input_text", text=context_text)],
        )
        await ctx.llm_ref.send_client_event(events.ConversationItemCreateEvent(item=item))
        logger.info(f"[{ctx.identity.call_sid}] Site context injected: {len(blocks)} blocks{', has form' if tool_summary else ''}")
    except Exception as e:
        logger.warning(f"[{ctx.identity.call_sid}] Failed to inject site context: {e}")
