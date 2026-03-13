"""Tool: create_new_project — Create a brand new empty project to start building from scratch."""

import datetime
import logging

from src.tools._base import ToolDefinition, ToolContext
from src.services.call_session import save_call_message, update_call_session_project
from src.services.realtime import broadcast_project_selected
from src.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)


async def handle(ctx: ToolContext, params):
    try:
        supabase = await get_supabase_client()
        resp = await (
            supabase.table("projects")
            .insert(
                {
                    "user_id": ctx.identity.user_id,
                    "name": f"Voice Build {datetime.date.today().strftime('%m/%d/%Y')}",
                    "source": "voice",
                }
            )
            .select()
            .single()
            .execute()
        )
        new_project = resp.data
        ctx.state.switch_project(new_project["id"])

        await update_call_session_project(ctx.identity.call_sid, new_project["id"])
        await broadcast_project_selected(ctx.identity.call_sid, new_project["id"])
        await save_call_message(
            call_session_id=ctx.identity.session_id,
            role="system",
            content=f"Created new project {new_project['id']}",
        )
        await params.result_callback(
            {
                "message": (
                    "New project created! Ask the user what kind of website they want to build. "
                    "Get excited and help them brainstorm!"
                )
            }
        )
    except Exception as err:
        logger.error(f"[{ctx.identity.call_sid}] create_new_project failed: {err}", exc_info=True)
        await params.result_callback(
            {"message": "Sorry, I had trouble creating a new project. Please try again."}
        )


TOOL = ToolDefinition(
    name="create_new_project",
    description=(
        "Create a brand new empty project to start building from scratch. "
        "Call this when the returning user wants to build a new website instead "
        "of continuing with an existing one."
    ),
    parameters={"type": "object", "properties": {}, "required": []},
    handle=handle,
    timeout=15,
    prompt_instructions="",
    returning_user_only=True,
)
