"""Tool definitions and handler functions for the voice AI agent."""

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, Callable

import httpx
from pipecat.services.llm_service import FunctionCallParams

from src.services.builder_api import call_builder_api, fetch_site_state
from src.services.call_session import save_call_message, update_call_state
from src.services.realtime import broadcast_preview_update
from src.services.twilio_sms import send_sms

logger = logging.getLogger(__name__)

# Clarify questions that can be auto-answered when user intent is obvious
_AUTO_YES_PATTERNS = [
    "would you like me to add one",
    "would you like to add",
    "would you like me to create",
    "should i add",
    "would you like me to add",
]

# OpenAI Realtime tool definitions
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
            "Make ANY change to the existing website. This tool handles ALL of the following:\n"
            "- TEXT: headlines, titles, subtitles, descriptions, button text, phone numbers, addresses, emails\n"
            "- FORMS: add/remove form fields, make fields required, change form title, add dropdown options, change submit button text\n"
            "- IMAGES: change hero image, swap gallery photos, use darker/brighter image, add background image\n"
            "- SECTIONS: add new section (testimonials, gallery, pricing, FAQ, etc.), remove a section\n"
            "- STYLE: make background darker, change spacing, adjust text size, change overlay\n"
            "There is NO change you cannot make. If the user asks to change ANYTHING, call this tool."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "instruction": {
                    "type": "string",
                    "description": (
                        'Describe exactly what to change. Be specific. Examples:\n'
                        '"Change the hero headline to Welcome to My Academy"\n'
                        '"Add a city dropdown field to the booking form"\n'
                        '"Make the email field required on the form"\n'
                        '"Change the hero background image to something with mountains"\n'
                        '"Add a testimonials section with 3 customer quotes"\n'
                        '"Remove the pricing section"\n'
                        '"Make the hero background image darker"\n'
                        '"Change the form submit button text to Book Now"\n'
                        '"Add a dropdown field for service type with options: haircut, color, styling"'
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
    link_sent: bool = False
    page_opened: bool = False
    llm_ref: Any = None
    last_edit_summary: str = ""


def create_tool_handlers(ctx: ToolContext) -> dict[str, Callable]:
    """
    Create tool handler functions bound to a specific call context.

    Returns a dict mapping tool name -> async handler following Pipecat's
    register_function callback signature.
    """

    # ------------------------------------------------------------------
    # Shared helpers
    # ------------------------------------------------------------------

    async def _send_sms_if_needed():
        """Auto-send the builder link SMS if the AI skipped send_builder_link.

        Skips if the user already has the page open (no point texting them).
        """
        if ctx.link_sent or ctx.page_opened:
            if ctx.page_opened:
                logger.info(f"[{ctx.call_sid}] Page already open — skipping auto SMS")
            return
        ctx.link_sent = True
        links_url = f"{ctx.builder_api_url}/links"
        if ctx.phone_number:
            try:
                sms_body = (
                    f"Your website builder is ready! Open this link to see your "
                    f"website being built in real time: {links_url}"
                )
                logger.info(f"[{ctx.call_sid}] Auto-sending SMS (AI skipped send_builder_link)...")
                sms_sid = await send_sms(ctx.phone_number, sms_body)
                logger.info(f"[{ctx.call_sid}] Auto SMS sent: {sms_sid}")
            except Exception as e:
                logger.error(f"[{ctx.call_sid}] Auto SMS failed: {e}")
        else:
            logger.warning(f"[{ctx.call_sid}] No phone number — auto SMS skipped")

    async def _call_api_with_retry(
        message: str,
        image_urls: list[str] | None = None,
    ) -> dict[str, Any]:
        """Call builder API with one retry on timeout."""
        try:
            return await call_builder_api(
                ctx.builder_api_url, message, ctx.project_id,
                image_urls=image_urls,
            )
        except httpx.TimeoutException:
            logger.warning(f"[{ctx.call_sid}] Builder API timeout, retrying...")
            return await call_builder_api(
                ctx.builder_api_url, message, ctx.project_id,
                image_urls=image_urls,
            )

    async def _inject_site_context():
        """Fetch current site state and inject as silent context into the LLM."""
        if not ctx.llm_ref:
            return
        try:
            state = await fetch_site_state(ctx.project_id)
            blocks = state.get("blocks", [])
            tools = state.get("tools", [])

            if not blocks:
                return

            block_list = ", ".join(b["block_type"] for b in blocks)

            tool_summary = ""
            for t in tools:
                if t.get("tool_type") == "booking":
                    cfg = t.get("config") or {}
                    fields = ", ".join(f.get("label", f.get("name", "?")) for f in cfg.get("fields", []))
                    tool_summary = f" Booking form: title=\"{cfg.get('title', '')}\", fields=[{fields}]."

            context_text = (
                f"[SITE STATE: Website sections: {block_list}.{tool_summary} "
                f"Use this when the user asks about what's on their site.]"
            )

            import pipecat.services.openai.realtime.events as events

            item = events.ConversationItem(
                type="message",
                role="user",
                content=[events.ItemContent(type="input_text", text=context_text)],
            )
            await ctx.llm_ref.send_client_event(events.ConversationItemCreateEvent(item=item))
            logger.info(f"[{ctx.call_sid}] Site context injected: {len(blocks)} blocks{', has form' if tool_summary else ''}")
        except Exception as e:
            logger.warning(f"[{ctx.call_sid}] Failed to inject site context: {e}")

    def _is_auto_answerable(question: str, instruction: str) -> bool:
        """Check if a clarify question can be auto-answered with 'yes'."""
        q_lower = question.lower()
        return any(p in q_lower for p in _AUTO_YES_PATTERNS)

    # ------------------------------------------------------------------
    # Tool handlers
    # ------------------------------------------------------------------

    async def handle_send_builder_link(params: FunctionCallParams):
        logger.info(f"[{ctx.call_sid}] send_builder_link called, phone='{ctx.phone_number}'")
        links_url = f"{ctx.builder_api_url}/links"
        try:
            await params.result_callback(
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

            ctx.link_sent = True

            async def _background():
                try:
                    await update_call_state(ctx.call_sid, "waiting_for_page")
                    if ctx.phone_number:
                        sms_body = (
                            f"Your website builder is ready! Open this link to see your "
                            f"website being built in real time: {links_url}"
                        )
                        logger.info(f"[{ctx.call_sid}] Sending SMS to {ctx.phone_number}...")
                        sms_sid = await send_sms(ctx.phone_number, sms_body)
                        logger.info(f"[{ctx.call_sid}] SMS sent: {sms_sid}")
                    else:
                        logger.warning(f"[{ctx.call_sid}] No phone number — SMS skipped")
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
            await params.result_callback(
                {"message": "Failed to send the link. Ask the user to try again."}
            )

    async def handle_build_website(params: FunctionCallParams):
        description = params.arguments.get("description", "")
        try:
            await _send_sms_if_needed()
            await update_call_state(ctx.call_sid, "building")

            image_urls = list(ctx.pending_image_urls)
            ctx.pending_image_urls.clear()

            result = await _call_api_with_retry(
                description,
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
            await params.result_callback({"message": result.get("message", "Website built!")})

            # Inject site state so AI knows what's on the page
            asyncio.create_task(_inject_site_context())
        except Exception as err:
            logger.error(f"[{ctx.call_sid}] Build failed: {err}")
            await params.result_callback(
                {
                    "message": "Sorry, there was an error building the website. "
                    "Please try describing what you want again."
                }
            )

    async def handle_edit_website(params: FunctionCallParams):
        instruction = params.arguments.get("instruction", "").strip()

        # Guard: empty instruction
        if not instruction:
            await params.result_callback({
                "message": "I need to know what to change. Ask the user what they'd like to edit."
            })
            return

        # Guard: no blocks yet — need to build first
        try:
            state = await fetch_site_state(ctx.project_id)
            if not state.get("blocks"):
                await params.result_callback({
                    "message": (
                        "The website hasn't been built yet. Ask the user what kind of "
                        "website they want, then call build_website to create it first."
                    )
                })
                return
        except Exception:
            pass  # Non-critical — proceed with edit

        # Always include last edit context as a hint for the builder API.
        # The builder has its own message history too — this is additive,
        # harmless for standalone requests, and helps follow-ups.
        if ctx.last_edit_summary:
            instruction = f"(Previous edit: {ctx.last_edit_summary}) {instruction}"

        try:
            image_urls = list(ctx.pending_image_urls)
            ctx.pending_image_urls.clear()

            result = await _call_api_with_retry(
                instruction,
                image_urls=image_urls if image_urls else None,
            )

            action = result.get("action", "edited")

            # Handle clarify intent — ask user for more info
            if action == "clarify":
                question = result.get("question", result.get("message", "Could you be more specific?"))
                logger.info(f"[{ctx.call_sid}] Clarify returned: {question}")

                # Auto-retry obvious yes/no when user intent is clear
                if _is_auto_answerable(question, instruction):
                    logger.info(f"[{ctx.call_sid}] Auto-answering clarify with yes")
                    retry_result = await _call_api_with_retry(
                        f"Yes, please do it. Original request: {instruction}",
                    )
                    if retry_result.get("action") != "clarify":
                        await broadcast_preview_update(
                            ctx.call_sid,
                            action=retry_result.get("action", "edited"),
                            message=retry_result.get("message", ""),
                            project_id=ctx.project_id,
                        )
                        await save_call_message(
                            call_session_id=ctx.session_id,
                            role="assistant",
                            content=retry_result.get("message", ""),
                            intent="edit_website",
                        )
                        ctx.last_edit_summary = f"{instruction} -> {retry_result.get('message', '')}"
                        await params.result_callback({"message": retry_result.get("message", "Done!")})
                        asyncio.create_task(_inject_site_context())
                        return

                # Can't auto-answer — tell AI to ask the user
                await params.result_callback({
                    "message": (
                        f"I need more information before making this change. "
                        f"Ask the user: {question} "
                        f"Once they answer, call edit_website again with their "
                        f"clarified request combined with the original context."
                    )
                })
                return

            # Success — broadcast and save
            await broadcast_preview_update(
                ctx.call_sid,
                action=action,
                message=result.get("message", ""),
                project_id=ctx.project_id,
            )

            await save_call_message(
                call_session_id=ctx.session_id,
                role="assistant",
                content=result.get("message", ""),
                intent="edit_website",
            )

            ctx.last_edit_summary = f"{instruction} -> {result.get('message', '')}"
            await params.result_callback({
                "message": (
                    f"{result.get('message', 'Changes applied!')} "
                    f"If the user wants to refine this change, call edit_website again."
                )
            })

            # Inject updated site state
            asyncio.create_task(_inject_site_context())
        except Exception as err:
            logger.error(f"[{ctx.call_sid}] Edit failed: {err}")
            await params.result_callback(
                {"message": "Sorry, there was an error making that change. Please try again."}
            )

    async def handle_change_theme(params: FunctionCallParams):
        request = params.arguments.get("request", "")
        try:
            result = await _call_api_with_retry(request)

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

            await params.result_callback({"message": result.get("message", "Theme changed!")})
        except Exception as err:
            logger.error(f"[{ctx.call_sid}] Theme change failed: {err}")
            await params.result_callback(
                {"message": "Sorry, there was an error changing the theme. Please try again."}
            )

    return {
        "send_builder_link": handle_send_builder_link,
        "build_website": handle_build_website,
        "edit_website": handle_edit_website,
        "change_theme": handle_change_theme,
    }
