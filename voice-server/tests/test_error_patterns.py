"""Test the shared error result helper produces consistent output."""
import pytest


def test_make_error_result_retryable():
    from src.tools._helpers import make_error_result
    result = make_error_result("Service unavailable", retryable=True)
    assert result["status"] == "temporary_error"
    assert result["retryable"] is True
    assert "Service unavailable" in result["message"]
    assert "suggestion" in result


def test_make_error_result_permanent():
    from src.tools._helpers import make_error_result
    result = make_error_result("Invalid project", retryable=False)
    assert result["status"] == "permanent_error"
    assert result["retryable"] is False


def test_make_error_result_custom_suggestion():
    from src.tools._helpers import make_error_result
    result = make_error_result("Oops", retryable=True, suggestion="Try again in 30s")
    assert result["suggestion"] == "Try again in 30s"


def test_make_error_result_default_suggestion_retryable():
    from src.tools._helpers import make_error_result
    result = make_error_result("Busy", retryable=True)
    assert "try again" in result["suggestion"].lower() or "busy" in result["suggestion"].lower()


def test_make_error_result_default_suggestion_permanent():
    from src.tools._helpers import make_error_result
    result = make_error_result("Broken", retryable=False)
    assert "suggestion" in result
    assert len(result["suggestion"]) > 0
