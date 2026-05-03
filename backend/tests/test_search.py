import pytest
from app.services.search.engine import SearchEngine


def test_search_engine_exists():
    assert SearchEngine is not None
