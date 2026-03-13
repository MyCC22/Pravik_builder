"""Tests for CallState — controlled mutable call state."""

import pytest

from src.tools._base import CallState


def test_initial_state_defaults():
    state = CallState()
    assert state.project_id == ""
    assert state.link_sent is False
    assert state.page_opened is False
    assert state.project_count == 0
    assert state.latest_project_id == ""
    assert state.latest_project_name == ""


def test_switch_project_updates_id():
    state = CallState()
    state.switch_project("proj-1")
    assert state.project_id == "proj-1"


def test_switch_project_updates_name():
    state = CallState()
    state.switch_project("proj-2", "My Site")
    assert state.project_id == "proj-2"
    assert state.latest_project_name == "My Site"


def test_mark_link_sent():
    state = CallState()
    assert state.link_sent is False
    state.mark_link_sent()
    assert state.link_sent is True


def test_mark_page_opened():
    state = CallState()
    assert state.page_opened is False
    state.mark_page_opened()
    assert state.page_opened is True


def test_cannot_set_project_id_directly():
    state = CallState()
    with pytest.raises(AttributeError):
        state.project_id = "sneaky"


def test_to_dict_snapshot():
    state = CallState(_project_id="p-1", project_count=3)
    state.mark_link_sent()
    result = state.to_dict()
    assert result == {
        "project_id": "p-1",
        "link_sent": True,
        "page_opened": False,
        "project_count": 3,
    }
