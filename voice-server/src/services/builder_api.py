"""HTTP client for calling the Builder API + Supabase queries."""

import logging
from typing import Any

import httpx

from src.services.supabase_client import get_supabase_client

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


async def fetch_site_state(project_id: str) -> dict[str, Any]:
    """Fetch current blocks and tools for a project.

    Returns {blocks: [{block_type, position}], tools: [{tool_type, config}]}.
    """
    supabase = await get_supabase_client()

    blocks_resp = await (
        supabase.table("blocks")
        .select("block_type, position")
        .eq("project_id", project_id)
        .order("position")
        .execute()
    )

    tools_resp = await (
        supabase.table("tools")
        .select("tool_type, config")
        .eq("project_id", project_id)
        .execute()
    )

    return {
        "blocks": blocks_resp.data or [],
        "tools": tools_resp.data or [],
    }
