"""Tests for the layered prompt system — discrete layers, format substitution, layer separators."""

from src.prompts import build_system_instructions, build_initial_greeting
from src.prompts.layers import (
    LAYER_IDENTITY,
    LAYER_GENERAL_RULES,
    _CALL_FLOW_NEW_USER,
    _CALL_FLOW_RETURNING_ONE,
    _CALL_FLOW_RETURNING_MULTI,
    _LAYER_SEP,
)


# ---------------------------------------------------------------------------
# Layer constants are non-empty strings
# ---------------------------------------------------------------------------


def test_layer_identity_is_non_empty_string():
    """LAYER_IDENTITY must be a non-empty string."""
    assert isinstance(LAYER_IDENTITY, str) and len(LAYER_IDENTITY) > 0


def test_layer_general_rules_is_non_empty_string():
    """LAYER_GENERAL_RULES must be a non-empty string."""
    assert isinstance(LAYER_GENERAL_RULES, str) and len(LAYER_GENERAL_RULES) > 0


def test_call_flow_new_user_is_non_empty_string():
    """_CALL_FLOW_NEW_USER must be a non-empty string."""
    assert isinstance(_CALL_FLOW_NEW_USER, str) and len(_CALL_FLOW_NEW_USER) > 0


def test_call_flow_returning_one_is_template():
    """_CALL_FLOW_RETURNING_ONE must contain {project_name} placeholder."""
    assert "{project_name}" in _CALL_FLOW_RETURNING_ONE


def test_call_flow_returning_multi_is_template():
    """_CALL_FLOW_RETURNING_MULTI must contain both placeholders."""
    assert "{project_count}" in _CALL_FLOW_RETURNING_MULTI
    assert "{project_name}" in _CALL_FLOW_RETURNING_MULTI


# ---------------------------------------------------------------------------
# Layer separator appears between layers
# ---------------------------------------------------------------------------


def test_layer_separator_appears_in_output():
    """The assembled prompt must contain the layer separator string."""
    result = build_system_instructions(
        is_new_user=True, project_count=0, latest_project_name=""
    )
    assert _LAYER_SEP in result


def test_layer_separator_appears_between_identity_and_rules():
    """Identity and general rules are in the output with separator between."""
    result = build_system_instructions(
        is_new_user=True, project_count=0, latest_project_name=""
    )
    identity_pos = result.index("Timmy")
    rules_pos = result.index("CRITICAL RULES")
    sep_pos = result.index(_LAYER_SEP)
    assert identity_pos < sep_pos < rules_pos


# ---------------------------------------------------------------------------
# .format() substitution (not .replace())
# ---------------------------------------------------------------------------


def test_returning_one_project_no_raw_placeholder():
    """After build, no unformatted {project_name} placeholder should remain."""
    result = build_system_instructions(
        is_new_user=False, project_count=1, latest_project_name="Yoga Studio"
    )
    assert "{project_name}" not in result
    assert "Yoga Studio" in result


def test_returning_multi_project_no_raw_placeholder():
    """After build, no unformatted {project_count} or {project_name} should remain."""
    result = build_system_instructions(
        is_new_user=False, project_count=3, latest_project_name="Coffee Shop"
    )
    assert "{project_count}" not in result
    assert "{project_name}" not in result
    assert "3" in result
    assert "Coffee Shop" in result


def test_fallback_project_name_when_empty():
    """Empty project_name falls back to 'your website' rather than leaving blank."""
    result = build_system_instructions(
        is_new_user=False, project_count=1, latest_project_name=""
    )
    assert "your website" in result
    assert "{project_name}" not in result


# ---------------------------------------------------------------------------
# phase parameter is accepted and currently a no-op
# ---------------------------------------------------------------------------


def test_phase_param_accepted_without_error():
    """build_system_instructions accepts phase= without raising."""
    result = build_system_instructions(
        is_new_user=True, project_count=0, latest_project_name="", phase="greeting"
    )
    assert "Timmy" in result


def test_phase_none_matches_no_phase():
    """Passing phase=None produces the same output as omitting phase."""
    without_phase = build_system_instructions(
        is_new_user=True, project_count=0, latest_project_name=""
    )
    with_phase_none = build_system_instructions(
        is_new_user=True, project_count=0, latest_project_name="", phase=None
    )
    assert without_phase == with_phase_none
