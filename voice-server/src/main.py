"""FastAPI application — /health endpoint and /media-stream WebSocket for Twilio."""

import asyncio
import json
import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from src.config import config
from src.pipeline import create_pipeline, create_after_hours_pipeline
from src.services.builder_api import fetch_business_context
from src.services.call_session import (
    create_call_session,
    end_call_session,
    update_recording_url,
)
from src.services.realtime import (
    broadcast_call_ended,
    cleanup_channel,
    inject_web_context_into_llm,
    subscribe_to_call_channel,
)
from src.tools import CallIdentity, CallState, TurnContext, ToolContext, AfterHoursContext

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Pravik Voice Server")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "pravik-voice-server"}


async def _extract_twilio_start(websocket: WebSocket) -> tuple[str, str, dict]:
    """
    Read initial Twilio Media Stream messages to extract stream metadata.

    Twilio sends:
      1. {"event": "connected", ...}
      2. {"event": "start", "start": {"streamSid": ..., "callSid": ..., "customParameters": {...}}}

    Returns (stream_sid, call_sid, custom_parameters).
    """
    stream_sid = ""
    call_sid = ""
    custom_params: dict = {}

    # Read up to 10 messages looking for the 'start' event
    for _ in range(10):
        raw = await websocket.receive_text()
        msg = json.loads(raw)

        if msg.get("event") == "connected":
            logger.info("Twilio Media Stream connected")
            continue

        if msg.get("event") == "start":
            start_data = msg.get("start", {})
            stream_sid = start_data.get("streamSid", "")
            call_sid = start_data.get("callSid", "")
            custom_params = start_data.get("customParameters", {})
            logger.info(
                f"[{call_sid}] Stream started — "
                f"user: {custom_params.get('userId', '')}, "
                f"project: {custom_params.get('projectId', '')}, "
                f"new: {custom_params.get('isNewUser', '')}"
            )
            break

    return stream_sid, call_sid, custom_params


@app.websocket("/media-stream")
async def media_stream(websocket: WebSocket):
    """Handle Twilio Media Stream WebSocket connections."""
    await websocket.accept()

    call_sid = ""
    recorder = None
    try:
        # --- Extract Twilio metadata from initial messages ---
        stream_sid, call_sid, params = await _extract_twilio_start(websocket)

        if not stream_sid or not call_sid:
            logger.error("Failed to extract stream_sid or call_sid from Twilio start event")
            await websocket.close()
            return

        mode = params.get("mode", "builder")

        # ===================================================================
        # AFTER-HOURS MODE — simpler pipeline, no browser companion
        # ===================================================================
        if mode == "after_hours":
            caller_phone = params.get("callerPhone", "")
            project_id = params.get("projectId", "")
            business_name = params.get("businessName", "")
            forwarding_phone = params.get("forwardingPhone", "")
            tool_id = params.get("toolId", "")
            transfer_enabled = params.get("transferEnabled", "true") == "true"
            logger.info(
                f"[{call_sid}] AFTER-HOURS call for '{business_name}' "
                f"from {caller_phone}, project: {project_id}"
            )

            # Create call session for tracking
            session = await create_call_session(
                call_sid=call_sid,
                user_id="",  # no user context for after-hours
                project_id=project_id,
                phone_number=caller_phone,
                is_new_user=False,
            )
            session_id = session["id"]
            logger.info(f"[{call_sid}] After-hours session created: {session_id}")

            # Fetch business context from website blocks
            try:
                site_context = await fetch_business_context(project_id)
            except Exception as e:
                logger.warning(f"[{call_sid}] Failed to fetch business context: {e}")
                site_context = ""

            # Build after-hours context
            ah_ctx = AfterHoursContext(
                call_sid=call_sid,
                session_id=session_id,
                caller_phone=caller_phone,
                project_id=project_id,
                business_name=business_name,
                forwarding_phone=forwarding_phone,
                tool_id=tool_id,
                transfer_enabled=transfer_enabled,
                site_context=site_context,
            )

            # Create and run after-hours pipeline (no Realtime subscription needed)
            task, runner, llm, recorder = create_after_hours_pipeline(
                websocket, stream_sid, call_sid, ah_ctx
            )
            ah_ctx.llm_ref = llm
            await runner.run(task)
            return  # cleanup handled in finally block

        # ===================================================================
        # BUILDER MODE — full pipeline with browser companion
        # ===================================================================
        user_id = params.get("userId", "")
        project_id = params.get("projectId", "")
        is_new_user = params.get("isNewUser") == "true"
        phone_number = params.get("phoneNumber", "")
        project_count = int(params.get("projectCount", "0"))
        latest_project_id = params.get("latestProjectId", "")
        latest_project_name = params.get("latestProjectName", "")
        logger.info(
            f"[{call_sid}] Phone: '{phone_number}', "
            f"new: {is_new_user}, projects: {project_count}, "
            f"latest: '{latest_project_name}' ({latest_project_id})"
        )

        # --- Create call session in DB ---
        # For returning users, project_id may be empty (deferred until they choose)
        session = await create_call_session(
            call_sid=call_sid,
            user_id=user_id,
            project_id=project_id if project_id else None,
            phone_number=phone_number,
            is_new_user=is_new_user,
        )
        session_id = session["id"]
        logger.info(f"[{call_sid}] Call session created: {session_id}")

        # --- Subscribe to Realtime channel for page-open + web action events ---
        # Use an Event gate + queue to buffer events that arrive before the LLM
        # is ready (between channel subscription and pipeline creation).
        _llm_ref = [None]  # set after create_pipeline
        _llm_ready = asyncio.Event()
        _pending_events: list[tuple[str, dict]] = []

        async def _drain_pending_events():
            """Replay any events that arrived before the LLM was ready."""
            for action_type, payload in _pending_events:
                try:
                    await inject_web_context_into_llm(_llm_ref[0], action_type, payload)
                except Exception as e:
                    logger.warning(f"[{call_sid}] Failed to replay queued event {action_type}: {e}")
            _pending_events.clear()

        def _on_page_opened():
            if tool_ctx.state.page_opened:
                logger.info(f"[{call_sid}] Page refresh detected — ignoring (already opened)")
                return
            logger.info(f"[{call_sid}] Page opened by user (first time)")
            tool_ctx.state.mark_page_opened()
            event_payload = {"message": "User opened the builder page on their phone."}
            if _llm_ready.is_set():
                asyncio.create_task(
                    inject_web_context_into_llm(_llm_ref[0], "page_opened", event_payload)
                )
            else:
                _pending_events.append(("page_opened", event_payload))
                logger.info(f"[{call_sid}] Queued page_opened — LLM not ready yet")

        def _on_web_action_wrapper(payload):
            action_type = payload.get("actionType", "unknown")
            image_urls = payload.get("imageUrls", [])

            if image_urls:
                tool_ctx.turn.pending_image_urls.extend(image_urls)
                logger.info(f"[{call_sid}] Stored {len(image_urls)} pending image URLs")

            # Handle project selection from dashboard (state update doesn't need LLM)
            if action_type == "project_selected_from_web":
                selected_id = payload.get("projectId", "")
                if selected_id:
                    tool_ctx.state.switch_project(selected_id)
                    logger.info(f"[{call_sid}] Project selected from web: {selected_id}")

            if _llm_ready.is_set():
                asyncio.create_task(
                    inject_web_context_into_llm(_llm_ref[0], action_type, payload)
                )
            else:
                _pending_events.append((action_type, payload))
                logger.info(f"[{call_sid}] Queued {action_type} — LLM not ready yet")

        await subscribe_to_call_channel(
            call_sid,
            on_page_opened=_on_page_opened,
            on_web_action=_on_web_action_wrapper,
        )

        # --- Build and run Pipecat pipeline ---
        tool_ctx = ToolContext(
            identity=CallIdentity(
                call_sid=call_sid,
                session_id=session_id,
                user_id=user_id,
                phone_number=phone_number,
                builder_api_url=config.builder_api_url,
                is_new_user=is_new_user,
            ),
            state=CallState(
                _project_id=project_id,
                project_count=project_count,
                latest_project_id=latest_project_id,
                latest_project_name=latest_project_name,
            ),
            turn=TurnContext(),
        )

        task, runner, llm, recorder = create_pipeline(websocket, stream_sid, call_sid, tool_ctx)

        # Activate handlers now that LLM is ready, then replay queued events
        _llm_ref[0] = llm
        tool_ctx.llm_ref = llm
        _llm_ready.set()
        if _pending_events:
            logger.info(f"[{call_sid}] Draining {len(_pending_events)} queued events")
            await _drain_pending_events()

        await runner.run(task)

    except WebSocketDisconnect:
        logger.info(f"[{call_sid}] Twilio WebSocket disconnected")
    except Exception as e:
        logger.error(f"[{call_sid}] Error in media stream: {e}", exc_info=True)
    finally:
        # --- Cleanup ---
        if call_sid:
            # Stop recording and upload
            if recorder:
                try:
                    recording_url = await recorder.stop_and_upload()
                    if recording_url:
                        await update_recording_url(call_sid, recording_url)
                        logger.info(f"[{call_sid}] Recording saved: {recording_url}")
                except Exception as e:
                    logger.warning(f"[{call_sid}] Failed to save recording: {e}")

            try:
                await end_call_session(call_sid)
            except Exception:
                pass
            try:
                await broadcast_call_ended(call_sid)
            except Exception:
                pass
            await cleanup_channel(call_sid)
            logger.info(f"[{call_sid}] Call session ended and cleaned up")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=config.host, port=config.port)
