"""Unit tests for the audio recorder module."""

import io
import struct
import wave

import pytest

from src.services.audio_recorder import pcm_to_wav


def _make_pcm_data(num_samples: int = 1000, num_channels: int = 2, value: int = 100) -> bytes:
    """Generate simple PCM16 audio data."""
    total_samples = num_samples * num_channels
    return struct.pack(f"<{total_samples}h", *([value] * total_samples))


class TestPCMToWAV:
    """Tests for the pcm_to_wav function."""

    def test_produces_valid_wav(self):
        """Output should be a valid WAV file that can be opened."""
        pcm = _make_pcm_data(1000, num_channels=2)
        wav_bytes = pcm_to_wav(pcm, sample_rate=16000, num_channels=2)

        # Should be parseable by wave module
        buf = io.BytesIO(wav_bytes)
        with wave.open(buf, "rb") as wf:
            assert wf.getnchannels() == 2
            assert wf.getsampwidth() == 2
            assert wf.getframerate() == 16000

    def test_correct_channel_count(self):
        """WAV file should have the correct number of channels."""
        for channels in [1, 2]:
            pcm = _make_pcm_data(500, num_channels=channels)
            wav_bytes = pcm_to_wav(pcm, num_channels=channels)

            buf = io.BytesIO(wav_bytes)
            with wave.open(buf, "rb") as wf:
                assert wf.getnchannels() == channels

    def test_correct_sample_rate(self):
        """WAV file should have the correct sample rate."""
        for sr in [8000, 16000, 44100]:
            pcm = _make_pcm_data(500)
            wav_bytes = pcm_to_wav(pcm, sample_rate=sr)

            buf = io.BytesIO(wav_bytes)
            with wave.open(buf, "rb") as wf:
                assert wf.getframerate() == sr

    def test_correct_sample_width(self):
        """WAV file should have 16-bit (2 byte) sample width."""
        pcm = _make_pcm_data(500)
        wav_bytes = pcm_to_wav(pcm)

        buf = io.BytesIO(wav_bytes)
        with wave.open(buf, "rb") as wf:
            assert wf.getsampwidth() == 2

    def test_correct_frame_count(self):
        """WAV file should have the correct number of frames."""
        num_samples = 1000  # frames per channel
        num_channels = 2
        pcm = _make_pcm_data(num_samples, num_channels=num_channels)
        wav_bytes = pcm_to_wav(pcm, num_channels=num_channels)

        buf = io.BytesIO(wav_bytes)
        with wave.open(buf, "rb") as wf:
            assert wf.getnframes() == num_samples

    def test_wav_starts_with_riff(self):
        """WAV file should start with RIFF header."""
        pcm = _make_pcm_data(100)
        wav_bytes = pcm_to_wav(pcm)
        assert wav_bytes[:4] == b"RIFF"

    def test_wav_contains_wave_marker(self):
        """WAV file should contain WAVE format marker."""
        pcm = _make_pcm_data(100)
        wav_bytes = pcm_to_wav(pcm)
        assert wav_bytes[8:12] == b"WAVE"

    def test_empty_pcm_produces_valid_wav(self):
        """Empty PCM data should still produce a valid (empty) WAV."""
        wav_bytes = pcm_to_wav(b"", num_channels=2)

        buf = io.BytesIO(wav_bytes)
        with wave.open(buf, "rb") as wf:
            assert wf.getnframes() == 0
            assert wf.getnchannels() == 2

    def test_mono_wav(self):
        """Mono WAV should work correctly."""
        pcm = _make_pcm_data(500, num_channels=1)
        wav_bytes = pcm_to_wav(pcm, num_channels=1)

        buf = io.BytesIO(wav_bytes)
        with wave.open(buf, "rb") as wf:
            assert wf.getnchannels() == 1
            assert wf.getnframes() == 500

    def test_data_integrity(self):
        """WAV data should match original PCM data."""
        # Create known PCM data
        num_samples = 100
        pcm = struct.pack(f"<{num_samples * 2}h", *list(range(num_samples * 2)))
        wav_bytes = pcm_to_wav(pcm, num_channels=2)

        buf = io.BytesIO(wav_bytes)
        with wave.open(buf, "rb") as wf:
            read_frames = wf.readframes(num_samples)
            assert read_frames == pcm

    def test_wav_size_larger_than_pcm(self):
        """WAV file should be slightly larger than PCM due to headers."""
        pcm = _make_pcm_data(1000)
        wav_bytes = pcm_to_wav(pcm)
        # WAV header is typically 44 bytes
        assert len(wav_bytes) > len(pcm)
        assert len(wav_bytes) == len(pcm) + 44
