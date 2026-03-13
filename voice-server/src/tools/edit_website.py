"""Tool: edit_website — Edit any part of the website: text, forms, images, sections, or style."""

import asyncio
import logging

from src.tools._base import ToolDefinition, ToolContext, _is_auto_answerable
from src.tools._helpers import call_api_with_retry, inject_site_context
from src.services.builder_api import fetch_site_state
from src.services.call_session import save_call_message
from src.services.realtime import broadcast_preview_update, broadcast_step_completed

logger = logging.getLogger(__name__)


async def handle(ctx: ToolContext, params):
    instruction = params.arguments.get("instruction", "").strip()
    if not instruction:
        await params.result_callback(
            {"message": "I need to know what to change. Ask the user what they'd like to edit."}
        )
        return

    try:
        state = await fetch_site_state(ctx.state.project_id)
        if not state.get("blocks"):
            await params.result_callback(
                {
                    "message": (
                        "The website hasn't been built yet. Ask the user what kind of website "
                        "they want, then call build_website to create it first."
                    )
                }
            )
            return
        had_booking_before = any(
            t.get("tool_type") == "booking" for t in state.get("tools", [])
        )
    except Exception:
        had_booking_before = False

    if ctx.turn.last_edit_summary:
        instruction = f"(Previous edit: {ctx.turn.last_edit_summary}) {instruction}"

    try:
        image_urls = ctx.turn.consume_images()

        result = await call_api_with_retry(
            ctx, instruction, image_urls=image_urls if image_urls else None,
        )

        if result.get("action") == "error":
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

        action = result.get("action", "edited")

        if action == "clarify":
            question = result.get("question", result.get("message", "Could you be more specific?"))
            logger.info(f"[{ctx.identity.call_sid}] Clarify returned: {question}")

            if _is_auto_answerable(question, instruction):
                logger.info(f"[{ctx.identity.call_sid}] Auto-answering clarify with yes")
                retry_result = await call_api_with_retry(
                    ctx, f"Yes, please do it. Original request: {instruction}",
                )
                if retry_result.get("action") != "clarify":
                    await broadcast_preview_update(
                        ctx.identity.call_sid,
                        action=retry_result.get("action", "edited"),
                        message=retry_result.get("message", ""),
                        project_id=ctx.state.project_id,
                    )
                    await save_call_message(
                        call_session_id=ctx.identity.session_id,
                        role="assistant",
                        content=retry_result.get("message", ""),
                        intent="edit_website",
                    )
                    ctx.turn.last_edit_summary = f"{instruction} -> {retry_result.get('message', '')}"
                    await params.result_callback({"message": retry_result.get("message", "Done!")})
                    asyncio.create_task(inject_site_context(ctx))
                    return

            await params.result_callback(
                {
                    "message": (
                        f"I need more information before making this change. Ask the user: "
                        f"{question} Once they answer, call edit_website again with their "
                        f"clarified request combined with the original context."
                    )
                }
            )
            return

        await broadcast_preview_update(
            ctx.identity.call_sid,
            action=action,
            message=result.get("message", ""),
            project_id=ctx.state.project_id,
        )
        await save_call_message(
            call_session_id=ctx.identity.session_id,
            role="assistant",
            content=result.get("message", ""),
            intent="edit_website",
        )
        ctx.turn.last_edit_summary = f"{instruction} -> {result.get('message', '')}"

        if not had_booking_before:
            try:
                new_state = await fetch_site_state(ctx.state.project_id)
                has_booking_now = any(
                    t.get("tool_type") == "booking" for t in new_state.get("tools", [])
                )
                if has_booking_now:
                    await broadcast_step_completed(ctx.identity.call_sid, "contact_form")
            except Exception:
                pass

        await params.result_callback(
            {
                "message": (
                    f"{result.get('message', 'Changes applied!')} "
                    f"If the user wants to refine this change, call edit_website again."
                )
            }
        )
        asyncio.create_task(inject_site_context(ctx))
    except Exception as err:
        logger.error(f"[{ctx.identity.call_sid}] Edit failed: {err}")
        await params.result_callback(
            {"message": "Sorry, there was an error making that change. Please try again."}
        )


TOOL = ToolDefinition(
    name="edit_website",
    description=(
        "Edit any part of the website: text, forms, images, sections, or style. "
        "Supports ALL changes: TEXT (headlines, descriptions, buttons, phone numbers, emails), "
        "FORMS (add/remove fields, change labels, add dropdowns), "
        "IMAGES (hero background, gallery, section images), "
        "SECTIONS (add/remove testimonials, FAQ, pricing, etc.), "
        "STYLE (colors, fonts, spacing, layout). "
        "Call this with a specific instruction describing exactly what to change."
    ),
    parameters={
        "type": "object",
        "properties": {
            "instruction": {
                "type": "string",
                "description": (
                    'The specific edit instruction, e.g. "Change the hero headline to Welcome Home" '
                    'or "Add a pricing section with 3 tiers" or "Make the background darker"'
                ),
            },
        },
        "required": ["instruction"],
    },
    handle=handle,
    timeout=120,
    prompt_instructions="""\
Editing rules:
- You CAN change ANYTHING: text, images, forms, sections, style. NEVER refuse a change.
- Be specific in the instruction: include exact text, field names, image descriptions.
- If the tool asks a clarifying question, ask the user, then call edit_website again with the clarified request.
- For follow-up edits ("make it bolder"), just call edit_website again — the system tracks context.""",
    returning_user_only=False,
)
