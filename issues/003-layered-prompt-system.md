# Issue 003: Layered Prompt System

**Criticality**: Critical
**Impact**: AI accuracy degrades with more tools
**Effort**: Medium (1 day)

---

## Problem

The system prompt is a monolithic ~284-line string that contains instructions for **every tool and scenario**, regardless of which tools are relevant at any point in the conversation. As tools grow, the prompt grows linearly, diluting the AI's attention and causing:

1. Instructions for irrelevant tools confuse the AI (e.g., phone provisioning instructions shown during initial greeting)
2. Conflicting rules (e.g., "always ask before proceeding" vs "auto-answer yes/no questions") create unpredictable behavior
3. No way to A/B test or version individual instruction sets
4. Every new tool adds 5-15 lines to the prompt, with no retirement mechanism

### Current Prompt Structure

```
BASE_SYSTEM_INSTRUCTIONS (10 lines) — personality, role
  + CALL_FLOW (15-20 lines) — varies by user type
  + _COMMON_RULES (84 lines) — ALL rules for ALL tools:
      - Critical rules (5 lines)
      - Editing rules (38 lines)
      - Noise handling (4 lines)
      - Phone provisioning (8 lines)
      - Call forwarding (7 lines)
      - Web page sync (7 lines)
      - Action steps menu (8 lines)
```

**Total**: ~120 lines concatenated into one string. With 5 more tools, this becomes 200+ lines.

### Files Affected

| File | Lines | Content |
|------|-------|---------|
| `voice-server/src/pipeline.py` | 39-48 | `BASE_SYSTEM_INSTRUCTIONS` |
| `voice-server/src/pipeline.py` | 50-134 | `_COMMON_RULES` (monolithic) |
| `voice-server/src/pipeline.py` | 139-183 | Call flow variants |
| `voice-server/src/pipeline.py` | 186-228 | `build_system_instructions()` + `build_initial_greeting()` |

---

## Proposed Solution: Context-Layered Prompts

### Architecture

Instead of one monolithic prompt, use **layers** that are composed based on context:

```
Layer 0: Core Personality (always present, ~10 lines)
Layer 1: Call Flow (selected by user type, ~15 lines)
Layer 2: Active Tool Instructions (only tools available to this user, variable)
Layer 3: Conversation Phase Rules (injected dynamically as call progresses)
```

### Layer Definitions

```python
# voice-server/src/prompts/layers.py

CORE_PERSONALITY = """
You are Timmy, a friendly AI concierge who helps people build websites...
CRITICAL RULES:
- ALWAYS speak BEFORE calling any tool
- NEVER go silent — always acknowledge what you're about to do
- Keep responses conversational and concise (1-2 sentences)
"""

# Phase-specific rules injected when relevant
PHASE_RULES = {
    "greeting": """
    You just connected with the caller. Focus on:
    - Greeting warmly
    - Understanding what they want to build
    - Getting them to open their builder link
    """,

    "building": """
    The user is actively building their website. Focus on:
    - Translating voice descriptions into build/edit instructions
    - Confirming changes before making them
    - Suggesting improvements naturally
    """,

    "action_steps": """
    The user is working through action steps. Focus on:
    - Guiding them through remaining steps
    - Phone number provisioning if needed
    - Call forwarding setup if they have a phone
    """,
}
```

### Tool Instructions Come From Tool Definitions

With Issue 001 (Tool Registry) implemented, each tool carries its own `prompt_instructions`:

```python
# build_tool_instructions() from registry
# Only includes instructions for tools the user has access to
tool_instructions = build_tool_instructions(active_tools)
```

### Dynamic Phase Injection

```python
# When call phase changes, update LLM context
async def update_call_phase(llm, phase: str):
    """Inject phase-specific rules into the LLM context."""
    if phase in PHASE_RULES:
        await llm.update_system_instructions(
            CORE_PERSONALITY + "\n" + PHASE_RULES[phase] + "\n" + tool_instructions
        )
```

### Prompt Composition Function

```python
def build_system_instructions(
    is_new_user: bool,
    project_count: int,
    latest_project_name: str,
    active_tools: list[ToolDefinition],
    phase: str = "greeting",
) -> str:
    """Compose a layered system prompt from context."""
    layers = [CORE_PERSONALITY]

    # Layer 1: Call flow
    if is_new_user or project_count == 0:
        layers.append(CALL_FLOWS["new_user"])
    elif project_count == 1:
        layers.append(CALL_FLOWS["returning_single"].format(
            project_name=latest_project_name
        ))
    else:
        layers.append(CALL_FLOWS["returning_multi"].format(
            project_count=project_count,
            project_name=latest_project_name
        ))

    # Layer 2: Tool instructions (from registry)
    tool_instructions = build_tool_instructions(active_tools)
    if tool_instructions:
        layers.append("AVAILABLE TOOLS:\n" + tool_instructions)

    # Layer 3: Phase rules
    if phase in PHASE_RULES:
        layers.append("CURRENT PHASE:\n" + PHASE_RULES[phase])

    return "\n\n---\n\n".join(layers)
```

---

## Implementation Steps

1. Create `voice-server/src/prompts/` package with `layers.py` and `__init__.py`
2. Extract `CORE_PERSONALITY` from `BASE_SYSTEM_INSTRUCTIONS`
3. Define `PHASE_RULES` for greeting, building, and action_steps phases
4. Extract `CALL_FLOWS` dict from `_NEW_USER_CALL_FLOW`, `_RETURNING_USER_*`
5. Use f-string `.format()` instead of `.replace()` for template substitution
6. Rewrite `build_system_instructions()` to compose layers
7. Remove `_COMMON_RULES` monolith
8. Add `update_call_phase()` mechanism (triggered by tool completions)
9. Update `build_initial_greeting()` to work with new structure
10. Verify all existing prompt tests pass with updated imports

**Note**: This depends partially on Issue 001 (tool instructions from registry). Can be implemented independently by keeping tool instructions in a separate dict, then migrating to registry later.

---

## Test Cases

### Unit Tests: `voice-server/tests/test_prompt_layers.py`

| # | Test | Description | Expected |
|---|------|-------------|----------|
| 1 | `test_core_personality_always_present` | All prompt variants contain core personality | Contains "Timmy", "ALWAYS speak BEFORE" |
| 2 | `test_new_user_prompt_has_greeting_phase` | New user default includes greeting rules | Contains greeting-specific instructions |
| 3 | `test_building_phase_has_edit_rules` | Phase="building" includes editing instructions | Contains "Translating voice descriptions" |
| 4 | `test_action_steps_phase_has_step_rules` | Phase="action_steps" includes step guidance | Contains "remaining steps" |
| 5 | `test_prompt_layers_separated_by_divider` | Layers joined with `---` divider | Count of `---` matches layer count - 1 |
| 6 | `test_call_flow_new_user_includes_send_link` | New user call flow mentions link sending | Contains "send_builder_link" |
| 7 | `test_call_flow_returning_single_includes_name` | Single project flow includes project name | Contains the provided project name |
| 8 | `test_call_flow_returning_multi_includes_count` | Multi project flow includes count | Contains the provided count |
| 9 | `test_tool_instructions_only_for_active_tools` | Only active tool instructions appear | Mock 2 tools, verify only their instructions in prompt |
| 10 | `test_empty_tool_instructions_skipped` | Tools with no instructions don't add blank lines | No "AVAILABLE TOOLS:" section if all empty |
| 11 | `test_prompt_total_length_reasonable` | Full prompt stays under 500 lines | `len(prompt.split('\n')) < 500` |
| 12 | `test_format_placeholders_all_resolved` | No `{project_name}` or `{project_count}` remain | No `{` or `}` in final string |

### Integration Tests: `voice-server/tests/test_prompt_phase_transitions.py`

| # | Test | Description | Expected |
|---|------|-------------|----------|
| 1 | `test_phase_transition_greeting_to_building` | After first build, phase changes | Prompt includes building rules, not greeting |
| 2 | `test_phase_transition_to_action_steps` | After build complete, show action steps | Prompt includes action step rules |
| 3 | `test_prompt_with_registry_tools` | Combined with Tool Registry, instructions auto-composed | All registered tool instructions present |

---

## Acceptance Criteria

- [ ] System prompt is composed from discrete layers, not one monolithic string
- [ ] Tool-specific instructions only appear when the tool is available
- [ ] Phase-specific rules can be injected/changed mid-call
- [ ] No `.replace()` template substitution (use `.format()` or f-strings)
- [ ] Prompt length grows sub-linearly as tools are added (only relevant tools)
- [ ] Existing prompt tests updated and passing
- [ ] `_COMMON_RULES` monolith is removed
