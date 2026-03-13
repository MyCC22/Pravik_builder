"""Tool: complete_action_step — Mark a step as completed in the action steps checklist."""

import logging

from src.tools._base import ToolDefinition, ToolContext, _VALID_STEP_IDS
from src.tools._helpers import make_error_result
from src.services.realtime import broadcast_step_completed

logger = logging.getLogger(__name__)


async def handle(ctx: ToolContext, params):
    step_id = params.arguments.get("step_id", "").strip()
    if step_id not in _VALID_STEP_IDS:
        await params.result_callback(
            {
                "message": (
                    f"Invalid step_id '{step_id}'. "
                    f"Valid IDs are: {', '.join(sorted(_VALID_STEP_IDS))}"
                )
            }
        )
        return
    try:
        await broadcast_step_completed(ctx.identity.call_sid, step_id)
        await params.result_callback(
            {"message": f"Step '{step_id}' marked as completed in the action steps menu."}
        )
    except Exception as err:
        logger.error(f"[{ctx.identity.call_sid}] complete_action_step failed: {err}")
        await params.result_callback(
            make_error_result(f"Failed to mark step '{step_id}' as completed.", retryable=True)
        )


TOOL = ToolDefinition(
    name="complete_action_step",
    description=(
        "Mark a step as completed in the action steps checklist. "
        "Call this after successfully completing a step (e.g. after adding a contact form "
        "or provisioning a phone number). The drawer stays open so the user can pick the next step."
    ),
    parameters={
        "type": "object",
        "properties": {
            "step_id": {
                "type": "string",
                "description": "The step ID to mark as complete: 'contact_form', 'phone_number', etc.",
            },
        },
        "required": ["step_id"],
    },
    handle=handle,
    timeout=10,
    prompt_instructions="",
    returning_user_only=False,
)
