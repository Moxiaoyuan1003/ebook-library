"""Database type utilities for cross-dialect compatibility."""

import uuid

from sqlalchemy import CHAR, TypeDecorator
from sqlalchemy.dialects.postgresql import UUID as PG_UUID


class SQLiteUUID(TypeDecorator):
    """Platform-independent UUID type.

    Uses PostgreSQL's native UUID on PostgreSQL,
    and CHAR(36) string storage on other dialects (e.g., SQLite).
    """

    impl = CHAR(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            return str(value)
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            return uuid.UUID(value)
        return value


def patch_uuid_columns_for_sqlite(Base):
    """Replace PostgreSQL UUID columns with SQLite-compatible types.

    Call this BEFORE create_all() when using SQLite.
    """
    for table in Base.metadata.tables.values():
        for column in table.columns:
            if isinstance(column.type, PG_UUID):
                column.type = SQLiteUUID()
