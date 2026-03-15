"""Tool: ah_save_caller_info — Save caller's name, reason, and contact info (after-hours AI)."""

import logging
from datetime import datetime, timezone

from src.tools._base import ToolDefinition, AfterHoursContext
from src.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)


async def handle(ctx: AfterHoursContext, params):
    caller_name = params.arguments.get("caller_name", "").strip()
    reason = params.arguments.get("reason", "").strip()
    callback_number = params.arguments.get("callback_number", "").strip()

    if not reason:
        await params.result_callback(
            {"message": "I need to know the reason for their call. Ask the caller what they're calling about."}
        )
        return

    # Update context state
    if caller_name:
        ctx.caller_name = caller_name
    ctx.caller_reason = reason

    try:
        supabase = await get_supabase_client()
        await (
            supabase.table("tool_submissions")
            .insert({
                "tool_id": ctx.tool_id,
                "data": {
                    "caller_name": caller_name or "Unknown",
                    "caller_phone": callback_number or ctx.caller_phone,
                    "reason": reason,
                    "call_sid": ctx.call_sid,
                    "called_at": datetime.now(timezone.utc).isoformat(),
                },
            })
            .execute()
        )
        ctx.info_saved = True
        logger.info(f"[{ctx.call_sid}] Saved caller info: {caller_name or 'Unknown'} — {reason[:50]}")

        await params.result_callback(
            {
                "message": (
                    "Message saved successfully. Let the caller know their message has been "
                    "received and the team will get back to them during business hours. "
                    "Ask if there's anything else you can help with."
                )
            }
        )
    except Exception as err:
        logger.error(f"[{ctx.call_sid}] ah_save_caller_info failed: {err}", exc_info=True)
        await params.result_callback(
            {"message": "Sorry, there was an error saving the message. Apologize and ask them to try calling back."}
        )


TOOL = ToolDefinition(
    name="save_caller_info",
    description=(
        "Save the caller's name, phone number, and reason for calling. "
        "Use this after gathering information from the caller to leave a message "
        "for the business owner."
    ),
    parameters={
        "type": "object",
        "properties": {
            "caller_name": {
                "type": "string",
                "description": "The caller's name, if they provided it.",
            },
            "reason": {
                "type": "string",
                "description": "Why the caller is calling — their message for the business.",
            },
            "callback_number": {
                "type": "string",
                "description": (
                    "A different callback number if the caller wants to be reached at a "
                    "number other than the one they're calling from. Only include if they "
                    "explicitly provide a different number."
                ),
            },
        },
        "required": ["reason"],
    },
    handle=handle,
    timeout=15,
    mode="after_hours",
    prompt_instructions="""\
TAKING MESSAGES:
- Always ask for the caller's name: "Can I get your name so the team knows who called?"
- Always ask why they're calling: "And what's the best way to describe why you're calling?"
- Their phone number is already captured automatically — don't ask for it unless they want a different callback number.
- After gathering info, call save_caller_info immediately.
- Confirm after saving: "Got it! I'll make sure the team gets your message and they'll get back to you during business hours."
- If they mention it's urgent, acknowledge that and still save the message.""",
)
