"""Pipecat pipeline construction: Twilio transport, RNNoise filter, OpenAI Realtime S2S."""

import logging

from pipecat.frames.frames import LLMRunFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContext,
    LLMContextAggregatorPair,
)
from pipecat.services.openai.realtime.llm import (
    OpenAIRealtimeLLMService,
    OpenAIRealtimeLLMSettings,
)
from pipecat.services.openai.realtime.events import (
    AudioConfiguration,
    AudioInput,
    AudioOutput,
    InputAudioNoiseReduction,
    InputAudioTranscription,
    SemanticTurnDetection,
    SessionProperties,
)
from pipecat.transports.websocket.fastapi import (
    FastAPIWebsocketParams,
    FastAPIWebsocketTransport,
)
from pipecat.audio.filters.rnnoise_filter import RNNoiseFilter
from pipecat.serializers.twilio import TwilioFrameSerializer

from src.config import config
from src.services.audio_recorder import CallRecorder
from src.tools import (
    ToolContext,
    get_tools_for_user,
    get_tool_schemas,
    build_tool_prompt_instructions,
    create_tool_handlers,
)
from src.prompts import build_system_instructions, build_initial_greeting

logger = logging.getLogger(__name__)


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
    """

    # --- Transport: Twilio WebSocket ---
    # RNNoiseFilter runs local neural noise reduction on incoming audio before
    # it reaches OpenAI. This provides defense-in-depth: local RNNoise filter
    # + OpenAI's server-side near_field noise reduction + semantic turn detection.
    transport = FastAPIWebsocketTransport(
        websocket=websocket,
        params=FastAPIWebsocketParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            add_wav_header=False,
            audio_in_filter=RNNoiseFilter(),
            serializer=TwilioFrameSerializer(
                stream_sid,
                call_sid=call_sid,
                account_sid=config.twilio_account_sid,
                auth_token=config.twilio_auth_token,
            ),
        ),
    )

    # --- Tool registry: get tools for this user type ---
    tools = get_tools_for_user(is_returning=tool_ctx.state.project_count > 0)
    tool_schemas = get_tool_schemas(tools)
    tool_instructions = build_tool_prompt_instructions(tools)

    # --- Dynamic system prompt based on new vs returning user ---
    system_instructions = build_system_instructions(
        is_new_user=tool_ctx.identity.is_new_user,
        project_count=tool_ctx.state.project_count,
        latest_project_name=tool_ctx.state.latest_project_name,
        tool_instructions=tool_instructions,
    )

    # --- LLM: OpenAI Realtime speech-to-speech ---
    llm = OpenAIRealtimeLLMService(
        api_key=config.openai_api_key,
        settings=OpenAIRealtimeLLMSettings(
            model="gpt-realtime-1.5",
            session_properties=SessionProperties(
                instructions=system_instructions,
                audio=AudioConfiguration(
                    input=AudioInput(
                        transcription=InputAudioTranscription(model="whisper-1"),
                        turn_detection=SemanticTurnDetection(type="semantic_vad", eagerness="medium"),
                        noise_reduction=InputAudioNoiseReduction(type="near_field"),
                    ),
                    output=AudioOutput(
                        voice="ash",
                    ),
                ),
                tools=tool_schemas,
            ),
        ),
    )

    # --- Register tool handlers ---
    # Builder API calls can take 15-30s. Default Pipecat timeout is 10s which
    # causes premature cancellation. Timeouts are defined per-tool in the registry.
    handlers = create_tool_handlers(tool_ctx, tools)
    for name, (handler, timeout) in handlers.items():
        llm.register_function(name, handler, timeout_secs=timeout)

    # --- Call Recorder: stereo WAV (user=left, bot=right) ---
    recorder = CallRecorder(call_sid=call_sid, sample_rate=16000)

    # --- Context: initial greeting message triggers context frame delivery ---
    # Tools are configured in SessionProperties above; LLMContext only needs messages.
    greeting_prompt = build_initial_greeting(
        is_new_user=tool_ctx.identity.is_new_user,
        project_count=tool_ctx.state.project_count,
        latest_project_name=tool_ctx.state.latest_project_name,
    )
    context = LLMContext(
        messages=[{"role": "user", "content": greeting_prompt}],
    )
    context_aggregator = LLMContextAggregatorPair(context)

    # --- Pipeline ---
    pipeline = Pipeline(
        [
            transport.input(),
            context_aggregator.user(),
            llm,
            context_aggregator.assistant(),
            transport.output(),
            recorder.processor,  # captures stereo audio after output
        ]
    )

    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            allow_interruptions=True,
            enable_metrics=True,
            audio_in_sample_rate=16000,
            audio_out_sample_rate=24000,
        ),
    )

    # Queue initial LLMRunFrame when transport connects to trigger greeting
    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        await recorder.start()
        await task.queue_frames([LLMRunFrame()])

    runner = PipelineRunner()
    return task, runner, llm, recorder
