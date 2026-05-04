import os
import sqlite3
import uuid
from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

# Allow SQLite to bind Python UUID objects as strings
sqlite3.register_adapter(uuid.UUID, str)


class Base(DeclarativeBase):
    pass


def _is_sqlite(url: str) -> bool:
    return url.startswith("sqlite:")


def _make_engine(url: str):
    """Create engine with dialect-appropriate settings."""
    if _is_sqlite(url):
        eng = create_engine(
            url,
            connect_args={"check_same_thread": False},
        )

        # Enable WAL mode and foreign keys for SQLite
        @event.listens_for(eng, "connect")
        def _set_sqlite_pragma(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        return eng
    else:
        return create_engine(
            url,
            pool_size=5,
            max_overflow=10,
            pool_pre_ping=True,
        )


engine = _make_engine(settings.get_database_url())

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_database():
    """Initialize the database (create tables, etc.).

    For desktop/SQLite mode: creates data directory, patches UUID columns,
    and runs create_all().  For PostgreSQL mode this is a no-op since
    migrations (Alembic) handle schema.
    """
    url = settings.get_database_url()
    if not _is_sqlite(url):
        return

    # Ensure the data directory exists
    db_path = url.replace("sqlite:///", "")
    os.makedirs(os.path.dirname(db_path), exist_ok=True)

    # Import all models so they are registered in Base.metadata
    import app.models  # noqa: F401

    # Patch UUID columns for SQLite compatibility
    from app.core.types import patch_uuid_columns_for_sqlite

    patch_uuid_columns_for_sqlite(Base)

    Base.metadata.create_all(bind=engine)
