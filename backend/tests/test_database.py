from app.core.database import Base


def test_base_has_metadata():
    assert hasattr(Base, "metadata")
    assert Base.metadata is not None
