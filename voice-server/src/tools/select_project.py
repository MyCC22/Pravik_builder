"""Tool: select_project — Load an existing project so you can continue editing it."""

import asyncio
import logging

from src.tools._base import ToolDefinition, ToolContext
from src.tools._helpers import inject_site_context
from src.services.builder_api import fetch_site_state
from src.services.call_session import save_call_message, update_call_session_project
from src.services.realtime import broadcast_project_selected
from src.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)


async def handle(ctx: ToolContext, params):
    project_id = params.arguments.get("project_id", "").strip()
    if not project_id:
        await params.result_callback(
            {"message": "I need a project ID. Call list_user_projects first to get the IDs."}
        )
        return

    try:
        # Fetch project name and site state in parallel for speed
        supabase = await get_supabase_client()
        name_query = (
            supabase.table("projects")
            .select("name")
            .eq("id", project_id)
            .single()
            .execute()
        )
        state_query = fetch_site_state(project_id)
        project_resp, state = await asyncio.gather(name_query, state_query)

        raw_name = (project_resp.data or {}).get("name", "") if project_resp.data else ""
        # Filter auto-generated names so AI says "your website" instead of "Voice Build ..."
        lower_name = raw_name.lower().strip()
        project_name = (
            raw_name if raw_name and not lower_name.startswith("voice build")
            and not lower_name.startswith("untitled")
            and not lower_name.startswith("new project")
            else ""
        )
        ctx.state.switch_project(project_id, project_name=project_name)

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

        name_label = f'"{project_name}"' if project_name else "your website"
        summary_msg = (
            f"Project {name_label} loaded successfully. Current sections: {block_list}.{tool_summary} "
            f"Refer to this project as {name_label} when talking to the user (NEVER say the project ID). "
            f"Tell the user their site is loaded and ask what they'd like to change or update."
        )

        # Return result to AI immediately — don't block on side-effect DB writes
        await params.result_callback({"message": summary_msg})

        # Fire-and-forget: session update, broadcast, site context, and message log
        async def _background():
            try:
                await asyncio.gather(
                    update_call_session_project(ctx.identity.call_sid, project_id),
                    broadcast_project_selected(ctx.identity.call_sid, project_id),
                    save_call_message(
                        call_session_id=ctx.identity.session_id,
                        role="system",
                        content=f"Loaded project {name_label} with sections: {block_list}",
                    ),
                )
            except Exception as bg_err:
                logger.warning(f"[{ctx.identity.call_sid}] select_project background tasks: {bg_err}")

        asyncio.create_task(_background())
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
    timeout=25,
    prompt_instructions="",
    returning_user_only=True,
)
