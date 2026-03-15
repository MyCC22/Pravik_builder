"""Tests for the tool registry — auto-discovery, filtering, schema generation."""

import asyncio
from unittest.mock import AsyncMock

from src.tools import (
    get_all_tools,
    get_tools_for_user,
    get_tool_schemas,
    build_tool_prompt_instructions,
    create_tool_handlers,
)
from src.tools._base import CallIdentity, CallState, TurnContext, ToolContext, ToolDefinition


def _make_ctx(**overrides) -> ToolContext:
    """Create a ToolContext with sensible test defaults."""
    return ToolContext(
        identity=CallIdentity(
            call_sid=overrides.get("call_sid", "test-call"),
            session_id=overrides.get("session_id", "test-session"),
            user_id=overrides.get("user_id", "test-user"),
            phone_number=overrides.get("phone_number", "+15551234567"),
            builder_api_url=overrides.get("builder_api_url", "http://localhost:3000"),
            is_new_user=overrides.get("is_new_user", True),
        ),
        state=CallState(_project_id=overrides.get("project_id", "test-project")),
        turn=TurnContext(),
    )


# ---------------------------------------------------------------------------
# Auto-discovery
# ---------------------------------------------------------------------------


def test_discovers_all_tools():
    """Registry auto-discovers all tool modules (builder + after-hours)."""
    tools = get_all_tools()
    assert len(tools) == 15  # 12 builder + 3 new (ah_save_caller_info, ah_transfer_call, setup_after_hours)


def test_no_duplicate_tool_names():
    """Every tool has a unique name."""
    names = [t.name for t in get_all_tools()]
    assert len(names) == len(set(names)), f"Duplicates: {[n for n in names if names.count(n) > 1]}"


def test_all_tools_are_tool_definitions():
    """Every discovered tool is a ToolDefinition instance."""
    for tool in get_all_tools():
        assert isinstance(tool, ToolDefinition)


def test_all_handlers_are_async_callables():
    """Every tool's handle is an async callable."""
    for tool in get_all_tools():
        assert callable(tool.handle)
        assert asyncio.iscoroutinefunction(tool.handle)


# ---------------------------------------------------------------------------
# Filtering
# ---------------------------------------------------------------------------


def test_non_returning_user_excludes_returning_only_tools():
    """New users don't get select_project, create_new_project, list_user_projects."""
    tools = get_tools_for_user(is_returning=False)
    names = {t.name for t in tools}
    assert "select_project" not in names
    assert "create_new_project" not in names
    assert "list_user_projects" not in names
    # 13 builder tools - 3 returning-only = 10
    assert len(tools) == 10


def test_returning_user_includes_all_builder_tools():
    """Returning users get all 13 builder tools (excludes after-hours tools)."""
    tools = get_tools_for_user(is_returning=True)
    assert len(tools) == 13  # 12 original builder + setup_after_hours
    names = {t.name for t in tools}
    assert "select_project" in names
    assert "create_new_project" in names
    assert "list_user_projects" in names
    assert "setup_after_hours_ai" in names
    # After-hours tools should NOT be included in builder tool set
    assert "save_caller_info" not in names
    assert "transfer_to_owner" not in names


# ---------------------------------------------------------------------------
# Schema generation
# ---------------------------------------------------------------------------


def test_schemas_have_openai_format():
    """get_tool_schemas returns dicts with type, name, description, parameters."""
    schemas = get_tool_schemas(get_all_tools())
    assert len(schemas) == 15
    for schema in schemas:
        assert schema["type"] == "function"
        assert isinstance(schema["name"], str)
        assert isinstance(schema["description"], str)
        assert isinstance(schema["parameters"], dict)


# ---------------------------------------------------------------------------
# Prompt instructions
# ---------------------------------------------------------------------------


def test_prompt_instructions_concatenation():
    """build_tool_prompt_instructions joins non-empty instructions."""
    tools = get_all_tools()
    instructions = build_tool_prompt_instructions(tools)
    # At least edit_website, setup_phone_number, setup_call_forwarding, open_action_menu have instructions
    assert "CALL FORWARDING" in instructions
    assert "ACTION STEPS MENU" in instructions


def test_prompt_instructions_excludes_empty():
    """Tools with empty prompt_instructions are not included."""
    instructions = build_tool_prompt_instructions(get_all_tools())
    # Should not contain double blank separators from empty instructions
    assert "\n\n\n\n" not in instructions


# ---------------------------------------------------------------------------
# Handler wrapping
# ---------------------------------------------------------------------------


def test_create_tool_handlers_returns_wrapped_handlers():
    """create_tool_handlers returns dict mapping name -> (callable, timeout)."""
    ctx = _make_ctx()
    tools = get_all_tools()
    handlers = create_tool_handlers(ctx, tools)
    assert len(handlers) == 15
    for name, (handler, timeout) in handlers.items():
        assert callable(handler)
        assert isinstance(timeout, int)
        assert timeout > 0
