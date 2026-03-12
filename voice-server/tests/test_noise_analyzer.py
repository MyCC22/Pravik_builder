"""Unit tests for the noise floor analyzer module."""

import array
import math
import struct

import pytest

from src.services.noise_analyzer import (
    NOISY_THRESHOLD,
    QUIET_THRESHOLD,
    VAD_PRESETS,
    classify_noise_level,
    compute_rms,
)


def _make_pcm_silence(num_samples: int = 1000) -> bytes:
    """Generate silent PCM16 audio (all zeros)."""
    return b"\x00\x00" * num_samples


def _make_pcm_constant(value: int, num_samples: int = 1000) -> bytes:
    """Generate PCM16 audio with a constant sample value."""
    return struct.pack(f"<{num_samples}h", *([value] * num_samples))


def _make_pcm_sine(amplitude: int, frequency: float = 440.0, sample_rate: int = 16000, duration: float = 0.1) -> bytes:
    """Generate a PCM16 sine wave."""
    num_samples = int(sample_rate * duration)
    samples = []
    for i in range(num_samples):
        t = i / sample_rate
        sample = int(amplitude * math.sin(2 * math.pi * frequency * t))
        # Clamp to int16 range
        sample = max(-32768, min(32767, sample))
        samples.append(sample)
    return struct.pack(f"<{num_samples}h", *samples)


class TestComputeRMS:
    """Tests for the compute_rms function."""

    def test_silence_returns_zero(self):
        """Silent audio (all zeros) should have RMS of 0."""
        pcm = _make_pcm_silence(1000)
        assert compute_rms(pcm) == 0.0

    def test_empty_bytes_returns_zero(self):
        """Empty input should return 0."""
        assert compute_rms(b"") == 0.0

    def test_single_byte_returns_zero(self):
        """Single byte (incomplete sample) should return 0."""
        assert compute_rms(b"\x00") == 0.0

    def test_constant_value_returns_absolute(self):
        """Constant PCM value should give RMS = |value|."""
        value = 1000
        pcm = _make_pcm_constant(value, 1000)
        rms = compute_rms(pcm)
        assert abs(rms - value) < 1.0  # Should be exactly 1000

    def test_known_sine_rms(self):
        """Sine wave RMS should be approximately amplitude / sqrt(2)."""
        amplitude = 10000
        pcm = _make_pcm_sine(amplitude, frequency=440.0, duration=1.0)
        rms = compute_rms(pcm)
        expected_rms = amplitude / math.sqrt(2)
        # Allow 5% tolerance for edge effects
        assert abs(rms - expected_rms) / expected_rms < 0.05

    def test_louder_audio_higher_rms(self):
        """Louder audio should have higher RMS."""
        quiet = _make_pcm_sine(500, duration=0.5)
        loud = _make_pcm_sine(5000, duration=0.5)
        assert compute_rms(loud) > compute_rms(quiet)

    def test_odd_length_bytes_handled(self):
        """Odd number of bytes should not crash (truncates last byte)."""
        pcm = _make_pcm_constant(100, 10) + b"\x00"  # 21 bytes
        rms = compute_rms(pcm)
        assert rms > 0


class TestClassifyNoiseLevel:
    """Tests for the classify_noise_level function."""

    def test_silence_is_quiet(self):
        """RMS of 0 should classify as quiet."""
        assert classify_noise_level(0.0) == "quiet"

    def test_low_rms_is_quiet(self):
        """RMS below QUIET_THRESHOLD should be quiet."""
        assert classify_noise_level(QUIET_THRESHOLD - 1) == "quiet"

    def test_medium_rms_is_normal(self):
        """RMS between QUIET_THRESHOLD and NOISY_THRESHOLD should be normal."""
        mid = (QUIET_THRESHOLD + NOISY_THRESHOLD) / 2
        assert classify_noise_level(mid) == "normal"

    def test_high_rms_is_noisy(self):
        """RMS above NOISY_THRESHOLD should be noisy."""
        assert classify_noise_level(NOISY_THRESHOLD + 1) == "noisy"

    def test_exactly_quiet_threshold(self):
        """RMS exactly at QUIET_THRESHOLD should be normal (not quiet)."""
        assert classify_noise_level(QUIET_THRESHOLD) == "normal"

    def test_exactly_noisy_threshold(self):
        """RMS exactly at NOISY_THRESHOLD should be noisy."""
        assert classify_noise_level(NOISY_THRESHOLD) == "noisy"


class TestVADPresets:
    """Verify VAD presets have sensible values."""

    def test_all_presets_exist(self):
        """All noise levels should have a corresponding preset."""
        assert "quiet" in VAD_PRESETS
        assert "normal" in VAD_PRESETS
        assert "noisy" in VAD_PRESETS

    def test_noisy_has_higher_confidence(self):
        """Noisy preset should require higher VAD confidence."""
        assert VAD_PRESETS["noisy"].confidence > VAD_PRESETS["quiet"].confidence

    def test_noisy_has_higher_min_volume(self):
        """Noisy preset should require higher minimum volume."""
        assert VAD_PRESETS["noisy"].min_volume > VAD_PRESETS["quiet"].min_volume

    def test_noisy_has_longer_start_secs(self):
        """Noisy preset should require longer speech confirmation."""
        assert VAD_PRESETS["noisy"].start_secs > VAD_PRESETS["quiet"].start_secs

    def test_normal_is_between(self):
        """Normal preset values should be between quiet and noisy."""
        for param in ["confidence", "start_secs", "stop_secs", "min_volume"]:
            quiet_val = getattr(VAD_PRESETS["quiet"], param)
            normal_val = getattr(VAD_PRESETS["normal"], param)
            noisy_val = getattr(VAD_PRESETS["noisy"], param)
            assert quiet_val <= normal_val <= noisy_val, (
                f"{param}: quiet={quiet_val}, normal={normal_val}, noisy={noisy_val}"
            )
