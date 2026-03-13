"""Tests for pipeline LLM config factory — verifies LLM configuration."""

from unittest.mock import MagicMock, patch, call


@patch("src.pipeline.llm_config.config")
@patch("src.pipeline.llm_config.OpenAIRealtimeLLMService")
@patch("src.pipeline.llm_config.OpenAIRealtimeLLMSettings")
@patch("src.pipeline.llm_config.SessionProperties")
@patch("src.pipeline.llm_config.AudioConfiguration")
@patch("src.pipeline.llm_config.AudioInput")
@patch("src.pipeline.llm_config.AudioOutput")
@patch("src.pipeline.llm_config.InputAudioTranscription")
@patch("src.pipeline.llm_config.SemanticTurnDetection")
@patch("src.pipeline.llm_config.InputAudioNoiseReduction")
def test_llm_model_correct(
    MockNR, MockTD, MockTranscription, MockAudioOut, MockAudioIn,
    MockAudioConfig, MockSession, MockSettings, MockLLM, mock_config
):
    """create_llm() uses gpt-realtime-1.5 model."""
    from src.pipeline.llm_config import create_llm

    mock_config.openai_api_key = "sk-test"
    create_llm("instructions", [{"type": "function"}])

    settings_call = MockSettings.call_args
    assert settings_call.kwargs["model"] == "gpt-realtime-1.5"


@patch("src.pipeline.llm_config.config")
@patch("src.pipeline.llm_config.OpenAIRealtimeLLMService")
@patch("src.pipeline.llm_config.OpenAIRealtimeLLMSettings")
@patch("src.pipeline.llm_config.SessionProperties")
@patch("src.pipeline.llm_config.AudioConfiguration")
@patch("src.pipeline.llm_config.AudioInput")
@patch("src.pipeline.llm_config.AudioOutput")
@patch("src.pipeline.llm_config.InputAudioTranscription")
@patch("src.pipeline.llm_config.SemanticTurnDetection")
@patch("src.pipeline.llm_config.InputAudioNoiseReduction")
def test_llm_voice_is_ash(
    MockNR, MockTD, MockTranscription, MockAudioOut, MockAudioIn,
    MockAudioConfig, MockSession, MockSettings, MockLLM, mock_config
):
    """create_llm() configures 'ash' output voice."""
    from src.pipeline.llm_config import create_llm

    mock_config.openai_api_key = "sk-test"
    create_llm("instructions", [])

    MockAudioOut.assert_called_once_with(voice="ash")


@patch("src.pipeline.llm_config.config")
@patch("src.pipeline.llm_config.OpenAIRealtimeLLMService")
@patch("src.pipeline.llm_config.OpenAIRealtimeLLMSettings")
@patch("src.pipeline.llm_config.SessionProperties")
@patch("src.pipeline.llm_config.AudioConfiguration")
@patch("src.pipeline.llm_config.AudioInput")
@patch("src.pipeline.llm_config.AudioOutput")
@patch("src.pipeline.llm_config.InputAudioTranscription")
@patch("src.pipeline.llm_config.SemanticTurnDetection")
@patch("src.pipeline.llm_config.InputAudioNoiseReduction")
def test_llm_tools_passed(
    MockNR, MockTD, MockTranscription, MockAudioOut, MockAudioIn,
    MockAudioConfig, MockSession, MockSettings, MockLLM, mock_config
):
    """create_llm() passes tool schemas to session properties."""
    from src.pipeline.llm_config import create_llm

    mock_config.openai_api_key = "sk-test"
    schemas = [{"type": "function", "function": {"name": "test_tool"}}]
    create_llm("instructions", schemas)

    session_call = MockSession.call_args
    assert session_call.kwargs["tools"] == schemas


@patch("src.pipeline.llm_config.config")
@patch("src.pipeline.llm_config.OpenAIRealtimeLLMService")
@patch("src.pipeline.llm_config.OpenAIRealtimeLLMSettings")
@patch("src.pipeline.llm_config.SessionProperties")
@patch("src.pipeline.llm_config.AudioConfiguration")
@patch("src.pipeline.llm_config.AudioInput")
@patch("src.pipeline.llm_config.AudioOutput")
@patch("src.pipeline.llm_config.InputAudioTranscription")
@patch("src.pipeline.llm_config.SemanticTurnDetection")
@patch("src.pipeline.llm_config.InputAudioNoiseReduction")
def test_llm_transcription_model(
    MockNR, MockTD, MockTranscription, MockAudioOut, MockAudioIn,
    MockAudioConfig, MockSession, MockSettings, MockLLM, mock_config
):
    """create_llm() uses whisper-1 for transcription."""
    from src.pipeline.llm_config import create_llm

    mock_config.openai_api_key = "sk-test"
    create_llm("instructions", [])

    MockTranscription.assert_called_once_with(model="whisper-1")
