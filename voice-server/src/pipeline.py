"""Pipecat pipeline construction: Twilio transport, Silero VAD, OpenAI Realtime S2S."""

import logging

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.frames.frames import LLMRunFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.openai_llm_context import OpenAILLMContext
from pipecat.services.openai_realtime_beta import (
    InputAudioNoiseReduction,
    InputAudioTranscription,
    OpenAIRealtimeBetaLLMService,
    SemanticTurnDetection,
    SessionProperties,
)
from pipecat.transports.websocket.fastapi import (
    FastAPIWebsocketParams,
    FastAPIWebsocketTransport,
)
from pipecat.serializers.twilio import TwilioFrameSerializer

from src.config import config
from src.services.audio_recorder import CallRecorder
from src.services.noise_analyzer import NoiseFloorAnalyzer
from src.tools import TOOLS, ToolContext, create_tool_handlers

logger = logging.getLogger(__name__)

SYSTEM_INSTRUCTIONS = """You are a concierge for Pravik Builder — think of yourself like a personal website designer on a phone call. You're proactive, confident, and keep the user excited about their website.

Your personality:
- Act like a concierge: take charge, give updates, keep them informed at every step
- Warm but efficient — be enthusiastic and make the user feel taken care of
- Keep responses SHORT (1-3 sentences). This is a phone call, not a text chat.
- Never use markdown, emojis, or technical jargon
- Be proactive: don't wait for them to ask — tell them what's happening

Call flow:
1. GREET the caller warmly. Welcome them and explain you can help build a stunning website in just minutes, right here on this call. Ask if they'd like to get started.
2. When they say yes, use the send_builder_link tool. This sends them a text message with the link. Tell them: "I just sent you a text with the link — go ahead and tap it to open the page where you'll see your website come to life." If they say they didn't get the text, spell out the URL as backup: pravik-builder dot vercel dot app slash links.
3. Once they're ready, ask what kind of website they'd like. Get excited about their idea!
4. When they describe their website, use the build_website tool. IMPORTANT: While the website is being built, keep talking! Say things like "I'm building that for you right now — this'll take about a minute. I'm putting together the layout, the sections, making it look great..." Give them updates. Don't go silent.
5. When the build completes, get excited: "Alright, take a look at your phone — your website is ready! What do you think?" Prompt them for feedback.
6. For changes, be proactive: "Want me to tweak anything? I can change colors, update text, add sections, swap images — whatever you need." Use edit_website or change_theme tools.
7. After each change: "Take a look — I just updated it! How's that looking?"
8. When they're satisfied, celebrate with them and say a warm goodbye.

Important:
- Always call send_builder_link before building — they need the page open to see the preview.
- NEVER go silent during a build. The build takes 15-30 seconds — fill that time by describing what you're doing, asking about their business, or chatting naturally.
- After each build/edit action, always prompt them to check their phone and give feedback.
- Be a concierge: anticipate their needs, suggest improvements, keep the energy up.
- If they seem stuck, suggest ideas: "Would you like a testimonials section? Or maybe a photo gallery?"

Web page sync:
- The user can interact with the web page while talking to you. You'll receive notifications when they upload images or type messages on the page.
- When you see a [WEB PAGE UPDATE], acknowledge it naturally: "Oh nice, I see you just uploaded an image!" or "I see you typed something on the page."
- When the user uploads an image, proactively ask what they want to do with it: "Great image! Want me to use that as the hero background, or somewhere else on the site?"
- Images uploaded on the page are available to you — you CAN receive and use images. Never say you can't receive images.
- If the user already described what they want done with the image, just do it: "Got it, I'm updating the background with your image right now..."
- While processing an image change, keep talking: "I'm swapping that in now, give me just a moment..."
"""


def create_pipeline(
    websocket,
    stream_sid: str,
    call_sid: str,
    tool_ctx: ToolContext,
) -> tuple[PipelineTask, PipelineRunner, OpenAIRealtimeBetaLLMService, CallRecorder]:
    """
    Build the Pipecat pipeline for a single voice call.

    Returns (task, runner, llm, recorder) — caller should await runner.run(task).
    The llm ref is needed for injecting web page context into the session.
    The recorder ref is needed for stopping + uploading on call end.
    """

    # --- Transport: Twilio WebSocket with Silero VAD ---
    # Phone-call-optimized VAD: stricter than defaults to reduce false triggers
    # from background noise on Twilio calls. These are initial defaults that
    # the NoiseFloorAnalyzer will adjust dynamically after 3 seconds.
    #   confidence  0.7→0.8   higher bar for "this is speech"
    #   start_secs  0.2→0.3   need 300ms of speech before triggering (filters short bursts)
    #   stop_secs   0.2→0.5   wait 500ms of silence before "user stopped" (avoids choppy)
    #   min_volume  0.6→0.7   ignore quieter ambient sounds
    phone_vad = SileroVADAnalyzer(
        params=VADParams(
            confidence=0.8,
            start_secs=0.3,
            stop_secs=0.5,
            min_volume=0.7,
        )
    )
    transport = FastAPIWebsocketTransport(
        websocket=websocket,
        params=FastAPIWebsocketParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            add_wav_header=False,
            vad_enabled=True,
            vad_analyzer=phone_vad,
            vad_audio_passthrough=True,
            serializer=TwilioFrameSerializer(
                stream_sid,
                call_sid=call_sid,
                account_sid=config.twilio_account_sid,
                auth_token=config.twilio_auth_token,
            ),
        ),
    )

    # --- Noise Floor Analyzer: adjusts VAD dynamically after 3s ---
    noise_analyzer = NoiseFloorAnalyzer(
        vad_analyzer=phone_vad,
        analysis_duration_secs=3.0,
        sample_rate=16000,
        call_sid=call_sid,
    )

    # --- Call Recorder: stereo recording (user=left, bot=right) ---
    recorder = CallRecorder(call_sid=call_sid, sample_rate=16000)

    # --- LLM: OpenAI Realtime speech-to-speech ---
    llm = OpenAIRealtimeBetaLLMService(
        api_key=config.openai_api_key,
        session_properties=SessionProperties(
            instructions=SYSTEM_INSTRUCTIONS,
            voice="shimmer",
            input_audio_format="pcm16",
            output_audio_format="pcm16",
            input_audio_transcription=InputAudioTranscription(model="whisper-1"),
            turn_detection=SemanticTurnDetection(type="semantic_vad", eagerness="low"),
            input_audio_noise_reduction=InputAudioNoiseReduction(type="near_field"),
            tools=TOOLS,
        ),
        model="gpt-realtime-1.5",
    )

    # --- Register tool handlers ---
    # Builder API calls can take 15-30s. Default Pipecat timeout is 10s which
    # causes premature cancellation. Set generous timeouts per tool.
    TOOL_TIMEOUTS = {
        "send_builder_link": 15,
        "build_website": 120,
        "edit_website": 120,
        "change_theme": 120,
    }
    handlers = create_tool_handlers(tool_ctx)
    for name, handler in handlers.items():
        llm.register_function(name, handler, timeout_secs=TOOL_TIMEOUTS.get(name, 60))

    # --- Context: initial greeting message triggers context frame delivery ---
    context = OpenAILLMContext(
        [{"role": "user", "content": "Say hello and introduce yourself."}],
        TOOLS,
    )
    context_aggregator = llm.create_context_aggregator(context)

    # --- Pipeline ---
    # Order: input → noise_analyzer → user_agg → llm → assistant_agg → output → recorder
    # noise_analyzer observes the first 3s of audio to adjust VAD params.
    # recorder sits after output to capture both user and bot audio in stereo.
    pipeline = Pipeline(
        [
            transport.input(),
            noise_analyzer,
            context_aggregator.user(),
            llm,
            context_aggregator.assistant(),
            transport.output(),
            recorder.processor,
        ]
    )

    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            allow_interruptions=True,
            enable_metrics=True,
            audio_in_sample_rate=16000,
            audio_out_sample_rate=16000,
        ),
    )

    # Queue initial LLMRunFrame when transport connects to trigger greeting,
    # and start recording
    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        await recorder.start()
        await task.queue_frames([LLMRunFrame()])

    runner = PipelineRunner()
    return task, runner, llm, recorder
