"""Tool: setup_phone_number — Provision a dedicated business phone number for the website."""

import asyncio
import logging

from src.tools._base import ToolDefinition, ToolContext
from src.tools._helpers import call_api_with_retry, inject_site_context
from src.services.call_session import save_call_message
from src.services.realtime import broadcast_preview_update, broadcast_step_completed
from src.services.supabase_client import get_supabase_client
from src.services.twilio_phone import provision_phone_number

logger = logging.getLogger(__name__)


async def handle(ctx: ToolContext, params):
    area_code = params.arguments.get("area_code", "").strip()
    if not area_code or len(area_code) != 3 or not area_code.isdigit():
        await params.result_callback(
            {"message": "I need a valid 3-digit US area code. Ask the user for their preferred area code."}
        )
        return

    try:
        webhook_url = f"{ctx.identity.builder_api_url}/api/webhooks/twilio/call-forward"
        result = await provision_phone_number(area_code, webhook_url)
        phone_number = result["phone_number"]
        phone_sid = result["phone_sid"]

        supabase = await get_supabase_client()
        await (
            supabase.table("projects")
            .update({"provisioned_phone": phone_number, "provisioned_phone_sid": phone_sid})
            .eq("id", ctx.state.project_id)
            .execute()
        )

        digits = phone_number.lstrip("+1")
        display_number = f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"

        edit_instruction = (
            f"Add the business phone number {display_number} to the website. "
            f"Display it prominently in the contact section and in the footer. "
            f"Make it clickable (tel: link)."
        )
        try:
            edit_result = await call_api_with_retry(ctx, edit_instruction)
            if edit_result.get("action") != "error":
                await broadcast_preview_update(
                    ctx.identity.call_sid,
                    action=edit_result.get("action", "edited"),
                    message=edit_result.get("message", ""),
                    project_id=ctx.state.project_id,
                )
            else:
                logger.warning(f"[{ctx.identity.call_sid}] Failed to add phone to website: {edit_result.get('message')}")
        except Exception as edit_err:
            logger.warning(f"[{ctx.identity.call_sid}] Failed to add phone to website: {edit_err}")

        await save_call_message(
            call_session_id=ctx.identity.session_id,
            role="assistant",
            content=f"Provisioned phone number {display_number} for project {ctx.state.project_id}",
            intent="setup_phone_number",
        )

        await params.result_callback(
            {
                "message": (
                    f"Phone number provisioned successfully! The new business number is {display_number}. "
                    f"It has been added to the website. Tell the user their new number and that it's on "
                    f"their website. Then explain that the number can forward calls to their phone — "
                    f"ask if they want calls forwarded to the number they're calling from, or a different "
                    f"number. Then call setup_call_forwarding with their choice."
                )
            }
        )
        asyncio.create_task(broadcast_step_completed(ctx.identity.call_sid, "phone_number"))
        asyncio.create_task(inject_site_context(ctx))
    except ValueError as ve:
        logger.warning(f"[{ctx.identity.call_sid}] Phone provision error: {ve}")
        await params.result_callback(
            {
                "message": (
                    f"Sorry, no phone numbers are available in area code {area_code}. "
                    f"Ask the user if they'd like to try a different area code."
                )
            }
        )
    except Exception as err:
        logger.error(f"[{ctx.identity.call_sid}] Phone provision failed: {err}", exc_info=True)
        await params.result_callback(
            {"message": "Sorry, there was an error setting up the phone number. Please try again."}
        )


TOOL = ToolDefinition(
    name="setup_phone_number",
    description=(
        "Provision a dedicated business phone number for the website. "
        "Call this when the user agrees to get a phone number for their website. "
        "The number will forward calls to the user's real phone. "
        "Ask the user what area code they want before calling this tool."
    ),
    parameters={
        "type": "object",
        "properties": {
            "area_code": {
                "type": "string",
                "description": "The 3-digit US area code (e.g. '512' for Austin, '415' for SF, '212' for NYC)",
            },
        },
        "required": ["area_code"],
    },
    handle=handle,
    timeout=30,
    prompt_instructions="""\
PHONE NUMBER PROVISIONING:
- After the website is built and the user seems satisfied, proactively offer: "By the way, would you like a dedicated phone number for your website? I can get you a local number that forwards calls straight to your phone."
- If they say yes, ask what area code they'd like: "What area code would you like? If your business is local, I can get a number in your area."
- If they give a city name instead of an area code, infer the area code (e.g. Austin = 512, San Francisco = 415, New York = 212, Los Angeles = 310, Chicago = 312, Houston = 713, Miami = 305, Dallas = 214, Seattle = 206, Denver = 303, Phoenix = 480, Atlanta = 404).
- Call setup_phone_number with the area code.
- After provisioning, confirm the number and tell them it's been added to their website.
- Do NOT offer this before the website is built. Only after they've seen their site and are happy with it.
- Only offer ONCE per call. If they decline, don't bring it up again.""",
    returning_user_only=False,
)
