"""Tier 2 tests for src.services.builder_api.

- call_builder_api: uses httpx to POST to /api/builder/generate
- fetch_site_state: queries blocks and tools tables from Supabase
- fetch_user_projects: queries projects, then filters by block count

Key mock insight: get_supabase_client() is async, but the returned Supabase
client's .table(), .select(), .eq(), .order(), .limit() are synchronous
chain builders. Only .execute() at the end is async.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.services.builder_api import (
    call_builder_api,
    fetch_site_state,
    fetch_user_projects,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _patch_supabase(mock_client):
    """Patch get_supabase_client to return mock_client from an async function."""
    async def fake_get_client():
        return mock_client

    return patch(
        "src.services.builder_api.get_supabase_client",
        side_effect=fake_get_client,
    )


# ---------------------------------------------------------------------------
# call_builder_api
# ---------------------------------------------------------------------------


async def test_call_builder_api_sends_correct_payload():
    """call_builder_api POSTs message and project_id to /api/builder/generate."""
    mock_response = MagicMock()
    mock_response.json.return_value = {"action": "generated", "message": "Done"}
    mock_response.raise_for_status = MagicMock()

    mock_http_client = AsyncMock()
    mock_http_client.post = AsyncMock(return_value=mock_response)
    mock_http_client.__aenter__ = AsyncMock(return_value=mock_http_client)
    mock_http_client.__aexit__ = AsyncMock(return_value=False)

    with patch("src.services.builder_api.httpx.AsyncClient", return_value=mock_http_client):
        result = await call_builder_api(
            base_url="http://localhost:3000",
            message="Build a bakery site",
            project_id="proj-1",
        )

    mock_http_client.post.assert_awaited_once()
    call_args = mock_http_client.post.call_args
    assert call_args.args[0] == "http://localhost:3000/api/builder/generate"
    body = call_args.kwargs["json"]
    assert body["message"] == "Build a bakery site"
    assert body["project_id"] == "proj-1"
    assert "image_urls" not in body
    assert result == {"action": "generated", "message": "Done"}


async def test_call_builder_api_includes_image_urls():
    """call_builder_api includes image_urls in the body when provided."""
    mock_response = MagicMock()
    mock_response.json.return_value = {"action": "generated", "message": "OK"}
    mock_response.raise_for_status = MagicMock()

    mock_http_client = AsyncMock()
    mock_http_client.post = AsyncMock(return_value=mock_response)
    mock_http_client.__aenter__ = AsyncMock(return_value=mock_http_client)
    mock_http_client.__aexit__ = AsyncMock(return_value=False)

    with patch("src.services.builder_api.httpx.AsyncClient", return_value=mock_http_client):
        await call_builder_api(
            base_url="http://localhost:3000",
            message="Use this image",
            project_id="proj-1",
            image_urls=["https://img.example.com/photo.jpg"],
        )

    body = mock_http_client.post.call_args.kwargs["json"]
    assert body["image_urls"] == ["https://img.example.com/photo.jpg"]


async def test_call_builder_api_returns_parsed_json():
    """call_builder_api returns the parsed JSON response."""
    expected = {"action": "edited", "message": "Changed headline"}
    mock_response = MagicMock()
    mock_response.json.return_value = expected
    mock_response.raise_for_status = MagicMock()

    mock_http_client = AsyncMock()
    mock_http_client.post = AsyncMock(return_value=mock_response)
    mock_http_client.__aenter__ = AsyncMock(return_value=mock_http_client)
    mock_http_client.__aexit__ = AsyncMock(return_value=False)

    with patch("src.services.builder_api.httpx.AsyncClient", return_value=mock_http_client):
        result = await call_builder_api("http://x", "edit", "proj-1")

    assert result == expected


# ---------------------------------------------------------------------------
# fetch_site_state
# ---------------------------------------------------------------------------


async def test_fetch_site_state_returns_blocks_and_tools():
    """fetch_site_state queries blocks and tools tables, returns both."""
    blocks_data = [
        {"block_type": "hero", "position": 0},
        {"block_type": "features", "position": 1},
    ]
    tools_data = [{"tool_type": "booking", "config": {"title": "Book Now"}}]

    mock_client = MagicMock()

    # We need table() to return different mock chains for "blocks" vs "tools"
    blocks_table = MagicMock()
    blocks_table.select.return_value = blocks_table
    blocks_table.eq.return_value = blocks_table
    blocks_table.order.return_value = blocks_table
    blocks_result = MagicMock()
    blocks_result.data = blocks_data
    blocks_table.execute = AsyncMock(return_value=blocks_result)

    tools_table = MagicMock()
    tools_table.select.return_value = tools_table
    tools_table.eq.return_value = tools_table
    tools_result = MagicMock()
    tools_result.data = tools_data
    tools_table.execute = AsyncMock(return_value=tools_result)

    def table_router(name):
        if name == "blocks":
            return blocks_table
        if name == "tools":
            return tools_table
        return MagicMock()

    mock_client.table.side_effect = table_router

    with _patch_supabase(mock_client):
        result = await fetch_site_state("proj-1")

    assert result["blocks"] == blocks_data
    assert result["tools"] == tools_data


async def test_fetch_site_state_returns_empty_when_no_data():
    """fetch_site_state returns empty lists when tables have no rows."""
    mock_client = MagicMock()
    empty_table = MagicMock()
    empty_table.select.return_value = empty_table
    empty_table.eq.return_value = empty_table
    empty_table.order.return_value = empty_table
    empty_result = MagicMock()
    empty_result.data = []
    empty_table.execute = AsyncMock(return_value=empty_result)

    mock_client.table.return_value = empty_table

    with _patch_supabase(mock_client):
        result = await fetch_site_state("proj-empty")

    assert result["blocks"] == []
    assert result["tools"] == []


# ---------------------------------------------------------------------------
# fetch_user_projects
# ---------------------------------------------------------------------------


async def test_fetch_user_projects_returns_projects_with_blocks():
    """fetch_user_projects only returns projects that have at least 1 block."""
    projects_data = [
        {"id": "proj-1", "name": "My Site", "source": "voice", "created_at": "2026-01-01", "updated_at": "2026-03-01"},
        {"id": "proj-2", "name": "Empty Site", "source": "voice", "created_at": "2026-01-01", "updated_at": "2026-02-01"},
    ]

    mock_client = MagicMock()

    # Projects query
    projects_table = MagicMock()
    projects_table.select.return_value = projects_table
    projects_table.eq.return_value = projects_table
    projects_table.order.return_value = projects_table
    projects_result = MagicMock()
    projects_result.data = projects_data
    projects_table.execute = AsyncMock(return_value=projects_result)

    # Blocks queries: proj-1 has blocks, proj-2 does not
    call_count = [0]

    def make_blocks_table():
        blocks_table = MagicMock()
        blocks_table.select.return_value = blocks_table
        blocks_table.eq.return_value = blocks_table
        blocks_table.limit.return_value = blocks_table
        result = MagicMock()
        # First call (proj-1): has blocks. Second call (proj-2): no blocks.
        if call_count[0] == 0:
            result.count = 3
        else:
            result.count = 0
        call_count[0] += 1
        blocks_table.execute = AsyncMock(return_value=result)
        return blocks_table

    def table_router(name):
        if name == "projects":
            return projects_table
        if name == "blocks":
            return make_blocks_table()
        return MagicMock()

    mock_client.table.side_effect = table_router

    with _patch_supabase(mock_client):
        result = await fetch_user_projects("user-1")

    # Only proj-1 should be returned (it has blocks)
    assert len(result) == 1
    assert result[0]["id"] == "proj-1"


async def test_fetch_user_projects_returns_empty_when_no_projects():
    """fetch_user_projects returns empty list when user has no projects."""
    mock_client = MagicMock()

    projects_table = MagicMock()
    projects_table.select.return_value = projects_table
    projects_table.eq.return_value = projects_table
    projects_table.order.return_value = projects_table
    projects_result = MagicMock()
    projects_result.data = []
    projects_table.execute = AsyncMock(return_value=projects_result)

    mock_client.table.return_value = projects_table

    with _patch_supabase(mock_client):
        result = await fetch_user_projects("user-no-projects")

    assert result == []
