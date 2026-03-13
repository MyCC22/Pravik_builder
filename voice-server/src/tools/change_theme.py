"""Tool: change_theme — Change the color theme of the website."""

import logging

from src.tools._base import ToolDefinition, ToolContext
from src.tools._helpers import call_api_with_retry
from src.services.call_session import save_call_message
from src.services.realtime import broadcast_preview_update

logger = logging.getLogger(__name__)


async def handle(ctx: ToolContext, params):
    request = params.arguments.get("request", "")
    try:
        result = await call_api_with_retry(ctx, request)

        if result.get("action") == "error":
            await params.result_callback({
                "message": result["message"],
                "status": "temporary_error" if result.get("retryable") else "permanent_error",
            })
            return

        await broadcast_preview_update(
            ctx.identity.call_sid,
            action=result.get("action", "edited"),
            message=result.get("message", ""),
            project_id=ctx.state.project_id,
        )
        await save_call_message(
            call_session_id=ctx.identity.session_id,
            role="assistant",
            content=result.get("message", ""),
            intent="change_theme",
        )
        await params.result_callback({"message": result.get("message", "Theme changed!")})
    except Exception as err:
        logger.error(f"[{ctx.identity.call_sid}] Theme change failed: {err}")
        await params.result_callback(
            {"message": "Sorry, there was an error changing the theme. Please try again."}
        )


TOOL = ToolDefinition(
    name="change_theme",
    description=(
        "Change the color theme of the website. Available themes: "
        "clean (professional light), bold (dark mode), vibrant (colorful gradients), "
        "warm (cozy earth tones). Call this when the user wants to change colors, "
        "make it darker, lighter, warmer, etc."
    ),
    parameters={
        "type": "object",
        "properties": {
            "request": {
                "type": "string",
                "description": (
                    'The theme change request, e.g. "Make it dark mode" or '
                    '"Use warmer colors" or "Switch to the vibrant theme"'
                ),
            },
        },
        "required": ["request"],
    },
    handle=handle,
    timeout=120,
    prompt_instructions="",
    returning_user_only=False,
)
