"""Tool definitions and handler functions for the voice AI agent."""

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, Callable

from src.services.builder_api import call_builder_api
from src.services.call_session import save_call_message, update_call_state
from src.services.realtime import broadcast_preview_update
from src.services.twilio_sms import send_sms

logger = logging.getLogger(__name__)

# OpenAI Realtime tool definitions — same schema as the TypeScript version
TOOLS = [
    {
        "type": "function",
        "name": "send_builder_link",
        "description": (
            "Prepare the website builder link for the user. Call this when the user "
            "agrees to start building. The user will be directed to open a simple URL on their phone."
        ),
        "parameters": {"type": "object", "properties": {}, "required": []},
    },
    {
        "type": "function",
        "name": "build_website",
        "description": (
            "Build a new website based on the user description. Call this when the "
            "user describes what kind of website they want."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "description": {
                    "type": "string",
                    "description": (
                        'A detailed description of the website to build, e.g. "A website for a '
                        'soccer coaching academy with training programs, pricing, and contact info"'
                    ),
                },
            },
            "required": ["description"],
        },
    },
    {
        "type": "function",
        "name": "edit_website",
        "description": (
            "Make changes to the existing website. Call this when the user requests "
            "specific modifications like changing text, adding sections, or removing elements."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "instruction": {
                    "type": "string",
                    "description": (
                        'What to change, e.g. "Change the hero title to Welcome to My Academy" '
                        'or "Add a testimonials section" or "Remove the pricing section"'
                    ),
                },
            },
            "required": ["instruction"],
        },
    },
    {
        "type": "function",
        "name": "change_theme",
        "description": (
            "Change the color theme of the website. Available themes: clean (professional light), "
            "bold (dark mode), vibrant (colorful gradients), warm (cozy earth tones). "
            "Call this when the user wants to change colors, make it darker, lighter, warmer, etc."
        ),
        "parameters": {
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
    },
]


@dataclass
class ToolContext:
    """Context shared across all tool handlers for a single call."""

    call_sid: str
    session_id: str
    user_id: str
    project_id: str
    phone_number: str
    builder_api_url: str
    pending_image_urls: list[str] = field(default_factory=list)


def create_tool_handlers(ctx: ToolContext) -> dict[str, Callable]:
    """
    Create tool handler functions bound to a specific call context.

    Returns a dict mapping tool name -> async handler following Pipecat's
    register_function callback signature.
    """

    async def handle_send_builder_link(
        function_name: str,
        tool_call_id: str,
        args: dict[str, Any],
        llm: Any,
        context: Any,
        result_callback: Callable,
    ):
        links_url = f"{ctx.builder_api_url}/links"
        try:
            # Return result FIRST so the AI can start talking immediately.
            # SMS and DB writes happen in background — they must not block
            # the result_callback or the function call gets cancelled by
            # user speech interruptions.
            await result_callback(
                {
                    "message": (
                        f"A text message with the link has been sent to the user's phone. "
                        f"Tell them to check their texts and tap the link. "
                        f"If they don't see the text, spell out the URL as a backup: "
                        f"pravik-builder dot vercel dot app slash links. "
                        f"Once they open it, they'll see their website being built in real time."
                    )
                }
            )

            # Fire-and-forget: SMS + DB updates in background
            async def _background():
                try:
                    await update_call_state(ctx.call_sid, "waiting_for_page")
                    if ctx.phone_number:
                        sms_body = (
                            f"Your website builder is ready! Open this link to see your "
                            f"website being built in real time: {links_url}"
                        )
                        sms_sid = await send_sms(ctx.phone_number, sms_body)
                        logger.info(f"[{ctx.call_sid}] SMS sent: {sms_sid}")
                    await save_call_message(
                        call_session_id=ctx.session_id,
                        role="system",
                        content=f"Builder link sent via SMS: {links_url} (project: {ctx.project_id})",
                    )
                except Exception as bg_err:
                    logger.error(f"[{ctx.call_sid}] Background SMS/DB failed: {bg_err}")

            asyncio.create_task(_background())
        except Exception as err:
            logger.error(f"[{ctx.call_sid}] Failed to send builder link: {err}")
            await result_callback(
                {"message": "Failed to send the link. Ask the user to try again."}
            )

    async def handle_build_website(
        function_name: str,
        tool_call_id: str,
        args: dict[str, Any],
        llm: Any,
        context: Any,
        result_callback: Callable,
    ):
        description = args.get("description", "")
        try:
            await update_call_state(ctx.call_sid, "building")

            # Drain any pending image URLs from web page uploads
            image_urls = list(ctx.pending_image_urls)
            ctx.pending_image_urls.clear()

            result = await call_builder_api(
                ctx.builder_api_url, description, ctx.project_id,
                image_urls=image_urls if image_urls else None,
            )

            await broadcast_preview_update(
                ctx.call_sid,
                action=result.get("action", "generated"),
                message=result.get("message", ""),
                project_id=ctx.project_id,
            )

            await save_call_message(
                call_session_id=ctx.session_id,
                role="assistant",
                content=result.get("message", ""),
                intent="build_website",
            )

            await update_call_state(ctx.call_sid, "follow_up")
            await result_callback({"message": result.get("message", "Website built!")})
        except Exception as err:
            logger.error(f"[{ctx.call_sid}] Build failed: {err}")
            await result_callback(
                {
                    "message": "Sorry, there was an error building the website. "
                    "Please try describing what you want again."
                }
            )

    async def handle_edit_website(
        function_name: str,
        tool_call_id: str,
        args: dict[str, Any],
        llm: Any,
        context: Any,
        result_callback: Callable,
    ):
        instruction = args.get("instruction", "")
        try:
            # Drain any pending image URLs from web page uploads
            image_urls = list(ctx.pending_image_urls)
            ctx.pending_image_urls.clear()

            result = await call_builder_api(
                ctx.builder_api_url, instruction, ctx.project_id,
                image_urls=image_urls if image_urls else None,
            )

            await broadcast_preview_update(
                ctx.call_sid,
                action=result.get("action", "edited"),
                message=result.get("message", ""),
                project_id=ctx.project_id,
            )

            await save_call_message(
                call_session_id=ctx.session_id,
                role="assistant",
                content=result.get("message", ""),
                intent="edit_website",
            )

            await result_callback({"message": result.get("message", "Changes applied!")})
        except Exception as err:
            logger.error(f"[{ctx.call_sid}] Edit failed: {err}")
            await result_callback(
                {"message": "Sorry, there was an error making that change. Please try again."}
            )

    async def handle_change_theme(
        function_name: str,
        tool_call_id: str,
        args: dict[str, Any],
        llm: Any,
        context: Any,
        result_callback: Callable,
    ):
        request = args.get("request", "")
        try:
            result = await call_builder_api(ctx.builder_api_url, request, ctx.project_id)

            await broadcast_preview_update(
                ctx.call_sid,
                action=result.get("action", "edited"),
                message=result.get("message", ""),
                project_id=ctx.project_id,
            )

            await save_call_message(
                call_session_id=ctx.session_id,
                role="assistant",
                content=result.get("message", ""),
                intent="change_theme",
            )

            await result_callback({"message": result.get("message", "Theme changed!")})
        except Exception as err:
            logger.error(f"[{ctx.call_sid}] Theme change failed: {err}")
            await result_callback(
                {"message": "Sorry, there was an error changing the theme. Please try again."}
            )

    return {
        "send_builder_link": handle_send_builder_link,
        "build_website": handle_build_website,
        "edit_website": handle_edit_website,
        "change_theme": handle_change_theme,
    }
