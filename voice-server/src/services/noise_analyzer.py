"""Noise floor analyzer for dynamic VAD adjustment.

Analyzes the first few seconds of a phone call to estimate background noise
level, then adjusts Silero VAD parameters to match the environment.

Quiet environment  → relaxed thresholds (more sensitive, catches soft speech)
Noisy environment  → strict thresholds (filters background noise better)
"""

import array
import asyncio
import logging
import math

from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.frames.frames import AudioRawFrame, Frame
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor

logger = logging.getLogger(__name__)

# VAD presets tuned for phone calls via Twilio (8kHz upsampled to 16kHz)
VAD_PRESETS: dict[str, VADParams] = {
    "quiet": VADParams(
        confidence=0.7,
        start_secs=0.2,
        stop_secs=0.4,
        min_volume=0.5,
    ),
    "normal": VADParams(
        confidence=0.8,
        start_secs=0.3,
        stop_secs=0.5,
        min_volume=0.7,
    ),
    "noisy": VADParams(
        confidence=0.9,
        start_secs=0.4,
        stop_secs=0.6,
        min_volume=0.8,
    ),
}

# RMS thresholds for classifying noise level (PCM16 scale: 0–32767)
# These are calibrated for Twilio mulaw→PCM16 audio at 16kHz.
QUIET_THRESHOLD = 500
NOISY_THRESHOLD = 2000


def compute_rms(pcm_data: bytes) -> float:
    """Compute RMS (root mean square) energy of PCM16 little-endian audio.

    Args:
        pcm_data: Raw PCM16 audio bytes (int16 little-endian)

    Returns:
        RMS value on int16 scale (0–32767). Higher = louder.
    """
    if len(pcm_data) < 2:
        return 0.0

    # Convert bytes to int16 array
    samples = array.array("h")  # signed short (int16)
    # Ensure even length
    if len(pcm_data) % 2 != 0:
        pcm_data = pcm_data[: len(pcm_data) - 1]
    samples.frombytes(pcm_data)

    if len(samples) == 0:
        return 0.0

    # Compute RMS
    sum_sq = sum(s * s for s in samples)
    return math.sqrt(sum_sq / len(samples))


def classify_noise_level(rms: float) -> str:
    """Classify noise level based on RMS value.

    Returns: "quiet", "normal", or "noisy"
    """
    if rms < QUIET_THRESHOLD:
        return "quiet"
    elif rms < NOISY_THRESHOLD:
        return "normal"
    else:
        return "noisy"


class NoiseFloorAnalyzer(FrameProcessor):
    """Pipecat FrameProcessor that analyzes initial audio and adjusts VAD.

    Sits in the pipeline and observes the first N seconds of audio input.
    After analysis, pushes updated VAD parameters via the pipeline's
    VAD analyzer, then becomes a zero-overhead passthrough.

    Args:
        vad_analyzer: The SileroVADAnalyzer instance to update. Its set_params()
                      method is called with the chosen preset.
        analysis_duration_secs: How many seconds of audio to analyze (default: 3.0)
        sample_rate: Expected audio sample rate in Hz (default: 16000)
        call_sid: Optional call ID for log context
    """

    def __init__(
        self,
        vad_analyzer,
        analysis_duration_secs: float = 3.0,
        sample_rate: int = 16000,
        call_sid: str = "",
        **kwargs,
    ):
        super().__init__(**kwargs)
        self._vad_analyzer = vad_analyzer
        self._analysis_duration = analysis_duration_secs
        self._sample_rate = sample_rate
        self._call_sid = call_sid

        self._buffer = bytearray()
        self._accumulated_secs = 0.0
        self._analysis_complete = False

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        """Process each frame — observe audio, pass everything through."""
        # Always pass the frame through immediately (we're just observing)
        await self.push_frame(frame, direction)

        # Only analyze AudioRawFrames in the downstream direction
        if self._analysis_complete:
            return
        if not isinstance(frame, AudioRawFrame):
            return

        # Accumulate audio bytes
        audio_bytes = frame.audio
        self._buffer.extend(audio_bytes)
        # PCM16 = 2 bytes per sample
        self._accumulated_secs += len(audio_bytes) / (2 * self._sample_rate)

        if self._accumulated_secs >= self._analysis_duration:
            self._analyze_and_adjust()

    def _analyze_and_adjust(self):
        """Compute noise floor RMS, classify, and update VAD params."""
        rms = compute_rms(bytes(self._buffer))
        level = classify_noise_level(rms)
        new_params = VAD_PRESETS[level]

        logger.info(
            f"[{self._call_sid}] Noise floor analysis: "
            f"RMS={rms:.0f}, level={level}, "
            f"confidence={new_params.confidence}, "
            f"start_secs={new_params.start_secs}, "
            f"stop_secs={new_params.stop_secs}, "
            f"min_volume={new_params.min_volume}"
        )

        # Update the VAD analyzer directly
        self._vad_analyzer.set_params(new_params)

        self._analysis_complete = True
        self._buffer.clear()  # free memory

    @property
    def analysis_complete(self) -> bool:
        return self._analysis_complete
