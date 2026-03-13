"""OpenAI Realtime LLM factory."""

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

from src.config import config


def create_llm(
    system_instructions: str,
    tool_schemas: list[dict],
) -> OpenAIRealtimeLLMService:
    """
    Configure OpenAI Realtime speech-to-speech LLM.

    Uses gpt-realtime-1.5 with Whisper transcription, semantic VAD,
    near-field noise reduction, and the "ash" voice.
    """
    return OpenAIRealtimeLLMService(
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
