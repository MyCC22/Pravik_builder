# Issue 001: Tool Registry Pattern

**Criticality**: Critical
**Impact**: Every new tool is error-prone
**Effort**: Medium (1-2 days)

---

## Problem

Adding a new tool requires changes across **6 different locations** in 3 files. This makes every tool addition error-prone and creates maintenance debt as the tool count grows.

### Current Scattered Locations

| What | File | Lines |
|------|------|-------|
| Schema definition (JSON dict) | `voice-server/src/tools.py` | 98-265 |
| Handler function | `voice-server/src/tools.py` | 333-1010 (inside `create_tool_handlers()`) |
| Handler registration in dict | `voice-server/src/tools.py` | 980-1010 (inside closure) |
| Timeout configuration | `voice-server/src/pipeline.py` | 300-313 (`TOOL_TIMEOUTS` dict) |
| System prompt instructions | `voice-server/src/pipeline.py` | 50-134 (`_COMMON_RULES`) |
| Returning-user conditional | `voice-server/src/tools.py` | 1004-1008 (dynamic addition) |

### Example: Adding `setup_call_forwarding` Required

1. Add schema dict to `TOOLS` list (tools.py)
2. Write `handle_setup_call_forwarding` function (tools.py)
3. Add `"setup_call_forwarding": handle_setup_call_forwarding` to handlers dict (tools.py)
4. Add `"setup_call_forwarding": 15` to `TOOL_TIMEOUTS` (pipeline.py)
5. Add CALL FORWARDING section to `_COMMON_RULES` (pipeline.py)
6. Broadcast step completion (realtime.py) - optional but usually needed

Missing any one of these causes a silent bug: tool exists but has wrong timeout, no instructions, or crashes on invocation.

---

## Proposed Solution: Self-Contained Tool Modules

### Directory Structure

```
voice-server/src/tools/
  __init__.py           # Registry: auto-discovers and registers all tools
  _base.py              # ToolDefinition dataclass + ToolContext
  build_website.py      # One file = one tool (schema + handler + config)
  edit_website.py
  setup_phone_number.py
  setup_call_forwarding.py
  change_theme.py
  open_action_menu.py
  close_action_menu.py
  complete_action_step.py
  send_builder_link.py
  select_project.py     # returning-user tool
  create_new_project.py # returning-user tool
  list_user_projects.py # returning-user tool
```

### ToolDefinition Dataclass

```python
# voice-server/src/tools/_base.py
from dataclasses import dataclass, field
from typing import Callable, Awaitable, Any

@dataclass
class ToolDefinition:
    """Self-contained tool definition. One file = one tool."""
    name: str
    description: str
    parameters: dict                          # JSON Schema for parameters
    handler: Callable[..., Awaitable[Any]]    # The async handler function
    timeout: int = 60                         # Seconds before timeout
    prompt_instructions: str = ""             # Instructions injected into system prompt
    returning_user_only: bool = False         # Only available to returning users
    required_context: list[str] = field(default_factory=list)  # ToolContext fields this tool needs
```

### Example Tool File

```python
# voice-server/src/tools/setup_call_forwarding.py
from src.tools._base import ToolDefinition, ToolContext
from src.services.realtime import broadcast_step_completed

TOOL = ToolDefinition(
    name="setup_call_forwarding",
    description="Save the user's personal phone number for call forwarding",
    parameters={
        "type": "object",
        "properties": {
            "forwarding_number": {
                "type": "string",
                "description": "User's personal phone number in E.164 format"
            }
        },
        "required": ["forwarding_number"]
    },
    timeout=15,
    prompt_instructions="""
CALL FORWARDING:
- After phone number is provisioned, ask if user wants calls forwarded
- Use setup_call_forwarding with their personal number in E.164 format
- Confirm the forwarding is set up after completion
""",
    returning_user_only=False,
    required_context=["project_id", "call_sid"],
)

async def handler(ctx: ToolContext, params) -> dict:
    args = params.arguments
    number = args.get("forwarding_number", "").strip()

    if not number:
        return {"status": "error", "message": "No forwarding number provided."}

    supabase = await get_supabase_client()
    await supabase.table("projects").update({
        "forwarding_phone": number
    }).eq("id", ctx.project_id).execute()

    await broadcast_step_completed(ctx.call_sid, "call_forwarding")

    return {"status": "success", "message": f"Call forwarding set to {number}."}

TOOL.handler = handler
```

### Registry Auto-Discovery

```python
# voice-server/src/tools/__init__.py
import importlib
import pkgutil
from src.tools._base import ToolDefinition

_REGISTRY: dict[str, ToolDefinition] = {}

def _discover_tools():
    """Auto-discover all tool modules in this package."""
    package = importlib.import_module("src.tools")
    for _, module_name, _ in pkgutil.iter_modules(package.__path__):
        if module_name.startswith("_"):
            continue
        module = importlib.import_module(f"src.tools.{module_name}")
        if hasattr(module, "TOOL"):
            tool = module.TOOL
            _REGISTRY[tool.name] = tool

def get_all_tools() -> list[ToolDefinition]:
    if not _REGISTRY:
        _discover_tools()
    return list(_REGISTRY.values())

def get_tools_for_user(is_returning: bool) -> list[ToolDefinition]:
    tools = get_all_tools()
    if is_returning:
        return tools
    return [t for t in tools if not t.returning_user_only]

def get_tool_schemas(tools: list[ToolDefinition]) -> list[dict]:
    return [{"type": "function", "name": t.name, "description": t.description, "parameters": t.parameters} for t in tools]

def get_tool_timeouts(tools: list[ToolDefinition]) -> dict[str, int]:
    return {t.name: t.timeout for t in tools}

def build_tool_instructions(tools: list[ToolDefinition]) -> str:
    return "\n".join(t.prompt_instructions for t in tools if t.prompt_instructions)
```

### Pipeline Integration (Simplified)

```python
# pipeline.py — replaces scattered config with 3 lines
from src.tools import get_tools_for_user, get_tool_schemas, get_tool_timeouts, build_tool_instructions

tools = get_tools_for_user(is_returning=not is_new_user)
# Schemas → LLM
llm = OpenAIRealtimeLLMService(..., tools=get_tool_schemas(tools))
# Handlers → registered
for tool in tools:
    llm.register_function(tool.name, tool.handler, timeout_secs=tool.timeout)
# Instructions → injected into prompt
system_prompt = BASE_INSTRUCTIONS + call_flow + build_tool_instructions(tools)
```

---

## Implementation Steps

1. Create `voice-server/src/tools/` package with `__init__.py` and `_base.py`
2. Move `ToolContext` and `_VALID_STEP_IDS` to `_base.py`
3. Extract each tool into its own file with `TOOL` definition and `handler` function
4. Move helper functions (`_clean_project_name`, `_is_auto_answerable`, `_call_api_with_retry`) to shared utils
5. Build the registry auto-discovery in `__init__.py`
6. Update `pipeline.py` to use registry instead of manual config
7. Remove old `tools.py` monolith (keep as backup during migration)
8. Update all existing tests to import from new locations

---

## Test Cases

### Unit Tests: `voice-server/tests/test_tool_registry.py`

| # | Test | Description | Expected |
|---|------|-------------|----------|
| 1 | `test_all_tools_discovered` | Auto-discovery finds all tool files | Registry contains all expected tool names |
| 2 | `test_no_duplicate_names` | Registry rejects duplicate tool names | Each tool name appears exactly once |
| 3 | `test_tool_definition_fields` | Every ToolDefinition has required fields | `name`, `description`, `parameters`, `handler` all non-empty |
| 4 | `test_parameters_valid_json_schema` | Parameters follow JSON Schema spec | Each has `type: "object"`, `properties`, `required` |
| 5 | `test_handler_is_callable` | Every handler is an async callable | `inspect.iscoroutinefunction(tool.handler)` is True |
| 6 | `test_returning_user_tools_filtered` | `get_tools_for_user(is_returning=False)` excludes returning-only tools | `select_project`, `create_new_project`, `list_user_projects` not in result |
| 7 | `test_returning_user_tools_included` | `get_tools_for_user(is_returning=True)` includes all tools | All tools present |
| 8 | `test_get_tool_schemas_format` | `get_tool_schemas()` returns OpenAI-compatible format | Each dict has `type: "function"`, `name`, `description`, `parameters` |
| 9 | `test_get_tool_timeouts_populated` | `get_tool_timeouts()` has entry for every tool | No tool missing from timeout dict |
| 10 | `test_build_tool_instructions_concatenates` | `build_tool_instructions()` joins non-empty instructions | Contains instructions from tools that have them, skips empty |
| 11 | `test_tool_file_naming_matches_tool_name` | File name matches `TOOL.name` | `setup_call_forwarding.py` has `TOOL.name == "setup_call_forwarding"` |

### Integration Tests: `voice-server/tests/test_tool_registration_integration.py`

| # | Test | Description | Expected |
|---|------|-------------|----------|
| 1 | `test_pipeline_uses_registry_schemas` | Pipeline builds LLM with registry schemas | Schema count matches `get_tool_schemas()` length |
| 2 | `test_pipeline_registers_all_handlers` | All tool handlers are registered with LLM | `llm.register_function` called for each tool |
| 3 | `test_prompt_includes_all_tool_instructions` | System prompt contains each tool's instructions | `build_tool_instructions()` output is in final prompt |
| 4 | `test_adding_new_tool_file_auto_discovers` | Create a test tool file, verify registry picks it up | New tool appears in `get_all_tools()` |

---

## Acceptance Criteria

- [ ] Adding a new tool requires creating **one file** only
- [ ] `TOOL_TIMEOUTS` dict in pipeline.py is eliminated
- [ ] Tool-specific prompt instructions live alongside their schema/handler
- [ ] All existing tests continue to pass (update imports)
- [ ] `get_tools_for_user()` correctly filters returning-user tools
- [ ] No tool definitions remain in the monolithic `tools.py`
