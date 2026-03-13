"""Tests for PipelineBuilder — verifies fluent API and pipeline assembly."""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch


# Mock all pipecat dependencies at the module level before importing builder
@pytest.fixture(autouse=True)
def _mock_pipecat(monkeypatch):
    """Mock pipecat imports so builder tests don't need the real framework."""
    mock_pipeline = MagicMock()
    mock_runner = MagicMock()
    mock_task = MagicMock()
    mock_params = MagicMock()
    mock_context = MagicMock()
    mock_pair = MagicMock()
    mock_frame = MagicMock()

    monkeypatch.setattr("src.pipeline.builder.Pipeline", mock_pipeline)
    monkeypatch.setattr("src.pipeline.builder.PipelineRunner", mock_runner)
    monkeypatch.setattr("src.pipeline.builder.PipelineTask", mock_task)
    monkeypatch.setattr("src.pipeline.builder.PipelineParams", mock_params)
    monkeypatch.setattr("src.pipeline.builder.LLMContext", mock_context)
    monkeypatch.setattr("src.pipeline.builder.LLMContextAggregatorPair", mock_pair)
    monkeypatch.setattr("src.pipeline.builder.LLMRunFrame", mock_frame)


def _mock_transport():
    transport = MagicMock()
    transport.input.return_value = "transport_in"
    transport.output.return_value = "transport_out"
    transport.event_handler.return_value = lambda fn: fn
    return transport


def _mock_llm():
    llm = MagicMock()
    return llm


def _mock_recorder():
    recorder = MagicMock()
    recorder.processor = "recorder_processor"
    return recorder


def test_builder_fluent_api():
    """Chain methods return self for fluent API."""
    from src.pipeline.builder import PipelineBuilder

    builder = PipelineBuilder()
    result = (
        builder
        .with_transport(_mock_transport())
        .with_llm(_mock_llm())
        .with_recorder(_mock_recorder())
        .with_greeting("Hello!")
    )
    assert result is builder


def test_build_returns_task_and_runner():
    """build() returns a (task, runner) tuple."""
    from src.pipeline.builder import PipelineBuilder

    task, runner = (
        PipelineBuilder()
        .with_transport(_mock_transport())
        .with_llm(_mock_llm())
        .build()
    )
    # Both should be mock return values (not None)
    assert task is not None
    assert runner is not None


def test_build_requires_transport():
    """build() raises ValueError if transport is not set."""
    from src.pipeline.builder import PipelineBuilder

    with pytest.raises(ValueError, match="Transport is required"):
        PipelineBuilder().with_llm(_mock_llm()).build()


def test_build_requires_llm():
    """build() raises ValueError if LLM is not set."""
    from src.pipeline.builder import PipelineBuilder

    with pytest.raises(ValueError, match="LLM is required"):
        PipelineBuilder().with_transport(_mock_transport()).build()


def test_recorder_optional():
    """Pipeline can be built without a recorder — 5 stages."""
    from src.pipeline.builder import PipelineBuilder, Pipeline

    PipelineBuilder().with_transport(_mock_transport()).with_llm(_mock_llm()).build()

    # Pipeline was called with a list of stages — should be 5 (no recorder)
    pipeline_call = Pipeline.call_args
    stages = pipeline_call.args[0]
    assert len(stages) == 5


def test_recorder_included():
    """Pipeline built with recorder has 6 stages."""
    from src.pipeline.builder import PipelineBuilder, Pipeline

    (
        PipelineBuilder()
        .with_transport(_mock_transport())
        .with_llm(_mock_llm())
        .with_recorder(_mock_recorder())
        .build()
    )

    pipeline_call = Pipeline.call_args
    stages = pipeline_call.args[0]
    assert len(stages) == 6
    assert stages[-1] == "recorder_processor"


def test_greeting_creates_context_message():
    """with_greeting() injects a user message into the LLM context."""
    from src.pipeline.builder import PipelineBuilder, LLMContext

    (
        PipelineBuilder()
        .with_transport(_mock_transport())
        .with_llm(_mock_llm())
        .with_greeting("Hello, welcome!")
        .build()
    )

    context_call = LLMContext.call_args
    messages = context_call.kwargs["messages"]
    assert len(messages) == 1
    assert messages[0]["role"] == "user"
    assert messages[0]["content"] == "Hello, welcome!"
