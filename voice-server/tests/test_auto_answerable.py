"""Tests for _is_auto_answerable — pure function, no mocking needed."""

from src.tools import _is_auto_answerable, _AUTO_YES_PATTERNS


def test_matches_would_you_like():
    assert _is_auto_answerable("would you like me to add one?", "add a form") is True


def test_matches_should_i():
    assert _is_auto_answerable("should i add a testimonials section?", "add section") is True


def test_matches_would_you_like_to_add():
    assert _is_auto_answerable("would you like to add a gallery?", "gallery") is True


def test_matches_would_you_like_me_to_create():
    assert _is_auto_answerable("would you like me to create a new section?", "section") is True


def test_do_you_want_not_in_patterns():
    # "do you want me to" is NOT one of the auto-yes patterns
    assert "do you want" not in " | ".join(_AUTO_YES_PATTERNS)
    assert _is_auto_answerable("do you want me to change the color?", "color") is False


def test_case_insensitive():
    assert _is_auto_answerable("WOULD YOU LIKE me to add it?", "add") is True


def test_no_match():
    assert _is_auto_answerable("what color should it be?", "color") is False


def test_empty_question():
    assert _is_auto_answerable("", "anything") is False


def test_instruction_not_used_for_matching():
    # The function only checks the question, not the instruction
    assert _is_auto_answerable("what is your name?", "would you like") is False
