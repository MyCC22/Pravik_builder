"""Tests for tool schemas — validates registry shape and content."""

from src.tools import get_all_tools, get_tools_for_user, get_tool_schemas


def test_all_tools_have_required_fields():
    for tool in get_all_tools():
        assert tool.name, "Tool must have a name"
        assert isinstance(tool.description, str) and tool.description
        assert isinstance(tool.parameters, dict)
        assert callable(tool.handle)


def test_schemas_follow_openai_format():
    schemas = get_tool_schemas(get_all_tools())
    for schema in schemas:
        assert schema["type"] == "function"
        assert "name" in schema
        assert "description" in schema
        params = schema["parameters"]
        assert params["type"] == "object"
        assert "properties" in params
        assert "required" in params


def test_no_duplicate_names():
    names = [t.name for t in get_all_tools()]
    assert len(names) == len(set(names))


def test_build_website_tool_exists():
    names = [t.name for t in get_all_tools()]
    assert "build_website" in names
    build = next(t for t in get_all_tools() if t.name == "build_website")
    assert "description" in build.parameters["properties"]


def test_setup_call_forwarding_exists():
    names = [t.name for t in get_all_tools()]
    assert "setup_call_forwarding" in names
    fwd = next(t for t in get_all_tools() if t.name == "setup_call_forwarding")
    assert "forwarding_number" in fwd.parameters["properties"]


def test_returning_tools_count():
    all_tools = get_tools_for_user(is_returning=True)
    non_returning = get_tools_for_user(is_returning=False)
    returning_only = [t for t in all_tools if t.returning_user_only]
    assert len(returning_only) == 3
    names = [t.name for t in returning_only]
    assert "select_project" in names
    assert "create_new_project" in names
    assert "list_user_projects" in names


def test_no_overlap_between_tool_sets():
    non_returning = get_tools_for_user(is_returning=False)
    returning_only = [t for t in get_all_tools() if t.returning_user_only]
    main_names = {t.name for t in non_returning}
    returning_names = {t.name for t in returning_only}
    assert main_names.isdisjoint(returning_names)
