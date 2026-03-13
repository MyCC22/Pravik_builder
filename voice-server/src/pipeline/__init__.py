"""Modular voice pipeline — transport, LLM, recorder, and builder.

Public API:
    create_pipeline()  — top-level factory for main.py (same signature as before)

Sub-modules:
    transport   — Twilio WebSocket transport factory
    llm_config  — OpenAI Realtime LLM factory
    recording   — Call recorder factory
    builder     — PipelineBuilder for fluent pipeline assembly
"""

from src.pipeline.transport import create_transport
from src.pipeline.llm_config import create_llm
from src.pipeline.recording import create_recorder
from src.pipeline.builder import PipelineBuilder

from src.tools import (
    ToolContext,
    get_tools_for_user,
    get_tool_schemas,
    build_tool_prompt_instructions,
    create_tool_handlers,
)
from src.prompts import build_system_instructions, build_initial_greeting
from src.services.audio_recorder import CallRecorder

from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineTask
from pipecat.services.openai.realtime.llm import OpenAIRealtimeLLMService


def create_pipeline(
    websocket,
    stream_sid: str,
    call_sid: str,
    tool_ctx: ToolContext,
) -> tuple[PipelineTask, PipelineRunner, OpenAIRealtimeLLMService, CallRecorder]:
    """
    Build the Pipecat pipeline for a single voice call.

    Returns (task, runner, llm, recorder) — caller should await runner.run(task).
    The llm ref is needed for injecting web page context into the session.
    The recorder ref is needed to stop recording and upload at call end.

    This is a convenience wrapper that composes the sub-modules:
    transport, llm_config, recording, and builder.
    """

    # --- Transport ---
    transport = create_transport(websocket, stream_sid, call_sid)

    # --- Tool registry ---
    tools = get_tools_for_user(is_returning=tool_ctx.state.project_count > 0)
    tool_schemas = get_tool_schemas(tools)
    tool_instructions = build_tool_prompt_instructions(tools)

    # --- System prompt ---
    system_instructions = build_system_instructions(
        is_new_user=tool_ctx.identity.is_new_user,
        project_count=tool_ctx.state.project_count,
        latest_project_name=tool_ctx.state.latest_project_name,
        latest_project_id=tool_ctx.state.latest_project_id,
        tool_instructions=tool_instructions,
    )

    # --- LLM ---
    llm = create_llm(system_instructions, tool_schemas)

    # --- Register tool handlers ---
    handlers = create_tool_handlers(tool_ctx, tools)
    for name, (handler, timeout) in handlers.items():
        llm.register_function(name, handler, timeout_secs=timeout)

    # --- Recorder ---
    recorder = create_recorder(call_sid)

    # --- Greeting ---
    greeting_prompt = build_initial_greeting(
        is_new_user=tool_ctx.identity.is_new_user,
        project_count=tool_ctx.state.project_count,
        latest_project_name=tool_ctx.state.latest_project_name,
        latest_project_id=tool_ctx.state.latest_project_id,
    )

    # --- Assemble ---
    task, runner = (
        PipelineBuilder()
        .with_transport(transport)
        .with_llm(llm)
        .with_recorder(recorder)
        .with_greeting(greeting_prompt)
        .build()
    )

    return task, runner, llm, recorder
