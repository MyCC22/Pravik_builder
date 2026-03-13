"""Tests for pipeline transport factory — verifies transport configuration."""

from unittest.mock import MagicMock, patch


@patch("src.pipeline.transport.config")
@patch("src.pipeline.transport.TwilioFrameSerializer")
@patch("src.pipeline.transport.RNNoiseFilter")
@patch("src.pipeline.transport.FastAPIWebsocketTransport")
@patch("src.pipeline.transport.FastAPIWebsocketParams")
def test_transport_has_noise_filter(
    MockParams, MockTransport, MockRNNoise, MockSerializer, mock_config
):
    """create_transport() configures RNNoise audio filter."""
    from src.pipeline.transport import create_transport

    mock_config.twilio_account_sid = "AC_test"
    mock_config.twilio_auth_token = "token_test"

    ws = MagicMock()
    create_transport(ws, "stream-1", "call-1")

    # RNNoiseFilter should have been instantiated
    MockRNNoise.assert_called_once()
    # And passed to params as audio_in_filter
    params_call = MockParams.call_args
    assert params_call.kwargs["audio_in_filter"] == MockRNNoise.return_value


@patch("src.pipeline.transport.config")
@patch("src.pipeline.transport.TwilioFrameSerializer")
@patch("src.pipeline.transport.RNNoiseFilter")
@patch("src.pipeline.transport.FastAPIWebsocketTransport")
@patch("src.pipeline.transport.FastAPIWebsocketParams")
def test_transport_params_correct(
    MockParams, MockTransport, MockRNNoise, MockSerializer, mock_config
):
    """create_transport() sets correct audio params: in/out enabled, no WAV header."""
    from src.pipeline.transport import create_transport

    mock_config.twilio_account_sid = "AC_test"
    mock_config.twilio_auth_token = "token_test"

    create_transport(MagicMock(), "stream-1", "call-1")

    params_call = MockParams.call_args
    assert params_call.kwargs["audio_in_enabled"] is True
    assert params_call.kwargs["audio_out_enabled"] is True
    assert params_call.kwargs["add_wav_header"] is False


@patch("src.pipeline.transport.config")
@patch("src.pipeline.transport.TwilioFrameSerializer")
@patch("src.pipeline.transport.RNNoiseFilter")
@patch("src.pipeline.transport.FastAPIWebsocketTransport")
@patch("src.pipeline.transport.FastAPIWebsocketParams")
def test_transport_uses_twilio_serializer(
    MockParams, MockTransport, MockRNNoise, MockSerializer, mock_config
):
    """create_transport() uses TwilioFrameSerializer with stream_sid and call_sid."""
    from src.pipeline.transport import create_transport

    mock_config.twilio_account_sid = "AC_test"
    mock_config.twilio_auth_token = "token_test"

    create_transport(MagicMock(), "stream-xyz", "call-abc")

    MockSerializer.assert_called_once_with(
        "stream-xyz",
        call_sid="call-abc",
        account_sid="AC_test",
        auth_token="token_test",
    )
    params_call = MockParams.call_args
    assert params_call.kwargs["serializer"] == MockSerializer.return_value
