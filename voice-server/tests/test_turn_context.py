"""Tests for TurnContext — ephemeral per-turn data."""

from src.tools._base import TurnContext


def test_default_empty():
    turn = TurnContext()
    assert turn.pending_image_urls == []
    assert turn.last_edit_summary == ""


def test_consume_images_returns_and_clears():
    turn = TurnContext()
    turn.pending_image_urls.extend(["img1.jpg", "img2.png"])
    result = turn.consume_images()
    assert result == ["img1.jpg", "img2.png"]
    assert turn.pending_image_urls == []


def test_consume_preserves_edit_summary():
    turn = TurnContext()
    turn.last_edit_summary = "Changed the header"
    turn.pending_image_urls.append("photo.jpg")
    turn.consume_images()
    assert turn.last_edit_summary == "Changed the header"


def test_separate_instances():
    t1 = TurnContext()
    t2 = TurnContext()
    t1.pending_image_urls.append("only-in-t1.jpg")
    assert len(t2.pending_image_urls) == 0
