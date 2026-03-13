"""Twilio phone number provisioning and call forwarding.

Provisions local US phone numbers via Twilio's API and configures them
to forward incoming calls to the website owner's real phone number.
"""

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


def _provision_sync(area_code: str, voice_webhook_url: str) -> dict:
    """Search for and buy a local number (sync — Twilio SDK is sync).

    Args:
        area_code: 3-digit US area code (e.g. "512").
        voice_webhook_url: URL Twilio will POST to when the number is called.

    Returns:
        {"phone_number": "+15125551234", "phone_sid": "PN..."}
    """
    client = _get_client()

    # Search for available local numbers in the given area code
    available = client.available_phone_numbers("US").local.list(
        area_code=area_code,
        voice_enabled=True,
        limit=1,
    )

    if not available:
        raise ValueError(f"No phone numbers available in area code {area_code}")

    number = available[0]

    # Purchase the number and set the voice webhook
    purchased = client.incoming_phone_numbers.create(
        phone_number=number.phone_number,
        voice_url=voice_webhook_url,
        voice_method="POST",
        friendly_name=f"Pravik Builder - {area_code}",
    )

    logger.info(
        f"Provisioned {purchased.phone_number} (SID: {purchased.sid}) "
        f"in area code {area_code}"
    )

    return {
        "phone_number": purchased.phone_number,
        "phone_sid": purchased.sid,
    }


def _release_sync(phone_sid: str) -> None:
    """Release a provisioned phone number (sync)."""
    client = _get_client()
    client.incoming_phone_numbers(phone_sid).delete()
    logger.info(f"Released phone number SID: {phone_sid}")


async def provision_phone_number(
    area_code: str,
    voice_webhook_url: str,
) -> dict:
    """Buy a Twilio local number and configure its voice webhook.

    Runs in a thread executor since the Twilio SDK is synchronous.

    Args:
        area_code: 3-digit US area code.
        voice_webhook_url: Webhook URL for incoming calls.

    Returns:
        {"phone_number": "+15125551234", "phone_sid": "PN..."}
    """
    return await asyncio.to_thread(_provision_sync, area_code, voice_webhook_url)


async def release_phone_number(phone_sid: str) -> None:
    """Release a provisioned phone number.

    Runs in a thread executor since the Twilio SDK is synchronous.
    """
    await asyncio.to_thread(_release_sync, phone_sid)
