"""Integration tests for phase-aware prompt assembly.

These tests document the intended phase injection contract.
The `phase` parameter is currently a no-op — the test that verifies
active phase injection behavior is marked xfail until implemented.

When the dynamic phase feature lands (mid-call llm.update_session()
support), remove the xfail marker and implement the phase rules.
"""

import pytest
from src.prompts import build_system_instructions


# ---------------------------------------------------------------------------
# Contract: phase= does not break existing output
# ---------------------------------------------------------------------------


def test_greeting_phase_produces_valid_prompt():
    """Passing phase='greeting' returns a usable prompt (does not raise or return empty)."""
    result = build_system_instructions(
        is_new_user=True,
        project_count=0,
        latest_project_name="",
        phase="greeting",
    )
    assert len(result) > 100
    assert "Timmy" in result
    assert "CRITICAL RULES" in result


def test_building_phase_produces_valid_prompt():
    """Passing phase='building' returns a usable prompt (does not raise or return empty)."""
    result = build_system_instructions(
        is_new_user=True,
        project_count=0,
        latest_project_name="",
        phase="building",
    )
    assert len(result) > 100
    assert "Timmy" in result


# ---------------------------------------------------------------------------
# Future contract: phase-specific rules injection (xfail until implemented)
# ---------------------------------------------------------------------------


@pytest.mark.xfail(
    reason="Phase-specific rules injection not yet implemented. "
    "When implemented, phase='building' should add build-phase-specific rules."
)
def test_building_phase_injects_build_rules():
    """Once implemented: phase='building' adds build-specific rules to the prompt."""
    result_building = build_system_instructions(
        is_new_user=True,
        project_count=0,
        latest_project_name="",
        phase="building",
    )
    result_no_phase = build_system_instructions(
        is_new_user=True, project_count=0, latest_project_name=""
    )
    # When implemented, building phase should add extra instructions
    assert result_building != result_no_phase
