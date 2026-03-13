"""Tool: send_builder_link — Prepare the website builder link for the user."""

import asyncio
import logging

from src.tools._base import ToolDefinition, ToolContext
from src.services.call_session import save_call_message, update_call_state
from src.services.twilio_sms import send_sms

logger = logging.getLogger(__name__)


async def handle(ctx: ToolContext, params):
    logger.info(f"[{ctx.identity.call_sid}] send_builder_link called, phone='{ctx.identity.phone_number}'")
    links_url = f"{ctx.identity.builder_api_url}/links"
    try:
        await params.result_callback(
            {
                "message": (
                    f"A text message with the link has been sent to the user's phone. "
                    f"Tell them to check their texts and tap the link. "
                    f"If they don't see the text, spell out the URL as a backup: "
                    f"pravik-builder dot vercel dot app slash links. "
                    f"Once they open it, they'll see their website being built in real time."
                )
            }
        )
        ctx.state.mark_link_sent()

        async def _background():
            try:
                await update_call_state(ctx.identity.call_sid, "waiting_for_page")
                if ctx.identity.phone_number:
                    sms_body = (
                        f"Your website builder is ready! Open this link to see your "
                        f"website being built in real time: {links_url}"
                    )
                    logger.info(f"[{ctx.identity.call_sid}] Sending SMS to {ctx.identity.phone_number}...")
                    sms_sid = await send_sms(ctx.identity.phone_number, sms_body)
                    logger.info(f"[{ctx.identity.call_sid}] SMS sent: {sms_sid}")
                else:
                    logger.warning(f"[{ctx.identity.call_sid}] No phone number — SMS skipped")
                await save_call_message(
                    call_session_id=ctx.identity.session_id,
                    role="system",
                    content=f"Builder link sent via SMS: {links_url} (project: {ctx.state.project_id})",
                )
            except Exception as bg_err:
                logger.error(f"[{ctx.identity.call_sid}] Background SMS/DB failed: {bg_err}")

        asyncio.create_task(_background())
    except Exception as err:
        logger.error(f"[{ctx.identity.call_sid}] Failed to send builder link: {err}")
        await params.result_callback(
            {"message": "Failed to send the link. Ask the user to try again."}
        )


TOOL = ToolDefinition(
    name="send_builder_link",
    description=(
        "Prepare the website builder link for the user. Call this when the user agrees to start building. "
        "The user will be directed to open a simple URL on their phone."
    ),
    parameters={"type": "object", "properties": {}, "required": []},
    handle=handle,
    timeout=15,
    prompt_instructions="",
    returning_user_only=False,
)
