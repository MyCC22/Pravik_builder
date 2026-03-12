"""Shared test configuration — mock pipecat and external dependencies.

The voice server runs on Railway with pipecat installed. For local testing,
we mock the pipecat and supabase imports so pure utility functions can be tested.
"""

import os
import sys
from dataclasses import dataclass
from types import ModuleType
from unittest.mock import MagicMock

# --- Set dummy environment variables before config is imported ---
os.environ.setdefault("OPENAI_API_KEY", "test-key")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("TWILIO_ACCOUNT_SID", "test-sid")
os.environ.setdefault("TWILIO_AUTH_TOKEN", "test-token")
os.environ.setdefault("TWILIO_PHONE_NUMBER", "+10000000000")


def _install_mock_modules():
    """Install mock modules into sys.modules before any src imports."""

    # --- Mock pipecat modules ---
    pipecat_modules = [
        "pipecat",
        "pipecat.audio",
        "pipecat.audio.vad",
        "pipecat.audio.vad.silero",
        "pipecat.frames",
        "pipecat.pipeline",
        "pipecat.pipeline.pipeline",
        "pipecat.pipeline.runner",
        "pipecat.pipeline.task",
        "pipecat.processors",
        "pipecat.processors.audio",
        "pipecat.processors.aggregators",
        "pipecat.processors.aggregators.openai_llm_context",
        "pipecat.services",
        "pipecat.services.openai_realtime_beta",
        "pipecat.transports",
        "pipecat.transports.websocket",
        "pipecat.transports.websocket.fastapi",
        "pipecat.serializers",
        "pipecat.serializers.twilio",
    ]

    for mod_name in pipecat_modules:
        if mod_name not in sys.modules:
            sys.modules[mod_name] = MagicMock()

    # --- VADParams: needs to be a real dataclass for tests ---
    @dataclass
    class VADParams:
        confidence: float = 0.7
        start_secs: float = 0.2
        stop_secs: float = 0.2
        min_volume: float = 0.6

    vad_mod = ModuleType("pipecat.audio.vad.vad_analyzer")
    vad_mod.VADParams = VADParams
    sys.modules["pipecat.audio.vad.vad_analyzer"] = vad_mod

    # --- FrameProcessor: needs to be a real class ---
    class FrameProcessor:
        async def push_frame(self, frame, direction=None):
            pass

    class FrameDirection:
        DOWNSTREAM = "downstream"
        UPSTREAM = "upstream"

    fp_mod = ModuleType("pipecat.processors.frame_processor")
    fp_mod.FrameProcessor = FrameProcessor
    fp_mod.FrameDirection = FrameDirection
    sys.modules["pipecat.processors.frame_processor"] = fp_mod

    # --- Frames: need real classes for isinstance checks ---
    class Frame:
        pass

    class AudioRawFrame(Frame):
        def __init__(self, audio=b"", sample_rate=16000, num_channels=1):
            self.audio = audio
            self.sample_rate = sample_rate
            self.num_channels = num_channels

    class SpeechControlParamsFrame(Frame):
        def __init__(self, vad_params=None):
            self.vad_params = vad_params

    class LLMRunFrame(Frame):
        pass

    frames_mod = ModuleType("pipecat.frames.frames")
    frames_mod.Frame = Frame
    frames_mod.AudioRawFrame = AudioRawFrame
    frames_mod.SpeechControlParamsFrame = SpeechControlParamsFrame
    frames_mod.LLMRunFrame = LLMRunFrame
    sys.modules["pipecat.frames.frames"] = frames_mod

    # --- AudioBufferProcessor mock ---
    abp_mod = ModuleType("pipecat.processors.audio.audio_buffer_processor")
    abp_mod.AudioBufferProcessor = MagicMock
    sys.modules["pipecat.processors.audio.audio_buffer_processor"] = abp_mod

    # --- Mock supabase and other external modules ---
    external_modules = [
        "supabase",
        "twilio",
        "twilio.rest",
        "dotenv",
    ]
    for mod_name in external_modules:
        if mod_name not in sys.modules:
            sys.modules[mod_name] = MagicMock()


# Install mocks before pytest collects test files
_install_mock_modules()
