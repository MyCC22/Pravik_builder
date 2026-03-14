"""Pipeline assembly: combines transport, LLM, context, and recorder into a runnable pipeline."""

import asyncio
import logging
from typing import Any, Callable

from pipecat.frames.frames import LLMRunFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContext,
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.turns.user_turn_strategies import UserTurnStrategies
from pipecat.turns.user_start.vad_user_turn_start_strategy import VADUserTurnStartStrategy

from src.services.audio_recorder import CallRecorder

logger = logging.getLogger(__name__)


class PipelineBuilder:
    """Fluent builder for voice pipeline assembly.

    Usage:
        task, runner = (
            PipelineBuilder()
            .with_transport(transport)
            .with_llm(llm)
            .with_recorder(recorder)
            .with_greeting(greeting_prompt)
            .on_client_connected(lambda: recorder.start())
            .build()
        )
    """

    def __init__(self):
        self._transport = None
        self._llm = None
        self._recorder: CallRecorder | None = None
        self._greeting_prompt: str = ""
        self._on_connected_callbacks: list[Callable] = []

    def with_transport(self, transport) -> "PipelineBuilder":
        """Set the WebSocket transport."""
        self._transport = transport
        return self

    def with_llm(self, llm) -> "PipelineBuilder":
        """Set the LLM service."""
        self._llm = llm
        return self

    def with_recorder(self, recorder: CallRecorder) -> "PipelineBuilder":
        """Set the audio recorder (optional)."""
        self._recorder = recorder
        return self

    def with_greeting(self, greeting_prompt: str) -> "PipelineBuilder":
        """Set the initial greeting prompt that triggers the first LLM response."""
        self._greeting_prompt = greeting_prompt
        return self

    def on_client_connected(self, callback: Callable) -> "PipelineBuilder":
        """Register a callback for when the Twilio client connects."""
        self._on_connected_callbacks.append(callback)
        return self

    def build(self) -> tuple[PipelineTask, PipelineRunner]:
        """Assemble and return (task, runner).

        Raises ValueError if transport or llm are not set.
        """
        if not self._transport:
            raise ValueError("Transport is required — call .with_transport() first")
        if not self._llm:
            raise ValueError("LLM is required — call .with_llm() first")

        # Context aggregator with initial greeting.
        #
        # IMPORTANT: Override the default user turn start strategies.
        # Default = [VADUserTurnStartStrategy, TranscriptionUserTurnStartStrategy]
        #
        # TranscriptionUserTurnStartStrategy fires as soon as Whisper produces
        # ANY transcription text, triggering an interruption.  On phone calls via
        # Twilio, echo/noise frequently produces 1-5ms "speech" events that
        # immediately cancel the bot's response and even cancel in-progress tool
        # calls (e.g. select_project gets cancelled mid-execution).
        #
        # We keep only VADUserTurnStartStrategy (which won't fire without a local
        # VAD analyzer — there is none in this pipeline) and let OpenAI's
        # server-side semantic VAD handle all turn detection and interruptions.
        context = LLMContext(
            messages=[{"role": "user", "content": self._greeting_prompt}] if self._greeting_prompt else [],
        )
        context_aggregator = LLMContextAggregatorPair(
            context,
            user_params=LLMUserAggregatorParams(
                user_turn_strategies=UserTurnStrategies(
                    start=[VADUserTurnStartStrategy()],
                ),
            ),
        )

        # Pipeline stages
        stages: list[Any] = [
            self._transport.input(),
            context_aggregator.user(),
            self._llm,
            context_aggregator.assistant(),
            self._transport.output(),
        ]

        if self._recorder:
            stages.append(self._recorder.processor)

        pipeline = Pipeline(stages)

        task = PipelineTask(
            pipeline,
            params=PipelineParams(
                allow_interruptions=True,
                enable_metrics=True,
                audio_in_sample_rate=16000,
                audio_out_sample_rate=24000,
            ),
        )

        # Register on_client_connected event handler
        callbacks = self._on_connected_callbacks
        recorder = self._recorder

        @self._transport.event_handler("on_client_connected")
        async def _on_client_connected(transport, client):
            if recorder:
                await recorder.start()
            await task.queue_frames([LLMRunFrame()])
            for cb in callbacks:
                await cb() if asyncio.iscoroutinefunction(cb) else cb()

        runner = PipelineRunner()
        return task, runner
