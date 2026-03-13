# Issue 006: Modular Pipeline

**Criticality**: Medium
**Impact**: Hard to extend/test
**Effort**: Medium (1 day)

---

## Problem

The voice pipeline in `pipeline.py` is a monolithic function (`create_pipeline`, 130+ lines) that configures transport, LLM, tool handlers, audio processing, and recording in one place. This makes it:

1. **Hard to test**: Can't test LLM configuration without setting up transport, can't test tool registration without audio config
2. **Hard to extend**: Adding a new processing stage (e.g., sentiment analysis, profanity filter) requires modifying the core function
3. **Hard to debug**: When something fails in the pipeline, the error could come from any stage
4. **Rigid ordering**: Pipeline stages are fixed — can't easily insert middleware between stages

### Current Structure

```python
# pipeline.py:231-362 — everything in one function
async def create_pipeline(websocket, tool_ctx, system_instructions, ...):
    # 1. Transport setup (20 lines)
    transport = FastAPIWebsocketTransport(...)

    # 2. LLM setup (20 lines)
    llm = OpenAIRealtimeLLMService(...)

    # 3. Context aggregators (5 lines)
    context_aggregator = llm.create_context_aggregator()

    # 4. Tool registration (20 lines)
    handlers = create_tool_handlers(tool_ctx)
    for name, handler in handlers.items():
        llm.register_function(name, handler, ...)

    # 5. Recorder setup (10 lines)
    recorder = AudioRecorder(...)

    # 6. Pipeline assembly (10 lines)
    pipeline = Pipeline([
        transport.input(),
        context_aggregator.user(),
        llm,
        context_aggregator.assistant(),
        transport.output(),
        recorder.processor,
    ])

    # 7. Event handlers (20 lines)
    @transport.event_handler("on_client_connected")
    async def on_client_connected(...): ...

    # 8. Task creation (5 lines)
    task = PipelineTask(pipeline, ...)
    runner = PipelineRunner()

    return task, runner, recorder, llm
```

### Files Affected

| File | Lines | Content |
|------|-------|---------|
| `voice-server/src/pipeline.py` | 231-362 | `create_pipeline()` monolith |
| `voice-server/src/main.py` | 74-212 | WebSocket handler that calls create_pipeline |

---

## Proposed Solution: Pipeline Builder Pattern

### Split into Focused Factories

```python
# voice-server/src/pipeline/transport.py
def create_transport(websocket, call_sid, stream_sid) -> FastAPIWebsocketTransport:
    """Configure Twilio WebSocket transport with noise filtering."""
    return FastAPIWebsocketTransport(
        websocket=websocket,
        audio_in_filter=RNNoiseFilter(),
        serializer=TwilioFrameSerializer(stream_sid),
        params=FastAPIWebsocketParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            add_wav_header=False,
            vad_enabled=True,
            vad_audio_passthrough=True,
        ),
    )

# voice-server/src/pipeline/llm_config.py
def create_llm(system_instructions: str, tools: list[dict]) -> OpenAIRealtimeLLMService:
    """Configure OpenAI Realtime LLM with voice settings."""
    return OpenAIRealtimeLLMService(
        model="gpt-realtime-1.5",
        instructions=system_instructions,
        session_properties={
            "audio": {
                "input": {"transcription": {"model": "whisper-1"}, ...},
                "output": {"voice": "ash"},
            }
        },
        tools=tools,
    )

# voice-server/src/pipeline/recording.py
def create_recorder(call_sid: str) -> AudioRecorder:
    """Configure stereo audio recorder."""
    return AudioRecorder(call_sid=call_sid)

# voice-server/src/pipeline/builder.py
class PipelineBuilder:
    """Fluent builder for voice pipeline assembly."""

    def __init__(self):
        self._transport = None
        self._llm = None
        self._recorder = None
        self._tools = []
        self._event_handlers = []

    def with_transport(self, transport):
        self._transport = transport
        return self

    def with_llm(self, llm):
        self._llm = llm
        return self

    def with_recorder(self, recorder):
        self._recorder = recorder
        return self

    def with_tools(self, tool_ctx, tool_definitions):
        """Register tools from registry."""
        for tool_def in tool_definitions:
            self._llm.register_function(
                tool_def.name,
                tool_def.handler,
                timeout_secs=tool_def.timeout
            )
        return self

    def on_client_connected(self, callback):
        self._event_handlers.append(("on_client_connected", callback))
        return self

    def build(self):
        """Assemble the pipeline."""
        context_aggregator = self._llm.create_context_aggregator()

        stages = [
            self._transport.input(),
            context_aggregator.user(),
            self._llm,
            context_aggregator.assistant(),
            self._transport.output(),
        ]

        if self._recorder:
            stages.append(self._recorder.processor)

        pipeline = Pipeline(stages)
        task = PipelineTask(pipeline, params=PipelineParams(
            allow_interruptions=True,
            enable_metrics=True,
        ))

        # Register event handlers
        for event_name, callback in self._event_handlers:
            self._transport.event_handler(event_name)(callback)

        runner = PipelineRunner()
        return task, runner
```

### Simplified Main Usage

```python
# main.py — much cleaner
from src.pipeline.transport import create_transport
from src.pipeline.llm_config import create_llm
from src.pipeline.recording import create_recorder
from src.pipeline.builder import PipelineBuilder

transport = create_transport(websocket, call_sid, stream_sid)
llm = create_llm(system_instructions, tool_schemas)
recorder = create_recorder(call_sid)

task, runner = (
    PipelineBuilder()
    .with_transport(transport)
    .with_llm(llm)
    .with_recorder(recorder)
    .with_tools(tool_ctx, tool_definitions)
    .on_client_connected(lambda t, c: on_connected(task, recorder))
    .build()
)

await runner.run(task)
```

---

## Implementation Steps

1. Create `voice-server/src/pipeline/` package
2. Extract `create_transport()` to `transport.py`
3. Extract `create_llm()` to `llm_config.py`
4. Extract `create_recorder()` to `recording.py`
5. Create `PipelineBuilder` class in `builder.py`
6. Refactor `create_pipeline()` to use builder pattern
7. Update `main.py` to use new modular components
8. Remove old monolithic `create_pipeline()` function

---

## Test Cases

### Unit Tests: `voice-server/tests/test_pipeline_transport.py`

| # | Test | Description | Expected |
|---|------|-------------|----------|
| 1 | `test_transport_has_noise_filter` | `create_transport()` configures RNNoise | `audio_in_filter` is `RNNoiseFilter` |
| 2 | `test_transport_params_correct` | Audio in/out enabled, WAV header off | All params match expected |
| 3 | `test_transport_uses_twilio_serializer` | Serializer is TwilioFrameSerializer | Correct type with stream_sid |

### Unit Tests: `voice-server/tests/test_pipeline_llm_config.py`

| # | Test | Description | Expected |
|---|------|-------------|----------|
| 1 | `test_llm_model_correct` | Model is `gpt-realtime-1.5` | Matches |
| 2 | `test_llm_voice_is_ash` | Output voice is "ash" | Matches |
| 3 | `test_llm_tools_passed` | Tool schemas provided to LLM | `tools` param matches input |
| 4 | `test_llm_transcription_model` | Whisper model configured | `whisper-1` |

### Unit Tests: `voice-server/tests/test_pipeline_builder.py`

| # | Test | Description | Expected |
|---|------|-------------|----------|
| 1 | `test_builder_fluent_api` | Chain methods return self | `builder.with_transport().with_llm()` works |
| 2 | `test_build_creates_pipeline_task` | `build()` returns PipelineTask | Not None, correct type |
| 3 | `test_build_creates_runner` | `build()` returns PipelineRunner | Not None, correct type |
| 4 | `test_recorder_optional` | Build without recorder | Pipeline has 5 stages (not 6) |
| 5 | `test_recorder_included` | Build with recorder | Pipeline has 6 stages |
| 6 | `test_event_handlers_registered` | `on_client_connected()` callback | Callback invoked when event fires |
| 7 | `test_tools_registered_with_timeouts` | `with_tools()` registers all tools | Each tool's handler + timeout registered |

---

## Acceptance Criteria

- [ ] Pipeline components are independently testable
- [ ] Adding a new pipeline stage doesn't require modifying the builder
- [ ] `create_pipeline()` monolith is replaced with composable builder
- [ ] Transport, LLM, and recorder can be configured independently
- [ ] All existing pipeline tests pass
- [ ] `main.py` is cleaner and easier to follow
