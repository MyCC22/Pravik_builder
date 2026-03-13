"""Tool: select_project — Load an existing project so you can continue editing it."""

import asyncio
import logging

from src.tools._base import ToolDefinition, ToolContext
from src.tools._helpers import inject_site_context
from src.services.builder_api import fetch_site_state
from src.services.call_session import save_call_message, update_call_session_project
from src.services.realtime import broadcast_project_selected

logger = logging.getLogger(__name__)


async def handle(ctx: ToolContext, params):
    project_id = params.arguments.get("project_id", "").strip()
    if not project_id:
        await params.result_callback(
            {"message": "I need a project ID. Call list_user_projects first to get the IDs."}
        )
        return

    try:
        ctx.state.switch_project(project_id)
        await update_call_session_project(ctx.identity.call_sid, project_id)
        await broadcast_project_selected(ctx.identity.call_sid, project_id)

        state = await fetch_site_state(project_id)
        blocks = state.get("blocks", [])
        tools_data = state.get("tools", [])

        block_list = ", ".join(b["block_type"] for b in blocks) if blocks else "empty"

        tool_summary = ""
        for t in tools_data:
            if t.get("tool_type") == "booking":
                cfg = t.get("config") or {}
                fields = ", ".join(
                    f.get("label", f.get("name", "?")) for f in cfg.get("fields", [])
                )
                tool_summary = f' Booking form: title="{cfg.get("title", "")}", fields=[{fields}].'

        summary_msg = (
            f"Project loaded successfully. Current sections: {block_list}.{tool_summary} "
            f"Tell the user their site is loaded and ask what they'd like to change or update."
        )

        await save_call_message(
            call_session_id=ctx.identity.session_id,
            role="system",
            content=f"Loaded project {project_id} with sections: {block_list}",
        )
        await params.result_callback({"message": summary_msg})
        asyncio.create_task(inject_site_context(ctx))
    except Exception as err:
        logger.error(f"[{ctx.identity.call_sid}] select_project failed: {err}", exc_info=True)
        await params.result_callback(
            {"message": "Sorry, I had trouble loading that project. Please try again."}
        )


TOOL = ToolDefinition(
    name="select_project",
    description=(
        "Load an existing project so you can continue editing it. "
        "Call this when the user wants to continue with a specific project. "
        "The project's current content will be loaded."
    ),
    parameters={
        "type": "object",
        "properties": {
            "project_id": {
                "type": "string",
                "description": "The ID of the project to load.",
            },
        },
        "required": ["project_id"],
    },
    handle=handle,
    timeout=15,
    prompt_instructions="",
    returning_user_only=True,
)
