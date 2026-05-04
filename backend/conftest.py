import pytest
import sqlite3
import uuid
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.types import CHAR
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from app.core.database import Base

# Allow SQLite to bind Python UUID objects as strings
sqlite3.register_adapter(uuid.UUID, str)

# Import models to register them in Base.metadata
import app.models  # noqa: F401


def _patch_uuid_columns_for_sqlite():
    """Replace PostgreSQL UUID columns with SQLite-compatible CHAR(36).

    Must be called BEFORE Base.metadata.create_all() to ensure correct DDL.
    """
    for table in Base.metadata.tables.values():
        for column in table.columns:
            if isinstance(column.type, PG_UUID):
                column.type = CHAR(36)


# Patch UUID columns at module load time (before any create_all call)
_patch_uuid_columns_for_sqlite()


@pytest.fixture(scope="session")
def engine():
    """Create a test database engine."""
    eng = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture
def db_session(engine):
    """Create a test database session."""
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.rollback()
    session.close()
