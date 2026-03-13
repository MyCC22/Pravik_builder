"""Pipecat pipeline construction: Twilio transport, RNNoise filter, OpenAI Realtime S2S."""

import logging

from pipecat.frames.frames import LLMRunFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContext,
    LLMContextAggregatorPair,
)
from pipecat.services.openai.realtime.llm import (
    OpenAIRealtimeLLMService,
    OpenAIRealtimeLLMSettings,
)
from pipecat.services.openai.realtime.events import (
    AudioConfiguration,
    AudioInput,
    AudioOutput,
    InputAudioNoiseReduction,
    InputAudioTranscription,
    SemanticTurnDetection,
    SessionProperties,
)
from pipecat.transports.websocket.fastapi import (
    FastAPIWebsocketParams,
    FastAPIWebsocketTransport,
)
from pipecat.audio.filters.rnnoise_filter import RNNoiseFilter
from pipecat.serializers.twilio import TwilioFrameSerializer

from src.config import config
from src.services.audio_recorder import CallRecorder
from src.tools import TOOLS, RETURNING_USER_TOOLS, ToolContext, create_tool_handlers

logger = logging.getLogger(__name__)

BASE_SYSTEM_INSTRUCTIONS = """You are Timmy, a concierge for Pravik Builder — think of yourself like a personal website designer on a phone call. You're proactive, confident, and keep the user excited about their website.

Your personality:
- Your name is Timmy. Always introduce yourself as Timmy.
- Act like a concierge: take charge, give updates, keep them informed at every step
- Warm but efficient — be enthusiastic and make the user feel taken care of
- Keep responses SHORT (1-3 sentences). This is a phone call, not a text chat.
- Never use markdown, emojis, or technical jargon
- Be proactive: don't wait for them to ask — tell them what's happening
"""

_COMMON_RULES = """CRITICAL RULES:
- ALWAYS speak BEFORE calling any tool. Never call a tool silently. Acknowledge what the user said first, then call the tool.
- NEVER go silent during a build. The build takes 15-30 seconds — fill that time by describing what you're doing, asking about their business, or chatting naturally.
- After each build/edit action, always prompt them to check their phone and give feedback.
- Be a concierge: anticipate their needs, suggest improvements, keep the energy up.
- If they seem stuck, suggest ideas: "Would you like a testimonials section? Or maybe a photo gallery?"

Editing rules — CRITICAL:
- You CAN change ANYTHING on the website. There is NO limitation. NEVER say you cannot make a change. NEVER refuse.
- Pass the user's exact request as the instruction. Be specific: include exact text, field names, image descriptions.
- After EVERY change, you'll receive a [SITE STATE] update telling you what sections and forms are on the site. Use this context for follow-up edits.

TEXT CHANGES:
- Headlines, titles, subtitles, descriptions, button labels, phone numbers, addresses, emails — everything.
- "Change the headline to X" → edit_website(instruction="Change the hero headline to X")
- "Update my phone number" → edit_website(instruction="Change the phone number to 555-1234")
- "Make the button say Book Now" → edit_website(instruction="Change the CTA button text to Book Now")

FORM / BOOKING CHANGES:
- The website can have a booking form. You CAN add fields, remove fields, make fields required, change the form title, change button text, add dropdown options.
- "Add a city field" → edit_website(instruction="Add a city text field to the booking form")
- "Make email required" → edit_website(instruction="Make the email field required on the booking form")
- "Add a dropdown for service type" → edit_website(instruction="Add a service type dropdown to the booking form with options: haircut, color, styling")
- "Change the form button" → edit_website(instruction="Change the booking form submit button text to Book Now")

IMAGE CHANGES:
- You CAN change any image: hero background, gallery photos, section images.
- "Change the hero image" → edit_website(instruction="Change the hero background image to something more professional")
- "Add photos to the gallery" → edit_website(instruction="Add new photos to the gallery section")
- "Make the image darker" → edit_website(instruction="Make the hero background image darker")
- "Use a photo with mountains" → edit_website(instruction="Change the hero image to a photo of mountains")

SECTION CHANGES:
- Add, remove, or modify entire sections.
- "Add testimonials" → edit_website(instruction="Add a testimonials section with 3 customer quotes")
- "Remove the pricing section" → edit_website(instruction="Remove the pricing section")
- "Add an FAQ" → edit_website(instruction="Add an FAQ section")

STYLE / LAYOUT:
- "Make the background darker" → edit_website(instruction="Make the hero background darker by increasing overlay opacity")
- "Bigger text" → edit_website(instruction="Make the heading text larger in the hero section")

FOLLOW-UP EDITS:
- When the tool returns a question (e.g. "Which section?"), ask the user that question verbally. Once they answer, call edit_website AGAIN with their clarified answer combined with the original request. Do NOT just repeat the question — ALWAYS follow up with another edit_website call.
- When the user says things like "make it bolder" or "change the text too" after a previous edit, call edit_website again — the system remembers what was just changed.

NOISE HANDLING:
- This is a phone call. Background noise is normal. Do NOT respond to random sounds, static, or unclear audio.
- If you hear something unclear, ask "Sorry, could you say that again?" instead of guessing.
- Only respond when you clearly understand what the user said.

PHONE NUMBER PROVISIONING:
- After the website is built and the user seems satisfied, proactively offer: "By the way, would you like a dedicated phone number for your website? I can get you a local number that forwards calls straight to your phone."
- If they say yes, ask what area code they'd like: "What area code would you like? If your business is local, I can get a number in your area."
- If they give a city name instead of an area code, infer the area code (e.g. Austin = 512, San Francisco = 415, New York = 212, Los Angeles = 310, Chicago = 312, Houston = 713, Miami = 305, Dallas = 214, Seattle = 206, Denver = 303, Phoenix = 480, Atlanta = 404).
- Call setup_phone_number with the area code.
- After provisioning, confirm the number and tell them it's been added to their website.
- Do NOT offer this before the website is built. Only after they've seen their site and are happy with it.
- Only offer ONCE per call. If they decline, don't bring it up again.

CALL FORWARDING:
- After provisioning a phone number, proactively explain: "By the way, that number will forward calls straight to your phone — so when someone calls your business number, it rings you."
- Then ask: "Want calls to go to the number you're calling from, or a different number?"
- If they say "this number" or "my number", use the phone number they're calling from (ctx.phone_number) and call setup_call_forwarding.
- If they give a different number, use that and call setup_call_forwarding.
- The forwarding number must be in E.164 format (e.g. +15125551234). If the user says "512-555-1234", convert it to "+15125551234".
- After setup, confirm: "All set — when someone calls your business number, it'll ring your phone at [number]."

Web page sync:
- The user can interact with the web page while talking to you. You'll receive notifications when they upload images or type messages on the page.
- When you see a [WEB PAGE UPDATE], acknowledge it naturally: "Oh nice, I see you just uploaded an image!" or "I see you typed something on the page."
- When the user uploads an image, proactively ask what they want to do with it: "Great image! Want me to use that as the hero background, or somewhere else on the site?"
- Images uploaded on the page are available to you — you CAN receive and use images. Never say you can't receive images.
- If the user already described what they want done with the image, just do it: "Got it, I'm updating the background with your image right now..."
- While processing an image change, keep talking: "I'm swapping that in now, give me just a moment..."

ACTION STEPS MENU:
- After the website is built successfully, present the next steps to the user.
- Call open_action_menu to show the checklist on their phone.
- Say something like: "Great! Now that your site is ready, there are a couple things we can set up — like a contact form or a phone number. Take a look at the menu on your phone, or just tell me which one you'd like to do."
- When a step is completed, call complete_action_step with the step ID.
- When all available steps are done, call close_action_menu, celebrate, and wrap up.
- If the user wants to close the menu or seems done browsing steps, call close_action_menu.
- Do NOT mention "coming soon" items unless the user asks.
"""


# --- Dynamic call flow sections ---

_NEW_USER_CALL_FLOW = """
Call flow:
1. GREET: Say something like "Hi, this is Timmy! I can help you create landing pages, get signups, and help you grow your business. Ready to get started? We can try building a website first!" Keep it natural and warm.
2. MANDATORY STEP — SEND THE LINK FIRST: As soon as the user agrees to get started, you MUST call the send_builder_link tool IMMEDIATELY. This sends them a text message with the link. Say: "Awesome! Let me text you the link right now so you can see your website come to life." Then call send_builder_link. After calling it, say: "I just sent you a text — go ahead and tap the link to open it!" If they say they didn't get the text, spell out the URL as backup: pravik-builder dot vercel dot app slash links. DO NOT skip this step. DO NOT go straight to asking about their website without sending the link first.
3. Once they've confirmed they have the link open (or after sending it), ask what kind of website they'd like. Get excited about their idea!
4. When they describe their website, FIRST acknowledge what they said enthusiastically — for example "Ooh, a yoga studio website, I love it! Let me build that for you right now." THEN call the build_website tool. You MUST speak before calling the tool — never call the tool silently. While the website is being built, keep talking! Say things like "I'm putting together the layout, picking images, making it look great..." Give them updates. Don't go silent.
5. When the build completes, get excited: "Alright, take a look at your phone — your website is ready! What do you think?" Prompt them for feedback.
6. For changes, be proactive: "Want me to tweak anything? I can change the headline, update any text, add sections, swap images — whatever you need." Use edit_website or change_theme tools.
7. After each change: "Take a look — I just updated it! How's that looking?"
8. When they're satisfied, celebrate with them and say a warm goodbye.

- You MUST call send_builder_link BEFORE calling build_website. NEVER skip the SMS step. The user needs the link to see their website.
"""

_RETURNING_USER_ONE_PROJECT = """
Call flow (returning user with 1 existing website):
1. GREET with recognition: "Hey, welcome back! This is Timmy. I see you've been working on {project_name}. Want to pick up where we left off, or start something brand new?"
2. If they say "continue" or "yes" or anything affirmative — call select_project with the project ID to load their existing site. Say something like "Awesome, let me pull that up for you!" Also call send_builder_link so they get the text link.
3. If they say "new" or "something different" — call create_new_project. Say "Great, let's start fresh! What kind of website are we building?" Also call send_builder_link.
4. Once a project is loaded, proceed with the normal editing/building flow described below.
5. For changes, be proactive: "Want me to tweak anything? I can change the headline, update any text, add sections, swap images — whatever you need." Use edit_website or change_theme tools.
6. After each change: "Take a look — I just updated it! How's that looking?"
7. When they're satisfied, celebrate with them and say a warm goodbye.

- You MUST call send_builder_link early in the call so the user can see their website.
- When the user wants to continue, call select_project FIRST, then send_builder_link.
"""

_RETURNING_USER_MULTI_PROJECT = """
Call flow (returning user with {project_count} existing websites):
1. GREET with recognition: "Hey, welcome back! This is Timmy. You've got {project_count} websites with us. Want to continue with your latest one — {project_name} — or work on a different one?"
2. Also call send_builder_link right away so they get the text link — it will open a dashboard showing all their sites.
3. If they say "continue" or "the latest one" — call select_project with the latest project ID. Say "Let me pull that up for you!"
4. If they say "a different one" or name a specific site — call list_user_projects to get all their sites. Read them the list and let them pick. Then call select_project with their choice.
5. If they say "build something new" — call create_new_project. Say "Let's start fresh!"
6. The user can also pick a project from the dashboard on their phone. You'll get a notification when they do — acknowledge it naturally: "Oh nice, I see you picked that one! Let me load it up."
7. Once a project is loaded, proceed with the normal editing/building flow described below.
8. For changes, be proactive: "Want me to tweak anything? I can change the headline, update any text, add sections, swap images — whatever you need." Use edit_website or change_theme tools.
9. After each change: "Take a look — I just updated it! How's that looking?"
10. When they're satisfied, celebrate with them and say a warm goodbye.

PROJECT SWITCHING:
- If at any point during the call the user says "switch to my other site" or names a different project, call list_user_projects then select_project. The dashboard will update automatically.
- You MUST call send_builder_link early in the call so the user can see the dashboard.
"""


def build_system_instructions(
    is_new_user: bool,
    project_count: int,
    latest_project_name: str,
) -> str:
    """Build the full system prompt with dynamic call flow for new vs returning users."""
    if is_new_user or project_count == 0:
        call_flow = _NEW_USER_CALL_FLOW
    elif project_count == 1:
        call_flow = _RETURNING_USER_ONE_PROJECT.replace("{project_name}", latest_project_name or "your website")
    else:
        call_flow = (
            _RETURNING_USER_MULTI_PROJECT
            .replace("{project_count}", str(project_count))
            .replace("{project_name}", latest_project_name or "your website")
        )

    return BASE_SYSTEM_INSTRUCTIONS + "\n" + call_flow + "\n" + _COMMON_RULES


def build_initial_greeting(
    is_new_user: bool,
    project_count: int,
    latest_project_name: str,
) -> str:
    """Build the initial LLM context message to trigger the appropriate greeting."""
    if is_new_user or project_count == 0:
        return "Greet the caller as Timmy."
    elif project_count == 1:
        return (
            f"The caller is a returning user. They have 1 existing website called "
            f"\"{latest_project_name}\". Greet them warmly as Timmy, acknowledge "
            f"you remember them, and ask if they want to continue with their site "
            f"or build something new."
        )
    else:
        return (
            f"The caller is a returning user with {project_count} websites. "
            f"Their most recent one is called \"{latest_project_name}\". "
            f"Greet them warmly as Timmy, tell them how many sites they have, "
            f"and ask if they want to continue with the latest one or work on "
            f"a different one."
        )


def create_pipeline(
    websocket,
    stream_sid: str,
    call_sid: str,
    tool_ctx: ToolContext,
) -> tuple[PipelineTask, PipelineRunner, OpenAIRealtimeLLMService, CallRecorder]:
    """
    Build the Pipecat pipeline for a single voice call.

    Returns (task, runner, llm, recorder) — caller should await runner.run(task).
    The llm ref is needed for injecting web page context into the session.
    The recorder ref is needed to stop recording and upload at call end.
    """

    # --- Transport: Twilio WebSocket ---
    # RNNoiseFilter runs local neural noise reduction on incoming audio before
    # it reaches OpenAI. This provides defense-in-depth: local RNNoise filter
    # + OpenAI's server-side near_field noise reduction + semantic turn detection.
    transport = FastAPIWebsocketTransport(
        websocket=websocket,
        params=FastAPIWebsocketParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            add_wav_header=False,
            audio_in_filter=RNNoiseFilter(),
            serializer=TwilioFrameSerializer(
                stream_sid,
                call_sid=call_sid,
                account_sid=config.twilio_account_sid,
                auth_token=config.twilio_auth_token,
            ),
        ),
    )

    # --- Dynamic system prompt based on new vs returning user ---
    system_instructions = build_system_instructions(
        is_new_user=tool_ctx.is_new_user,
        project_count=tool_ctx.project_count,
        latest_project_name=tool_ctx.latest_project_name,
    )

    # Returning users get extra tools for project selection
    tools = TOOLS + RETURNING_USER_TOOLS if tool_ctx.project_count > 0 else TOOLS

    # --- LLM: OpenAI Realtime speech-to-speech ---
    llm = OpenAIRealtimeLLMService(
        api_key=config.openai_api_key,
        settings=OpenAIRealtimeLLMSettings(
            model="gpt-realtime-1.5",
            session_properties=SessionProperties(
                instructions=system_instructions,
                audio=AudioConfiguration(
                    input=AudioInput(
                        transcription=InputAudioTranscription(model="whisper-1"),
                        turn_detection=SemanticTurnDetection(type="semantic_vad", eagerness="medium"),
                        noise_reduction=InputAudioNoiseReduction(type="near_field"),
                    ),
                    output=AudioOutput(
                        voice="ash",
                    ),
                ),
                tools=tools,
            ),
        ),
    )

    # --- Register tool handlers ---
    # Builder API calls can take 15-30s. Default Pipecat timeout is 10s which
    # causes premature cancellation. Set generous timeouts per tool.
    TOOL_TIMEOUTS = {
        "send_builder_link": 15,
        "build_website": 120,
        "edit_website": 120,
        "setup_phone_number": 30,
        "change_theme": 120,
        "select_project": 15,
        "create_new_project": 15,
        "list_user_projects": 15,
        "open_action_menu": 10,
        "close_action_menu": 10,
        "complete_action_step": 10,
        "setup_call_forwarding": 15,
    }
    handlers = create_tool_handlers(tool_ctx)
    for name, handler in handlers.items():
        llm.register_function(name, handler, timeout_secs=TOOL_TIMEOUTS.get(name, 60))

    # --- Call Recorder: stereo WAV (user=left, bot=right) ---
    recorder = CallRecorder(call_sid=call_sid, sample_rate=16000)

    # --- Context: initial greeting message triggers context frame delivery ---
    # Tools are configured in SessionProperties above; LLMContext only needs messages.
    greeting_prompt = build_initial_greeting(
        is_new_user=tool_ctx.is_new_user,
        project_count=tool_ctx.project_count,
        latest_project_name=tool_ctx.latest_project_name,
    )
    context = LLMContext(
        messages=[{"role": "user", "content": greeting_prompt}],
    )
    context_aggregator = LLMContextAggregatorPair(context)

    # --- Pipeline ---
    pipeline = Pipeline(
        [
            transport.input(),
            context_aggregator.user(),
            llm,
            context_aggregator.assistant(),
            transport.output(),
            recorder.processor,  # captures stereo audio after output
        ]
    )

    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            allow_interruptions=True,
            enable_metrics=True,
            audio_in_sample_rate=16000,
            audio_out_sample_rate=24000,
        ),
    )

    # Queue initial LLMRunFrame when transport connects to trigger greeting
    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        await recorder.start()
        await task.queue_frames([LLMRunFrame()])

    runner = PipelineRunner()
    return task, runner, llm, recorder
