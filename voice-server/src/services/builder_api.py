"""HTTP client for calling the Builder API + Supabase queries."""

import asyncio
import logging
import re
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


async def fetch_user_projects(user_id: str) -> list[dict[str, Any]]:
    """Fetch all projects with content for a user, ordered by most recent.

    Only returns projects that have at least one block (i.e. an actual built site).
    """
    supabase = await get_supabase_client()

    # First get all projects for this user
    projects_resp = await (
        supabase.table("projects")
        .select("id, name, source, created_at, updated_at")
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .execute()
    )
    projects = projects_resp.data or []

    # Filter to projects that have at least 1 block — parallel queries
    async def _has_blocks(proj):
        resp = await (
            supabase.table("blocks")
            .select("id", count="exact")
            .eq("project_id", proj["id"])
            .limit(1)
            .execute()
        )
        return (proj, resp.count and resp.count > 0)

    results = await asyncio.gather(*[_has_blocks(p) for p in projects])
    return [proj for proj, has in results if has]


async def fetch_site_state(project_id: str) -> dict[str, Any]:
    """Fetch current blocks and tools for a project.

    Returns {blocks: [{block_type, position}], tools: [{tool_type, config}]}.
    """
    supabase = await get_supabase_client()

    blocks_query = (
        supabase.table("blocks")
        .select("block_type, position")
        .eq("project_id", project_id)
        .order("position")
        .execute()
    )
    tools_query = (
        supabase.table("tools")
        .select("tool_type, config")
        .eq("project_id", project_id)
        .execute()
    )
    blocks_resp, tools_resp = await asyncio.gather(blocks_query, tools_query)

    return {
        "blocks": blocks_resp.data or [],
        "tools": tools_resp.data or [],
    }


async def fetch_business_context(project_id: str) -> str:
    """Extract text content from website blocks for after-hours AI context.

    Strips HTML tags from each block's content and returns a concatenated
    summary. Focuses on text-heavy blocks that contain useful business info
    (hero, about, services, contact, FAQ, etc.).

    Returns a string suitable for injection into the after-hours AI system prompt.
    """
    supabase = await get_supabase_client()

    blocks_resp = await (
        supabase.table("blocks")
        .select("block_type, html")
        .eq("project_id", project_id)
        .order("position")
        .execute()
    )
    blocks = blocks_resp.data or []

    context_parts = []
    for block in blocks:
        html = block.get("html", "")
        if not html:
            continue

        # Strip HTML tags and normalize whitespace
        text = re.sub(r"<[^>]+>", " ", html)
        text = re.sub(r"\s+", " ", text).strip()

        # Skip blocks with very little text content (likely just layout/images)
        if len(text) < 20:
            continue

        # Truncate long blocks to keep the prompt manageable
        block_type = block.get("block_type", "unknown")
        truncated = text[:500] + "..." if len(text) > 500 else text
        context_parts.append(f"[{block_type}]: {truncated}")

    return "\n".join(context_parts) if context_parts else "No business information available."
