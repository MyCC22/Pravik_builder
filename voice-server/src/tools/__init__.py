"""Tool registry — auto-discovers tool modules and provides a unified API."""

import importlib
import logging
import pkgutil
from functools import partial
from typing import Callable

from src.tools._base import (
    CallIdentity,
    CallState,
    TurnContext,
    ToolContext,
    ToolDefinition,
    _VALID_STEP_IDS,
    _AUTO_YES_PATTERNS,
    _NAME_STRIP_PREFIXES,
    _clean_project_name,
    _is_auto_answerable,
)

logger = logging.getLogger(__name__)

# Re-export for backward compatibility
__all__ = [
    "CallIdentity",
    "CallState",
    "TurnContext",
    "ToolContext",
    "ToolDefinition",
    "_VALID_STEP_IDS",
    "_clean_project_name",
    "_is_auto_answerable",
    "get_all_tools",
    "get_tools_for_user",
    "get_tool_schemas",
    "build_tool_prompt_instructions",
    "create_tool_handlers",
]

_REGISTRY: list[ToolDefinition] = []
_discovered = False


def _discover_tools():
    """Auto-discover all tool modules in this package."""
    global _discovered
    if _discovered:
        return

    package = importlib.import_module("src.tools")
    for _, module_name, _ in pkgutil.iter_modules(package.__path__):
        if module_name.startswith("_"):
            continue
        try:
            module = importlib.import_module(f"src.tools.{module_name}")
            if hasattr(module, "TOOL"):
                tool = module.TOOL
                if isinstance(tool, ToolDefinition):
                    _REGISTRY.append(tool)
                    logger.debug(f"Registered tool: {tool.name}")
        except Exception as e:
            logger.error(f"Failed to load tool module {module_name}: {e}")

    _discovered = True


def get_all_tools() -> list[ToolDefinition]:
    """Return all registered tools."""
    _discover_tools()
    return list(_REGISTRY)


def get_tools_for_user(is_returning: bool) -> list[ToolDefinition]:
    """Return tools available for the given user type."""
    _discover_tools()
    if is_returning:
        return list(_REGISTRY)
    return [t for t in _REGISTRY if not t.returning_user_only]


def get_tool_schemas(tools: list[ToolDefinition]) -> list[dict]:
    """Convert ToolDefinitions to OpenAI Realtime tool format."""
    return [
        {
            "type": "function",
            "name": t.name,
            "description": t.description,
            "parameters": t.parameters,
        }
        for t in tools
    ]


def build_tool_prompt_instructions(tools: list[ToolDefinition]) -> str:
    """Concatenate non-empty prompt instructions from tools."""
    instructions = [t.prompt_instructions.strip() for t in tools if t.prompt_instructions.strip()]
    return "\n\n".join(instructions)


def create_tool_handlers(ctx: ToolContext, tools: list[ToolDefinition]) -> dict[str, tuple[Callable, int]]:
    """Create Pipecat-compatible handlers wrapped with ctx.

    Returns dict mapping tool name -> (handler_fn, timeout).
    The handler_fn has signature (params: FunctionCallParams) -> None
    matching what Pipecat's register_function expects.
    """
    handlers = {}
    for tool in tools:
        # Wrap the handler to bind ctx as first argument
        wrapped = partial(tool.handle, ctx)
        handlers[tool.name] = (wrapped, tool.timeout)
    return handlers
