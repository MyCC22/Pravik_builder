"""Shared event contract for voice call Realtime broadcasts.

This mirrors the TypeScript source of truth at src/lib/events/call-events.ts.
Both files must stay in sync — see tests/test_event_sync.py.
"""

from enum import StrEnum
from time import time


class CallEvent(StrEnum):
    """Event names for Supabase Realtime broadcasts."""

    # Voice Server → Frontend
    PREVIEW_UPDATED = "preview_updated"
    VOICE_MESSAGE = "voice_message"
    PROJECT_SELECTED = "project_selected"
    OPEN_ACTION_MENU = "open_action_menu"
    CLOSE_ACTION_MENU = "close_action_menu"
    STEP_COMPLETED = "step_completed"
    CALL_ENDED = "call_ended"

    # Frontend → Voice Server
    PAGE_OPENED = "page_opened"
    WEB_ACTION = "web_action"


class WebActionType(StrEnum):
    """Action types sent from the frontend via web_action broadcasts."""

    PAGE_OPENED = "page_opened"
    TEXT_MESSAGE_SENT = "text_message_sent"
    IMAGE_UPLOADED = "image_uploaded"
    PROJECT_SELECTED_FROM_WEB = "project_selected_from_web"
    NEW_PROJECT_REQUESTED = "new_project_requested"
    STEP_SELECTED = "step_selected"


def make_payload(**kwargs) -> dict:
    """Build a broadcast payload dict with timestamp always included.

    Usage:
        make_payload(stepId="contact_form")
        → {"stepId": "contact_form", "timestamp": 1710000000000}
    """
    return {**kwargs, "timestamp": int(time() * 1000)}
