"""Modular voice pipeline — transport, LLM, recorder, and builder.

Public API:
    create_pipeline()              — factory for builder calls (main.py)
    create_after_hours_pipeline()  — factory for after-hours calls (main.py)

Sub-modules:
    transport   — Twilio WebSocket transport factory
    llm_config  — OpenAI Realtime LLM factory
    recording   — Call recorder factory
    builder     — PipelineBuilder for fluent pipeline assembly
"""

from functools import partial

from src.pipeline.transport import create_transport
from src.pipeline.llm_config import create_llm
from src.pipeline.recording import create_recorder
from src.pipeline.builder import PipelineBuilder

from src.tools import (
    ToolContext,
    AfterHoursContext,
    get_tools_for_user,
    get_after_hours_tools,
    get_tool_schemas,
    build_tool_prompt_instructions,
    create_tool_handlers,
)
from src.prompts import build_system_instructions, build_initial_greeting
from src.prompts.layers import build_after_hours_instructions
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


def create_after_hours_pipeline(
    websocket,
    stream_sid: str,
    call_sid: str,
    ah_ctx: AfterHoursContext,
) -> tuple[PipelineTask, PipelineRunner, OpenAIRealtimeLLMService, CallRecorder]:
    """
    Build the Pipecat pipeline for an after-hours call.

    Same structure as the builder pipeline but with:
    - After-hours tools only (save_caller_info, transfer_to_owner)
    - Simpler system prompt (business Q&A + message taking)
    - No builder-specific logic

    Returns (task, runner, llm, recorder) — caller should await runner.run(task).
    """

    # --- Transport ---
    transport = create_transport(websocket, stream_sid, call_sid)

    # --- Tool registry (after-hours tools only) ---
    tools = get_after_hours_tools()
    tool_schemas = get_tool_schemas(tools)
    tool_instructions = build_tool_prompt_instructions(tools)

    # --- System prompt ---
    system_instructions = build_after_hours_instructions(
        business_name=ah_ctx.business_name,
        site_context=ah_ctx.site_context,
        transfer_enabled=ah_ctx.transfer_enabled,
        tool_instructions=tool_instructions,
    )

    # --- LLM ---
    llm = create_llm(system_instructions, tool_schemas)

    # --- Register tool handlers (bind ah_ctx instead of ToolContext) ---
    for tool in tools:
        wrapped = partial(tool.handle, ah_ctx)
        llm.register_function(tool.name, wrapped, timeout_secs=tool.timeout)

    # --- Recorder ---
    recorder = create_recorder(call_sid)

    # --- Greeting (after-hours AI greets immediately) ---
    greeting_prompt = (
        f"A caller is calling {ah_ctx.business_name} after business hours. "
        f"Greet them warmly, let them know the business is currently closed, "
        f"and offer to help."
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
