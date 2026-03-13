"""Tool: build_website — Build a new website based on the user description."""

import asyncio
import logging

from src.tools._base import ToolDefinition, ToolContext, _clean_project_name
from src.tools._helpers import send_sms_if_needed, call_api_with_retry, inject_site_context
from src.services.call_session import save_call_message, update_call_state
from src.services.realtime import (
    broadcast_preview_update,
    broadcast_step_completed,
    broadcast_open_action_menu,
)
from src.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)


async def handle(ctx: ToolContext, params):
    description = params.arguments.get("description", "")
    try:
        await send_sms_if_needed(ctx)
        await update_call_state(ctx.identity.call_sid, "building")

        image_urls = ctx.turn.consume_images()

        result = await call_api_with_retry(
            ctx, description, image_urls=image_urls if image_urls else None,
        )

        if result.get("action") == "error":
            await update_call_state(ctx.identity.call_sid, "follow_up")
            suggestion = (
                "Tell the user the system is busy and you'll try again shortly."
                if result.get("retryable")
                else "Apologize and suggest the user try again in a few minutes."
            )
            await params.result_callback({
                "message": result["message"],
                "status": "temporary_error" if result.get("retryable") else "permanent_error",
                "suggestion": suggestion,
            })
            return

        await broadcast_preview_update(
            ctx.identity.call_sid,
            action=result.get("action", "generated"),
            message=result.get("message", ""),
            project_id=ctx.state.project_id,
        )
        await save_call_message(
            call_session_id=ctx.identity.session_id,
            role="assistant",
            content=result.get("message", ""),
            intent="build_website",
        )
        await update_call_state(ctx.identity.call_sid, "follow_up")
        await params.result_callback({"message": result.get("message", "Website built!")})

        asyncio.create_task(broadcast_step_completed(ctx.identity.call_sid, "build_site"))
        asyncio.create_task(broadcast_open_action_menu(ctx.identity.call_sid))

        if description:
            async def _auto_name():
                try:
                    name = _clean_project_name(description)
                    if name:
                        supabase = await get_supabase_client()
                        await (
                            supabase.table("projects")
                            .update({"name": name})
                            .eq("id", ctx.state.project_id)
                            .execute()
                        )
                        # Update in-memory state so AI uses the friendly name
                        ctx.state.switch_project(ctx.state.project_id, project_name=name)
                        logger.info(f"[{ctx.identity.call_sid}] Auto-named project: {name}")
                except Exception as e:
                    logger.warning(f"[{ctx.identity.call_sid}] Failed to auto-name project: {e}")

            asyncio.create_task(_auto_name())

        asyncio.create_task(inject_site_context(ctx))
    except Exception as err:
        logger.error(f"[{ctx.identity.call_sid}] Build failed: {err}")
        await params.result_callback(
            {
                "message": "Sorry, there was an error building the website. Please try describing what you want again."
            }
        )


TOOL = ToolDefinition(
    name="build_website",
    description=(
        "Build a new website based on the user description. "
        "Call this when the user describes what kind of website they want."
    ),
    parameters={
        "type": "object",
        "properties": {
            "description": {
                "type": "string",
                "description": (
                    'A detailed description of the website to build, e.g. '
                    '"A website for a soccer coaching academy with training programs, pricing, and contact info"'
                ),
            },
        },
        "required": ["description"],
    },
    handle=handle,
    timeout=120,
    prompt_instructions="",
    returning_user_only=False,
)
