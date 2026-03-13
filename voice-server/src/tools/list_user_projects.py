"""Tool: list_user_projects — List all the user's existing websites with their names."""

import logging

from src.tools._base import ToolDefinition, ToolContext
from src.services.builder_api import fetch_user_projects

logger = logging.getLogger(__name__)


async def handle(ctx: ToolContext, params):
    try:
        projects = await fetch_user_projects(ctx.identity.user_id)
        if not projects:
            await params.result_callback(
                {"message": "The user has no existing websites. Offer to build a new one!"}
            )
            return

        lines = []
        for i, p in enumerate(projects, 1):
            name = p.get("name", "Untitled")
            pid = p["id"]
            lines.append(f"{i}. {name} (ID: {pid})")
        project_list = "\n".join(lines)

        await params.result_callback(
            {
                "message": (
                    f"The user has {len(projects)} website(s):\n{project_list}\n\n"
                    f"Read the list to the user naturally (just names, not IDs). "
                    f"When they pick one, call select_project with that project's ID."
                )
            }
        )
    except Exception as err:
        logger.error(f"[{ctx.identity.call_sid}] list_user_projects failed: {err}", exc_info=True)
        await params.result_callback(
            {"message": "Sorry, I couldn't retrieve the project list. Please try again."}
        )


TOOL = ToolDefinition(
    name="list_user_projects",
    description=(
        "List all the user's existing websites with their names. "
        "Call this when the user wants to know what websites they have, "
        "or when they want to switch to a different project."
    ),
    parameters={"type": "object", "properties": {}, "required": []},
    handle=handle,
    timeout=15,
    prompt_instructions="",
    returning_user_only=True,
)
