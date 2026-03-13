"""Database operations for call_sessions and call_messages tables."""

import logging
from datetime import datetime, timezone
from typing import Any

from src.services.supabase_client import get_supabase_client
from src.services.supabase_retry import with_supabase_retry

logger = logging.getLogger(__name__)


async def create_call_session(
    call_sid: str,
    user_id: str,
    project_id: str | None,
    phone_number: str,
    is_new_user: bool,
) -> dict[str, Any]:
    """Insert a new call session record. Returns the full row."""
    supabase = await get_supabase_client()
    result = await with_supabase_retry(
        supabase.table("call_sessions")
        .insert(
            {
                "call_sid": call_sid,
                "user_id": user_id,
                "project_id": project_id,
                "phone_number": phone_number,
                "is_new_user": is_new_user,
                "state": "greeting",
            }
        )
        .execute
    )
    if not result.data:
        raise RuntimeError(f"Failed to create call session for {call_sid}")
    return result.data[0]


async def update_call_state(call_sid: str, state: str) -> None:
    supabase = await get_supabase_client()
    await supabase.table("call_sessions").update({"state": state}).eq("call_sid", call_sid).execute()


async def mark_page_opened(call_sid: str) -> None:
    supabase = await get_supabase_client()
    await supabase.table("call_sessions").update(
        {
            "page_opened": True,
            "page_opened_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("call_sid", call_sid).execute()


async def end_call_session(call_sid: str) -> None:
    supabase = await get_supabase_client()
    await with_supabase_retry(
        supabase.table("call_sessions")
        .update(
            {
                "state": "ended",
                "ended_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        .eq("call_sid", call_sid)
        .execute
    )


async def save_call_message(
    call_session_id: str,
    role: str,
    content: str,
    intent: str | None = None,
) -> None:
    supabase = await get_supabase_client()
    await supabase.table("call_messages").insert(
        {
            "call_session_id": call_session_id,
            "role": role,
            "content": content,
            "intent": intent,
        }
    ).execute()


async def update_recording_url(call_sid: str, url: str) -> None:
    """Save the recording URL for a call session."""
    supabase = await get_supabase_client()
    await supabase.table("call_sessions").update(
        {"recording_url": url}
    ).eq("call_sid", call_sid).execute()


async def update_call_session_project(call_sid: str, project_id: str) -> None:
    """Update the project_id for an active call session (project switching)."""
    supabase = await get_supabase_client()
    await (
        supabase.table("call_sessions")
        .update({"project_id": project_id})
        .eq("call_sid", call_sid)
        .execute()
    )


async def get_call_session(call_sid: str) -> dict[str, Any] | None:
    supabase = await get_supabase_client()
    result = await (
        supabase.table("call_sessions")
        .select("*")
        .eq("call_sid", call_sid)
        .maybe_single()
        .execute()
    )
    return result.data
