import pytest
from pathlib import Path
from app.core.pg_manager import PGManager


def test_pg_manager_initializes():
    manager = PGManager(data_dir="/tmp/test_pg_data")
    assert manager.data_dir == Path("/tmp/test_pg_data")
    assert manager.port == 5432


def test_pg_manager_custom_port():
    manager = PGManager(data_dir="/tmp/test_pg_data", port=15432)
    assert manager.port == 15432
