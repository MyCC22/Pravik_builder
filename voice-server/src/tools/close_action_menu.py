"""Tool: close_action_menu — Close the action steps checklist on the user's phone."""

import logging

from src.tools._base import ToolDefinition, ToolContext
from src.tools._helpers import make_error_result
from src.services.realtime import broadcast_close_action_menu

logger = logging.getLogger(__name__)


async def handle(ctx: ToolContext, params):
    try:
        await broadcast_close_action_menu(ctx.identity.call_sid)
        await params.result_callback({"message": "The action steps menu has been closed."})
    except Exception as err:
        logger.error(f"[{ctx.identity.call_sid}] close_action_menu failed: {err}")
        await params.result_callback(
            make_error_result("Failed to close the action menu.", retryable=True)
        )


TOOL = ToolDefinition(
    name="close_action_menu",
    description=(
        "Close the action steps checklist on the user's phone. "
        "Call this when the user is done browsing steps or all available steps are complete."
    ),
    parameters={"type": "object", "properties": {}, "required": []},
    handle=handle,
    timeout=10,
    prompt_instructions="",
    returning_user_only=False,
)
