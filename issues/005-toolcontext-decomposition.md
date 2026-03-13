# Issue 005: ToolContext Decomposition

**Criticality**: High
**Impact**: Hard to reason about mutations
**Effort**: Medium (1 day)

---

## Problem

`ToolContext` is a mutable god object passed to every tool handler. It mixes:
- **Identity** (immutable): `call_sid`, `session_id`, `user_id`, `phone_number`
- **Session state** (mutable): `project_id`, `link_sent`, `page_opened`
- **Ephemeral data** (per-turn): `pending_image_urls`, `last_edit_summary`
- **Infrastructure refs** (runtime): `llm_ref`, `builder_api_url`

Any handler can mutate any field at any time. There's no way to know which handlers modify which fields without reading every handler's code. This creates:

1. **Hidden dependencies**: `handle_edit_website` reads `last_edit_summary` set by a previous `handle_build_website` call. If call order changes, behavior changes silently.
2. **Concurrency risk**: If two tool calls execute simultaneously (unlikely now, but possible with future parallel tools), they share the same mutable context.
3. **Testing difficulty**: Tests must construct full ToolContext even when testing a handler that only uses 2 fields.
4. **No field-level access control**: A tool that only needs `call_sid` can accidentally modify `project_id`.

### Current ToolContext

```python
@dataclass
class ToolContext:
    call_sid: str                    # Identity (immutable)
    session_id: str                  # Identity (immutable)
    user_id: str                     # Identity (immutable)
    project_id: str                  # State (mutable — changed by select_project)
    phone_number: str                # Identity (immutable)
    builder_api_url: str             # Infrastructure (immutable)
    pending_image_urls: list[str] = field(default_factory=list)  # Ephemeral (cleared per turn)
    link_sent: bool = False          # State (mutable — set by send_builder_link)
    page_opened: bool = False        # State (mutable — set by page_opened event)
    llm_ref: Any = None              # Infrastructure (set once)
    last_edit_summary: str = ""      # Ephemeral (overwritten each edit)
    is_new_user: bool = True         # Identity (immutable after init)
    project_count: int = 0           # State (mutable — changes with create_new_project)
    latest_project_id: str = ""      # State (mutable)
    latest_project_name: str = ""    # State (mutable)
```

### Files Affected

| File | Lines | Usage |
|------|-------|-------|
| `voice-server/src/tools.py` | 311-330 | Definition |
| `voice-server/src/tools.py` | 333-1010 | Every handler reads/writes ToolContext |
| `voice-server/src/pipeline.py` | 164-175 | Construction |
| `voice-server/src/main.py` | 130-145 | Mutation from web events |

---

## Proposed Solution: Typed Context Layers

Split into **three frozen/controlled objects**:

### 1. CallIdentity (Frozen — never changes)

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class CallIdentity:
    """Immutable call metadata. Set once at call start."""
    call_sid: str
    session_id: str
    user_id: str
    phone_number: str
    builder_api_url: str
    is_new_user: bool
```

### 2. CallState (Controlled mutations)

```python
from dataclasses import dataclass, field
from threading import Lock

@dataclass
class CallState:
    """Mutable call state with controlled access."""
    _project_id: str = ""
    _link_sent: bool = False
    _page_opened: bool = False
    _project_count: int = 0
    _latest_project_id: str = ""
    _latest_project_name: str = ""
    _lock: Lock = field(default_factory=Lock, repr=False)

    @property
    def project_id(self) -> str:
        return self._project_id

    def switch_project(self, project_id: str, project_name: str = ""):
        """Explicit project switch — only way to change project_id."""
        with self._lock:
            self._project_id = project_id
            if project_name:
                self._latest_project_name = project_name

    def mark_link_sent(self):
        self._link_sent = True

    def mark_page_opened(self):
        self._page_opened = True

    @property
    def link_sent(self) -> bool:
        return self._link_sent

    @property
    def page_opened(self) -> bool:
        return self._page_opened

    def to_dict(self) -> dict:
        """Snapshot for logging/debugging."""
        return {
            "project_id": self._project_id,
            "link_sent": self._link_sent,
            "page_opened": self._page_opened,
            "project_count": self._project_count,
        }
```

### 3. TurnContext (Per-turn ephemeral data)

```python
@dataclass
class TurnContext:
    """Ephemeral data for the current tool turn. Reset between turns."""
    pending_image_urls: list[str] = field(default_factory=list)
    last_edit_summary: str = ""

    def clear(self):
        """Reset between tool calls."""
        self.pending_image_urls.clear()
        # Note: last_edit_summary intentionally NOT cleared (multi-turn edits)
```

### 4. Unified ToolContext (Composition)

```python
@dataclass
class ToolContext:
    """Composed context passed to tool handlers."""
    identity: CallIdentity
    state: CallState
    turn: TurnContext
    llm_ref: Any = None

    # Convenience properties for backward compatibility during migration
    @property
    def call_sid(self) -> str:
        return self.identity.call_sid

    @property
    def project_id(self) -> str:
        return self.state.project_id

    @property
    def user_id(self) -> str:
        return self.identity.user_id
```

---

## Implementation Steps

1. Create `CallIdentity`, `CallState`, `TurnContext` classes in `voice-server/src/tools/_base.py` (or separate file)
2. Add convenience properties to new `ToolContext` for backward compatibility
3. Update `pipeline.py` to construct the layered context
4. Migrate handlers one at a time:
   - Replace `ctx.project_id` reads with `ctx.state.project_id`
   - Replace `ctx.project_id = x` writes with `ctx.state.switch_project(x)`
   - Replace `ctx.link_sent = True` with `ctx.state.mark_link_sent()`
5. Once all handlers migrated, remove convenience properties (enforce explicit access)
6. Update tests to use new construction pattern

### Migration Strategy (Backward Compatible)

Phase 1: Add new classes + convenience properties (nothing breaks)
Phase 2: Update handlers to use explicit paths (one at a time)
Phase 3: Remove convenience properties (enforce new pattern)

---

## Test Cases

### Unit Tests: `voice-server/tests/test_call_identity.py`

| # | Test | Description | Expected |
|---|------|-------------|----------|
| 1 | `test_identity_is_frozen` | Attempt to mutate `CallIdentity.call_sid` | Raises `FrozenInstanceError` |
| 2 | `test_identity_fields_accessible` | Read all fields | All return provided values |
| 3 | `test_identity_equality` | Two identical identities | `id1 == id2` |

### Unit Tests: `voice-server/tests/test_call_state.py`

| # | Test | Description | Expected |
|---|------|-------------|----------|
| 1 | `test_initial_state_defaults` | Fresh CallState | `project_id == ""`, `link_sent == False` |
| 2 | `test_switch_project_updates_id` | `switch_project("proj123")` | `project_id == "proj123"` |
| 3 | `test_switch_project_updates_name` | `switch_project("p", "My Site")` | `latest_project_name == "My Site"` |
| 4 | `test_mark_link_sent` | `mark_link_sent()` | `link_sent == True` |
| 5 | `test_mark_page_opened` | `mark_page_opened()` | `page_opened == True` |
| 6 | `test_cannot_set_project_id_directly` | `state.project_id = "x"` | Raises `AttributeError` (property has no setter) |
| 7 | `test_to_dict_snapshot` | `to_dict()` after mutations | Dict reflects current state |

### Unit Tests: `voice-server/tests/test_turn_context.py`

| # | Test | Description | Expected |
|---|------|-------------|----------|
| 1 | `test_default_empty` | Fresh TurnContext | `pending_image_urls == []`, `last_edit_summary == ""` |
| 2 | `test_clear_resets_images` | Add images then clear | `pending_image_urls == []` |
| 3 | `test_clear_preserves_edit_summary` | Set summary then clear | `last_edit_summary` unchanged |
| 4 | `test_separate_instances` | Two TurnContexts | Different `pending_image_urls` lists |

### Integration Tests: `voice-server/tests/test_tool_context_composed.py`

| # | Test | Description | Expected |
|---|------|-------------|----------|
| 1 | `test_convenience_properties` | `ctx.call_sid`, `ctx.project_id` | Delegate to sub-objects |
| 2 | `test_handler_with_identity_only` | Handler reads `ctx.identity.call_sid` | Works without state setup |
| 3 | `test_handler_with_state_mutation` | Handler calls `ctx.state.switch_project()` | State updated, identity unchanged |

---

## Acceptance Criteria

- [ ] `CallIdentity` is frozen — no accidental mutation possible
- [ ] `CallState` mutations go through explicit methods (`switch_project`, `mark_link_sent`)
- [ ] `TurnContext` is cleared between tool calls (except `last_edit_summary`)
- [ ] No handler directly sets `ctx.project_id = x` (uses `ctx.state.switch_project()`)
- [ ] Backward-compatible convenience properties available during migration
- [ ] All existing tool handler tests pass with updated ToolContext construction
