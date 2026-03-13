"""Tests for build_system_instructions and build_initial_greeting — pure functions."""

from src.prompts import build_system_instructions, build_initial_greeting


def test_new_user_instructions_contain_send_link():
    result = build_system_instructions(is_new_user=True, project_count=0, latest_project_name="")
    assert "send_builder_link" in result


def test_new_user_instructions_exclude_select_project():
    result = build_system_instructions(is_new_user=True, project_count=0, latest_project_name="")
    assert "select_project" not in result


def test_returning_one_project_includes_name():
    result = build_system_instructions(is_new_user=False, project_count=1, latest_project_name="Yoga Studio")
    assert "Yoga Studio" in result


def test_returning_multi_includes_count():
    result = build_system_instructions(is_new_user=False, project_count=3, latest_project_name="Latest")
    assert "3" in result


def test_all_prompts_include_general_rules():
    """All prompts should include general rules (critical rules, noise handling, web sync)."""
    for args in [(True, 0, ""), (False, 1, "X"), (False, 5, "X")]:
        result = build_system_instructions(*args)
        assert "CRITICAL RULES" in result
        assert "NOISE HANDLING" in result


def test_tool_instructions_included_when_provided():
    """Tool-specific instructions are included when passed."""
    result = build_system_instructions(
        is_new_user=True, project_count=0, latest_project_name="",
        tool_instructions="ACTION STEPS MENU:\n- Do something"
    )
    assert "ACTION STEPS MENU" in result


def test_all_prompts_include_timmy():
    for args in [(True, 0, ""), (False, 1, "X"), (False, 5, "X")]:
        result = build_system_instructions(*args)
        assert "Timmy" in result


def test_new_user_greeting():
    result = build_initial_greeting(is_new_user=True, project_count=0, latest_project_name="")
    assert "Greet the caller as Timmy" in result


def test_returning_greeting_includes_name():
    result = build_initial_greeting(is_new_user=False, project_count=1, latest_project_name="Coffee Shop")
    assert "Coffee Shop" in result
