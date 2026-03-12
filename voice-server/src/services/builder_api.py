"""HTTP client for calling the Builder API."""

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)


async def call_builder_api(
    base_url: str,
    message: str,
    project_id: str,
    image_urls: list[str] | None = None,
) -> dict[str, Any]:
    """POST to /api/builder/generate and return {action, message}."""
    body: dict[str, Any] = {"message": message, "project_id": project_id}
    if image_urls:
        body["image_urls"] = image_urls

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{base_url}/api/builder/generate",
            json=body,
        )
        response.raise_for_status()
        return response.json()
