import pytest
from app.core.database import get_db, Base


def test_base_has_metadata():
    assert hasattr(Base, 'metadata')
    assert Base.metadata is not None
