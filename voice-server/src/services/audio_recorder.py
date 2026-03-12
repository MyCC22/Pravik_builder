"""Call recording using Pipecat's AudioBufferProcessor.

Records stereo audio (user=left channel, bot=right channel) and uploads
the WAV file to Supabase Storage at call end. Old recordings are automatically
deleted after the configured retention period.
"""

from __future__ import annotations

import io
import logging
import time
import wave
from datetime import datetime, timedelta, timezone

from pipecat.processors.audio.audio_buffer_processor import AudioBufferProcessor

from src.config import config
from src.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)


class CallRecorder:
    """Manages call recording and upload for a single voice call."""

    def __init__(self, call_sid: str, sample_rate: int = 16000):
        self.call_sid = call_sid
        self.sample_rate = sample_rate
        self.num_channels = 2  # stereo: user=left, bot=right
        self.processor = AudioBufferProcessor(
            sample_rate=sample_rate,
            num_channels=self.num_channels,
            buffer_size=0,  # collect all audio, emit on stop only
        )
        self._audio_data: bytes = b""
        self._recording = False

        # Register handler to capture final merged audio on stop
        @self.processor.event_handler("on_audio_data")
        async def _on_audio_data(proc, audio: bytes, sr: int, channels: int):
            self._audio_data = audio
            logger.info(
                f"[{self.call_sid}] Audio captured: "
                f"{len(audio)} bytes, {sr}Hz, {channels}ch, "
                f"~{len(audio) / (sr * channels * 2):.1f}s"
            )

    async def start(self) -> None:
        """Begin recording."""
        await self.processor.start_recording()
        self._recording = True
        logger.info(f"[{self.call_sid}] Recording started")

    async def stop_and_upload(self) -> str | None:
        """Stop recording, convert to WAV, upload to Supabase Storage.

        Returns the public URL of the recording, or None if no audio captured.
        """
        if not self._recording:
            return None

        self._recording = False
        await self.processor.stop_recording()

        if not self._audio_data:
            logger.warning(f"[{self.call_sid}] No audio data captured")
            return None

        # Convert raw PCM to WAV
        wav_bytes = pcm_to_wav(
            self._audio_data,
            sample_rate=self.sample_rate,
            num_channels=self.num_channels,
        )

        # Upload to Supabase Storage
        url = await self._upload(wav_bytes)
        return url

    async def _upload(self, wav_bytes: bytes) -> str | None:
        """Upload WAV to Supabase Storage and return public URL."""
        bucket = config.supabase_storage_bucket
        timestamp = int(time.time())
        path = f"{self.call_sid}/{timestamp}.wav"

        try:
            supabase = await get_supabase_client()
            await supabase.storage.from_(bucket).upload(
                path=path,
                file=wav_bytes,
                file_options={
                    "content-type": "audio/wav",
                    "x-upsert": "false",
                },
            )

            # Build public URL
            public_url = f"{config.supabase_url}/storage/v1/object/public/{bucket}/{path}"
            logger.info(f"[{self.call_sid}] Recording uploaded: {public_url}")
            return public_url
        except Exception as e:
            logger.error(f"[{self.call_sid}] Failed to upload recording: {e}", exc_info=True)
            return None


def pcm_to_wav(
    pcm_data: bytes,
    sample_rate: int = 16000,
    num_channels: int = 2,
    sample_width: int = 2,
) -> bytes:
    """Convert raw PCM16 audio data to WAV format.

    Args:
        pcm_data: Raw PCM audio bytes (int16 little-endian)
        sample_rate: Samples per second (Hz)
        num_channels: 1=mono, 2=stereo
        sample_width: Bytes per sample (2 for int16)

    Returns:
        Complete WAV file as bytes
    """
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(num_channels)
        wf.setsampwidth(sample_width)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_data)
    return buf.getvalue()


async def cleanup_old_recordings() -> int:
    """Delete recordings older than the configured retention period.

    Queries call_sessions for ended calls with recordings older than
    retention_hours, deletes the files from Supabase Storage, and clears
    the recording_url column.

    Returns the number of recordings deleted.
    """
    retention_hours = config.recording_retention_hours
    if retention_hours <= 0:
        return 0

    cutoff = datetime.now(timezone.utc) - timedelta(hours=retention_hours)
    bucket = config.supabase_storage_bucket
    deleted = 0

    try:
        supabase = await get_supabase_client()

        # Find sessions with recordings older than the retention period
        result = await (
            supabase.table("call_sessions")
            .select("call_sid, recording_url")
            .eq("state", "ended")
            .not_.is_("recording_url", "null")
            .lt("ended_at", cutoff.isoformat())
            .execute()
        )

        if not result.data:
            return 0

        for session in result.data:
            call_sid = session["call_sid"]
            recording_url = session.get("recording_url", "")

            # Extract storage path from URL
            # URL format: {supabase_url}/storage/v1/object/public/{bucket}/{path}
            prefix = f"/storage/v1/object/public/{bucket}/"
            idx = recording_url.find(prefix)
            if idx == -1:
                continue
            file_path = recording_url[idx + len(prefix):]

            try:
                await supabase.storage.from_(bucket).remove([file_path])
                await (
                    supabase.table("call_sessions")
                    .update({"recording_url": None})
                    .eq("call_sid", call_sid)
                    .execute()
                )
                deleted += 1
                logger.info(f"[{call_sid}] Deleted old recording: {file_path}")
            except Exception as e:
                logger.warning(f"[{call_sid}] Failed to delete recording: {e}")

    except Exception as e:
        logger.error(f"Failed to cleanup old recordings: {e}", exc_info=True)

    if deleted > 0:
        logger.info(f"Cleaned up {deleted} old recording(s) (retention: {retention_hours}h)")

    return deleted
