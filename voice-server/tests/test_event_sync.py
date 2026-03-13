"""Cross-language sync tests — verifies Python event enums match TypeScript constants.

These tests parse the TypeScript source file and compare extracted values
to the Python enums, catching drift between the two codebases.
"""

import re
from pathlib import Path

from src.events import CallEvent, WebActionType

# Path to the TypeScript source of truth
_TS_EVENTS_FILE = Path(__file__).resolve().parents[2] / "src" / "lib" / "events" / "call-events.ts"


def _extract_ts_const_values(file_path: Path, const_name: str) -> set[str]:
    """Extract string values from a TypeScript `const X = { ... } as const` block."""
    text = file_path.read_text()

    # Find the const block: `export const NAME = { ... } as const`
    pattern = rf"export\s+const\s+{const_name}\s*=\s*\{{([^}}]+)\}}\s*as\s+const"
    match = re.search(pattern, text, re.DOTALL)
    if not match:
        raise ValueError(f"Could not find 'export const {const_name}' in {file_path}")

    block = match.group(1)

    # Extract all string values: KEY: 'value' or KEY: "value"
    values = re.findall(r":\s*['\"]([^'\"]+)['\"]", block)
    return set(values)


def test_python_call_events_match_typescript():
    """Python CallEvent enum values must match TypeScript CALL_EVENTS values."""
    ts_values = _extract_ts_const_values(_TS_EVENTS_FILE, "CALL_EVENTS")
    py_values = {e.value for e in CallEvent}

    assert py_values == ts_values, (
        f"Event mismatch!\n"
        f"  Python only: {py_values - ts_values}\n"
        f"  TypeScript only: {ts_values - py_values}"
    )


def test_python_web_actions_match_typescript():
    """Python WebActionType enum values must match TypeScript WEB_ACTION_TYPES values."""
    ts_values = _extract_ts_const_values(_TS_EVENTS_FILE, "WEB_ACTION_TYPES")
    py_values = {e.value for e in WebActionType}

    assert py_values == ts_values, (
        f"WebActionType mismatch!\n"
        f"  Python only: {py_values - ts_values}\n"
        f"  TypeScript only: {ts_values - py_values}"
    )
