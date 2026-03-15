"""Tool: setup_after_hours — Configure the after-hours AI phone agent (builder tool for Timmy)."""

import asyncio
import logging

from src.tools._base import ToolDefinition, ToolContext
from src.services.call_session import save_call_message
from src.services.realtime import broadcast_step_completed
from src.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

# Common timezone aliases → IANA timezone names
_TIMEZONE_ALIASES = {
    "eastern": "America/New_York",
    "est": "America/New_York",
    "et": "America/New_York",
    "central": "America/Chicago",
    "cst": "America/Chicago",
    "ct": "America/Chicago",
    "mountain": "America/Denver",
    "mst": "America/Denver",
    "mt": "America/Denver",
    "pacific": "America/Los_Angeles",
    "pst": "America/Los_Angeles",
    "pt": "America/Los_Angeles",
    "alaska": "America/Anchorage",
    "hawaii": "Pacific/Honolulu",
}


def _normalize_timezone(tz: str) -> str:
    """Convert common timezone abbreviations to IANA format."""
    lower = tz.strip().lower().replace(" time", "").replace(" standard", "")
    return _TIMEZONE_ALIASES.get(lower, tz.strip())


async def handle(ctx: ToolContext, params):
    timezone_raw = params.arguments.get("timezone", "").strip()
    open_time = params.arguments.get("open_time", "09:00").strip()
    close_time = params.arguments.get("close_time", "17:00").strip()
    days = params.arguments.get("days", [1, 2, 3, 4, 5])
    business_name = params.arguments.get("business_name", "").strip()

    if not timezone_raw:
        await params.result_callback(
            {"message": "I need to know their timezone. Ask the user what timezone they're in."}
        )
        return

    if not business_name:
        await params.result_callback(
            {"message": "I need the business name for the AI greeting. Ask the user what their business is called."}
        )
        return

    timezone = _normalize_timezone(timezone_raw)

    try:
        supabase = await get_supabase_client()

        config = {
            "enabled": True,
            "timezone": timezone,
            "schedule": {
                "open": open_time,
                "close": close_time,
                "days": days,
            },
            "greeting_name": business_name,
            "transfer_enabled": True,
        }

        # Check if an after_hours_ai tool already exists for this project
        existing = await (
            supabase.table("tools")
            .select("id")
            .eq("project_id", ctx.state.project_id)
            .eq("tool_type", "after_hours_ai")
            .execute()
        )

        if existing.data:
            # Update existing config
            await (
                supabase.table("tools")
                .update({"config": config, "is_active": True})
                .eq("id", existing.data[0]["id"])
                .execute()
            )
            logger.info(f"[{ctx.identity.call_sid}] Updated after-hours AI config for project {ctx.state.project_id}")
        else:
            # Create new tool row
            await (
                supabase.table("tools")
                .insert({
                    "project_id": ctx.state.project_id,
                    "tool_type": "after_hours_ai",
                    "config": config,
                    "is_active": True,
                })
                .execute()
            )
            logger.info(f"[{ctx.identity.call_sid}] Created after-hours AI config for project {ctx.state.project_id}")

        # Format days for user-friendly display
        day_names = {1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday",
                     5: "Friday", 6: "Saturday", 7: "Sunday"}
        days_display = ", ".join(day_names.get(d, str(d)) for d in sorted(days))

        await params.result_callback(
            {
                "message": (
                    f"After-hours AI is set up! The AI will answer calls to the business number "
                    f"outside of {open_time} to {close_time} ({timezone}), {days_display}. "
                    f"Tell the user their after-hours assistant is ready. When someone calls "
                    f"outside business hours, the AI will answer as '{business_name}', "
                    f"take messages, and answer basic questions about the business."
                )
            }
        )

        # Fire-and-forget: save message, complete step
        async def _post_setup():
            try:
                await asyncio.gather(
                    save_call_message(
                        call_session_id=ctx.identity.session_id,
                        role="assistant",
                        content=f"Set up after-hours AI for {business_name} ({open_time}-{close_time} {timezone})",
                        intent="setup_after_hours",
                    ),
                    broadcast_step_completed(ctx.identity.call_sid, "ai_phone"),
                )
            except Exception as bg_err:
                logger.warning(f"[{ctx.identity.call_sid}] setup_after_hours background: {bg_err}")

        asyncio.create_task(_post_setup())

    except Exception as err:
        logger.error(f"[{ctx.identity.call_sid}] setup_after_hours failed: {err}", exc_info=True)
        await params.result_callback(
            {"message": "Sorry, there was an error setting up the after-hours AI. Please try again."}
        )


TOOL = ToolDefinition(
    name="setup_after_hours_ai",
    description=(
        "Set up the AI phone agent to answer calls after business hours. "
        "This creates an AI assistant that will answer incoming calls when the business "
        "is closed — it takes messages, answers basic questions about the business, "
        "and can transfer calls to the owner if needed."
    ),
    parameters={
        "type": "object",
        "properties": {
            "timezone": {
                "type": "string",
                "description": (
                    "The business timezone. Can be IANA format (e.g. 'America/Chicago') "
                    "or common name (e.g. 'Central', 'EST', 'Pacific')."
                ),
            },
            "open_time": {
                "type": "string",
                "description": "Business opening time in HH:MM 24-hour format (e.g. '09:00'). Defaults to '09:00'.",
            },
            "close_time": {
                "type": "string",
                "description": "Business closing time in HH:MM 24-hour format (e.g. '17:00'). Defaults to '17:00'.",
            },
            "days": {
                "type": "array",
                "items": {"type": "integer"},
                "description": (
                    "ISO day numbers when the business is open (1=Monday through 7=Sunday). "
                    "Defaults to [1,2,3,4,5] (Monday-Friday)."
                ),
            },
            "business_name": {
                "type": "string",
                "description": "The business name to use in the AI greeting (e.g. 'Acme Plumbing').",
            },
        },
        "required": ["timezone", "business_name"],
    },
    handle=handle,
    timeout=15,
    mode="builder",
    prompt_instructions="""\
AFTER-HOURS AI SETUP:
- After call forwarding is set up, proactively offer: "One more thing — I can set up an AI assistant to answer your business calls when you're closed. It'll take messages and answer basic questions about your business. Want me to set that up?"
- If they say yes, ask: "What are your business hours? Like 9 to 5, Monday through Friday?"
- Also ask: "And what timezone are you in?" If they say something like "Central" or "CST", just pass that — I'll convert it.
- Use the business name from their website if you know it. Otherwise ask: "What's your business called?"
- Convert spoken times to 24-hour format: "9 to 5" → open_time="09:00", close_time="17:00". "8am to 6pm" → open_time="08:00", close_time="18:00".
- After setup, confirm: "All set! When someone calls outside your business hours, the AI will answer, take their message, and you'll be able to see all the messages on your dashboard."
- If they say no or want to skip, that's fine — don't push it. Say "No problem, you can always set it up later."
- If they already have call forwarding set up but NOT after-hours AI, mention it proactively.""",
    returning_user_only=False,
)
