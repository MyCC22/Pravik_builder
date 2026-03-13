"""Tests for _clean_project_name — pure function, no mocking needed."""

from src.tools import _clean_project_name


def test_strips_website_for_prefix():
    assert _clean_project_name("a website for a summer camp") == "Summer Camp"


def test_strips_build_me_prefix():
    assert _clean_project_name("build me a coffee shop site") == "Coffee Shop Site"


def test_strips_trailing_with_clause():
    assert _clean_project_name("yoga studio with pricing and gallery") == "Yoga Studio"


def test_strips_trailing_that_clause():
    assert _clean_project_name("bakery that sells cupcakes") == "Bakery"


def test_removes_leading_articles():
    assert _clean_project_name("the downtown barbershop") == "Downtown Barbershop"


def test_title_cases_output():
    result = _clean_project_name("pet grooming business")
    assert result == "Pet Grooming Business"


def test_truncates_long_names():
    long_desc = "a website for a really long business name that goes on and on and on forever"
    result = _clean_project_name(long_desc)
    assert len(result) <= 40


def test_empty_string():
    assert _clean_project_name("") == ""


def test_short_input():
    assert _clean_project_name("shop") == "Shop"


def test_already_clean_input():
    assert _clean_project_name("Summer Camp") == "Summer Camp"


def test_case_insensitive_prefix():
    result = _clean_project_name("A WEBSITE FOR a gym")
    assert "Gym" in result
