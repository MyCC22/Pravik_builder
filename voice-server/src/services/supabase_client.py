"""Supabase async client singleton."""

from supabase import acreate_client, AsyncClient

from src.config import config

_client: AsyncClient | None = None


async def get_supabase_client() -> AsyncClient:
    global _client
    if _client is None:
        _client = await acreate_client(config.supabase_url, config.supabase_anon_key)
    return _client
