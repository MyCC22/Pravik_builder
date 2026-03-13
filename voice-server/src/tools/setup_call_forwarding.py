"""Tool: setup_call_forwarding — Set which phone number the business number should forward calls to."""

import asyncio
import logging

from src.tools._base import ToolDefinition, ToolContext
from src.services.call_session import save_call_message
from src.services.realtime import broadcast_step_completed
from src.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)


async def handle(ctx: ToolContext, params):
    forwarding_number = params.arguments.get("forwarding_number", "").strip()
    if not forwarding_number:
        await params.result_callback(
            {"message": "I need the phone number to forward calls to. Ask the user for their number."}
        )
        return

    try:
        supabase = await get_supabase_client()
        await (
            supabase.table("projects")
            .update({"forwarding_phone": forwarding_number})
            .eq("id", ctx.state.project_id)
            .execute()
        )

        display = forwarding_number
        if len(forwarding_number) == 12 and forwarding_number.startswith("+1"):
            digits = forwarding_number[2:]
            display = f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"

        await save_call_message(
            call_session_id=ctx.identity.session_id,
            role="assistant",
            content=f"Set call forwarding to {display} for project {ctx.state.project_id}",
            intent="setup_call_forwarding",
        )
        await params.result_callback(
            {
                "message": (
                    f"Call forwarding is set up! Incoming calls to the business number will now "
                    f"ring {display}. Tell the user their calls are all set — anyone who calls "
                    f"the business number will reach them at {display}."
                )
            }
        )
        asyncio.create_task(broadcast_step_completed(ctx.identity.call_sid, "call_forwarding"))
    except Exception as err:
        logger.error(f"[{ctx.identity.call_sid}] setup_call_forwarding failed: {err}", exc_info=True)
        await params.result_callback(
            {"message": "Sorry, there was an error setting up call forwarding. Please try again."}
        )


TOOL = ToolDefinition(
    name="setup_call_forwarding",
    description=(
        "Set which phone number the business number should forward calls to. "
        "Call this after provisioning a phone number. Ask the user for the phone number "
        "they want calls forwarded to — it might be the number they're calling from, or a different one."
    ),
    parameters={
        "type": "object",
        "properties": {
            "forwarding_number": {
                "type": "string",
                "description": (
                    "The phone number to forward calls to, in E.164 format "
                    "(e.g. '+15125551234'). This is the user's personal or business phone."
                ),
            },
        },
        "required": ["forwarding_number"],
    },
    handle=handle,
    timeout=15,
    prompt_instructions="""\
CALL FORWARDING:
- After provisioning a phone number, proactively explain: "By the way, that number will forward calls straight to your phone — so when someone calls your business number, it rings you."
- Then ask: "Want calls to go to the number you're calling from, or a different number?"
- If they say "this number" or "my number", use the phone number they're calling from (ctx.phone_number) and call setup_call_forwarding.
- If they give a different number, use that and call setup_call_forwarding.
- The forwarding number must be in E.164 format (e.g. +15125551234). If the user says "512-555-1234", convert it to "+15125551234".
- After setup, confirm: "All set — when someone calls your business number, it'll ring your phone at [number].\"""",
    returning_user_only=False,
)
