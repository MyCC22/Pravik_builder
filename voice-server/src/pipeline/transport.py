"""Twilio WebSocket transport factory."""

from pipecat.audio.filters.rnnoise_filter import RNNoiseFilter
from pipecat.serializers.twilio import TwilioFrameSerializer
from pipecat.transports.websocket.fastapi import (
    FastAPIWebsocketParams,
    FastAPIWebsocketTransport,
)

from src.config import config


def create_transport(
    websocket,
    stream_sid: str,
    call_sid: str,
) -> FastAPIWebsocketTransport:
    """
    Configure Twilio WebSocket transport with noise filtering.

    RNNoiseFilter runs local neural noise reduction on incoming audio before
    it reaches OpenAI. This provides defense-in-depth: local RNNoise filter
    + OpenAI's server-side near_field noise reduction + semantic turn detection.

    Audio pipeline: Twilio → RNNoise (local) → near_field (OpenAI) → Semantic VAD → LLM
    """
    return FastAPIWebsocketTransport(
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
