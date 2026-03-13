"""Call recorder factory."""

from src.services.audio_recorder import CallRecorder


def create_recorder(call_sid: str, sample_rate: int = 16000) -> CallRecorder:
    """Configure stereo audio recorder for a call."""
    return CallRecorder(call_sid=call_sid, sample_rate=sample_rate)
