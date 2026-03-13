"""Tests for CallIdentity — frozen immutable call metadata."""

import pytest
from dataclasses import FrozenInstanceError

from src.tools._base import CallIdentity


def _make_identity(**overrides) -> CallIdentity:
    defaults = dict(
        call_sid="call-1",
        session_id="sess-1",
        user_id="user-1",
        phone_number="+15551234567",
        builder_api_url="http://localhost:3000",
        is_new_user=True,
    )
    defaults.update(overrides)
    return CallIdentity(**defaults)


def test_identity_is_frozen():
    identity = _make_identity()
    with pytest.raises(FrozenInstanceError):
        identity.call_sid = "new-value"


def test_identity_fields_accessible():
    identity = _make_identity(
        call_sid="abc",
        session_id="sess-x",
        user_id="uid-42",
        phone_number="+10005551234",
        builder_api_url="https://api.example.com",
        is_new_user=False,
    )
    assert identity.call_sid == "abc"
    assert identity.session_id == "sess-x"
    assert identity.user_id == "uid-42"
    assert identity.phone_number == "+10005551234"
    assert identity.builder_api_url == "https://api.example.com"
    assert identity.is_new_user is False


def test_identity_equality():
    a = _make_identity(call_sid="same", user_id="u1")
    b = _make_identity(call_sid="same", user_id="u1")
    assert a == b
