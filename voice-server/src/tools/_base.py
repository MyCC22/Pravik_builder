"""Base types and pure functions for the tool registry."""

import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Awaitable

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Clarify questions that can be auto-answered when user intent is obvious
_AUTO_YES_PATTERNS = [
    "would you like me to add one",
    "would you like to add",
    "would you like me to create",
    "should i add",
    "would you like me to add",
]

# Valid step IDs for the action steps menu
_VALID_STEP_IDS = {"build_site", "contact_form", "phone_number", "call_forwarding"}

# Prefixes to strip when generating a clean project name from the build description
_NAME_STRIP_PREFIXES = [
    "a website for ", "build a website for ", "create a website for ",
    "a landing page for ", "build a landing page for ", "create a landing page for ",
    "a site for ", "build a site for ", "create a site for ",
    "make a website for ", "make a site for ", "make a landing page for ",
    "i want a website for ", "i need a website for ",
    "build me a website for ", "make me a website for ",
    "build me a ", "make me a ", "create a ", "build a ", "make a ",
    "i want a ", "i need a ",
]


# ---------------------------------------------------------------------------
# Pure helper functions
# ---------------------------------------------------------------------------

def _is_auto_answerable(question: str, instruction: str) -> bool:
    """Check if a clarify question can be auto-answered with 'yes'."""
    q_lower = question.lower()
    return any(p in q_lower for p in _AUTO_YES_PATTERNS)


def _clean_project_name(description: str) -> str:
    """Convert a build description into a clean, short project name.

    E.g. "A website for a summer camp with activities and pricing" ->
         "Summer Camp"
    """
    name = description.strip()

    # Strip common request prefixes to get to the core subject
    lower = name.lower()
    for prefix in _NAME_STRIP_PREFIXES:
        if lower.startswith(prefix):
            name = name[len(prefix):]
            lower = name.lower()
            break

    # Strip leading articles left over after prefix removal
    for article in ["a ", "an ", "the "]:
        if lower.startswith(article) and len(name) > len(article) + 3:
            name = name[len(article):]
            lower = name.lower()
            break

    # Trim trailing detail clauses ("with ...", "that has ...", etc.)
    for delimiter in [" with ", " that ", " which ", " including ", " featuring ", " and also "]:
        idx = lower.find(delimiter)
        if idx > 5:  # keep at least a few words before trimming
            name = name[:idx]
            break

    # Truncate at word boundary
    if len(name) > 40:
        name = name[:40].rsplit(" ", 1)[0]

    # Title case for a clean display name
    name = name.strip().title()

    # Fallback if stripping removed everything
    return name if name else description.strip()[:40].title()


# ---------------------------------------------------------------------------
# Dataclasses — Typed Context Layers
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class CallIdentity:
    """Immutable call metadata. Set once at call start, never changes."""

    call_sid: str
    session_id: str
    user_id: str
    phone_number: str
    builder_api_url: str
    is_new_user: bool


@dataclass
class CallState:
    """Mutable call state with controlled access.

    Fields that tools need to change go through explicit methods
    (switch_project, mark_link_sent, mark_page_opened) rather than
    direct attribute assignment.
    """

    _project_id: str = ""
    _link_sent: bool = False
    _page_opened: bool = False
    project_count: int = 0
    latest_project_id: str = ""
    latest_project_name: str = ""

    @property
    def project_id(self) -> str:
        return self._project_id

    @property
    def link_sent(self) -> bool:
        return self._link_sent

    @property
    def page_opened(self) -> bool:
        return self._page_opened

    def switch_project(self, project_id: str, project_name: str = ""):
        """Explicit project switch — the only way to change project_id."""
        self._project_id = project_id
        if project_name:
            self.latest_project_name = project_name

    def mark_link_sent(self):
        """Mark the builder SMS link as sent."""
        self._link_sent = True

    def mark_page_opened(self):
        """Mark that the user has opened the builder page."""
        self._page_opened = True

    def to_dict(self) -> dict:
        """Snapshot for logging/debugging."""
        return {
            "project_id": self._project_id,
            "link_sent": self._link_sent,
            "page_opened": self._page_opened,
            "project_count": self.project_count,
        }


@dataclass
class TurnContext:
    """Ephemeral data for the current tool turn."""

    pending_image_urls: list[str] = field(default_factory=list)
    last_edit_summary: str = ""

    def consume_images(self) -> list[str]:
        """Return pending images and clear the list."""
        urls = list(self.pending_image_urls)
        self.pending_image_urls.clear()
        return urls


@dataclass
class ToolContext:
    """Composed context passed to tool handlers.

    Replaces the old flat god-object with three typed layers:
    - identity: immutable call metadata (frozen)
    - state:    mutable session state (controlled via methods)
    - turn:     ephemeral per-turn data
    - llm_ref:  runtime infrastructure ref (set once after pipeline creation)
    """

    identity: CallIdentity
    state: CallState
    turn: TurnContext
    llm_ref: Any = None


@dataclass
class ToolDefinition:
    """Self-contained tool definition. One file = one tool."""

    name: str
    description: str
    parameters: dict  # OpenAI JSON Schema for function parameters
    handle: Callable  # async (ctx: ToolContext, params: FunctionCallParams) -> None
    timeout: int = 60
    prompt_instructions: str = ""
    returning_user_only: bool = False
