"""Tests for TOOLS and RETURNING_USER_TOOLS schema shape — pure data, no mocking."""

from src.tools import TOOLS, RETURNING_USER_TOOLS


def test_all_tools_have_required_fields():
    for tool in TOOLS:
        assert tool["type"] == "function"
        assert "name" in tool
        assert isinstance(tool.get("description"), str)
        assert "parameters" in tool


def test_parameters_follow_schema():
    for tool in TOOLS + RETURNING_USER_TOOLS:
        params = tool["parameters"]
        assert params["type"] == "object"
        assert "properties" in params
        assert "required" in params


def test_no_duplicate_names():
    names = [t["name"] for t in TOOLS]
    assert len(names) == len(set(names))


def test_build_website_tool_exists():
    names = [t["name"] for t in TOOLS]
    assert "build_website" in names
    build = next(t for t in TOOLS if t["name"] == "build_website")
    assert "description" in build["parameters"]["properties"]


def test_setup_call_forwarding_exists():
    names = [t["name"] for t in TOOLS]
    assert "setup_call_forwarding" in names
    fwd = next(t for t in TOOLS if t["name"] == "setup_call_forwarding")
    assert "forwarding_number" in fwd["parameters"]["properties"]


def test_returning_tools_count():
    assert len(RETURNING_USER_TOOLS) == 3
    names = [t["name"] for t in RETURNING_USER_TOOLS]
    assert "select_project" in names
    assert "create_new_project" in names
    assert "list_user_projects" in names


def test_no_overlap_between_tool_sets():
    main_names = {t["name"] for t in TOOLS}
    returning_names = {t["name"] for t in RETURNING_USER_TOOLS}
    assert main_names.isdisjoint(returning_names)
