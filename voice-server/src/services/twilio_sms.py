"""Twilio SMS sending service."""

import asyncio
import logging

from twilio.rest import Client

from src.config import config

logger = logging.getLogger(__name__)

_client: Client | None = None


def _get_client() -> Client:
    global _client
    if _client is None:
        _client = Client(config.twilio_account_sid, config.twilio_auth_token)
    return _client


def _send_sms_sync(to: str, body: str) -> str:
    """Send SMS synchronously (Twilio SDK is sync).

    Uses Messaging Service SID for A2P 10DLC compliance when available,
    falls back to direct phone number.
    """
    client = _get_client()
    kwargs: dict = {"to": to, "body": body}

    if config.twilio_messaging_service_sid:
        kwargs["messaging_service_sid"] = config.twilio_messaging_service_sid
    else:
        kwargs["from_"] = config.twilio_phone_number

    message = client.messages.create(**kwargs)
    return message.sid


async def send_sms(to: str, body: str) -> str:
    """Send SMS asynchronously by running in a thread executor."""
    return await asyncio.to_thread(_send_sms_sync, to, body)
