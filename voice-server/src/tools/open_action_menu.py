"""Tool: open_action_menu — Open the action steps checklist on the user's phone screen."""

import logging

from src.tools._base import ToolDefinition, ToolContext
from src.tools._helpers import make_error_result
from src.services.realtime import broadcast_open_action_menu

logger = logging.getLogger(__name__)


async def handle(ctx: ToolContext, params):
    try:
        await broadcast_open_action_menu(ctx.identity.call_sid)
        await params.result_callback(
            {"message": "The action steps menu is now visible on the user's phone. Guide them through the available steps."}
        )
    except Exception as err:
        logger.error(f"[{ctx.identity.call_sid}] open_action_menu failed: {err}")
        await params.result_callback(
            make_error_result("Failed to open the action menu.", retryable=True)
        )


TOOL = ToolDefinition(
    name="open_action_menu",
    description=(
        "Open the action steps checklist on the user's phone screen. "
        "Call this after the website is built to show available next steps."
    ),
    parameters={"type": "object", "properties": {}, "required": []},
    handle=handle,
    timeout=10,
    prompt_instructions="""\
ACTION STEPS MENU:
- After the website is built successfully, present the next steps to the user.
- Call open_action_menu to show the checklist on their phone.
- Say something like: "Great! Now that your site is ready, there are a couple things we can set up — like a contact form or a phone number. Take a look at the menu on your phone, or just tell me which one you'd like to do."
- When a step is completed, call complete_action_step with the step ID.
- When all available steps are done, call close_action_menu, celebrate, and wrap up.
- If the user wants to close the menu or seems done browsing steps, call close_action_menu.
- Do NOT mention "coming soon" items unless the user asks.""",
    returning_user_only=False,
)
