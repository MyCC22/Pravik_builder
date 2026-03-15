"""Tool: ah_transfer_call — Transfer an after-hours call to the business owner's phone."""

import asyncio
import logging

from twilio.rest import Client

from src.tools._base import ToolDefinition, AfterHoursContext
from src.config import config

logger = logging.getLogger(__name__)

_client: Client | None = None


def _get_twilio_client() -> Client:
    global _client
    if _client is None:
        _client = Client(config.twilio_account_sid, config.twilio_auth_token)
    return _client


async def handle(ctx: AfterHoursContext, params):
    if not ctx.transfer_enabled:
        await params.result_callback(
            {
                "message": (
                    "Call transfer is not available right now. Let the caller know someone "
                    "will call them back during business hours. Offer to take a message instead."
                )
            }
        )
        return

    if not ctx.forwarding_phone:
        await params.result_callback(
            {
                "message": (
                    "No forwarding number is configured. Let the caller know someone "
                    "will call them back during business hours. Offer to take a message instead."
                )
            }
        )
        return

    try:
        client = _get_twilio_client()

        # Build TwiML to redirect the call to the owner's phone
        twiml = (
            '<?xml version="1.0" encoding="UTF-8"?>'
            "<Response>"
            f"<Say>Please hold while I connect you.</Say>"
            f"<Dial>{ctx.forwarding_phone}</Dial>"
            "</Response>"
        )

        # Update the live call via Twilio REST API to redirect it
        await asyncio.to_thread(
            lambda: client.calls(ctx.call_sid).update(twiml=twiml)
        )

        logger.info(f"[{ctx.call_sid}] Transferring call to {ctx.forwarding_phone}")

        await params.result_callback(
            {
                "message": (
                    "Transferring the call now. The caller is being connected to the business owner's phone. "
                    "You don't need to say anything else — the call will be redirected automatically."
                )
            }
        )
    except Exception as err:
        logger.error(f"[{ctx.call_sid}] ah_transfer_call failed: {err}", exc_info=True)
        await params.result_callback(
            {
                "message": (
                    "Sorry, the transfer didn't go through. Let the caller know we couldn't "
                    "connect them right now and offer to take a message instead."
                )
            }
        )


TOOL = ToolDefinition(
    name="transfer_to_owner",
    description=(
        "Transfer the current call to the business owner's phone. "
        "Only use this if the caller insists on speaking to a person and "
        "won't accept leaving a message."
    ),
    parameters={
        "type": "object",
        "properties": {},
        "required": [],
    },
    handle=handle,
    timeout=15,
    mode="after_hours",
    prompt_instructions="""\
CALL TRANSFER:
- Only offer to transfer if the caller explicitly asks to speak to a person.
- Before transferring, save their info first (call save_caller_info) in case the transfer fails or goes to voicemail.
- Say: "Let me try to connect you now. One moment please."
- If transfer is not available, let them know politely: "I'm not able to transfer calls right now, but I'll make sure the team gets your message and calls you back during business hours."
- NEVER proactively offer to transfer — let the caller ask for it.""",
)
