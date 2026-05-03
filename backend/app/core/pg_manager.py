import subprocess
import shutil
import os
import time
import socket
from pathlib import Path


class PGManager:
    """Manages an embedded PostgreSQL instance."""

    def __init__(self, data_dir: str, port: int = 5432, user: str = "postgres"):
        self.data_dir = Path(data_dir)
        self.port = port
        self.user = user
        self._process: subprocess.Popen | None = None

    def _find_pg_binary(self, name: str) -> str:
        """Find PostgreSQL binary in PATH or common locations."""
        binary = shutil.which(name)
        if binary:
            return binary
        raise FileNotFoundError(f"PostgreSQL binary '{name}' not found in PATH")

    def is_initialized(self) -> bool:
        """Check if the data directory has been initialized."""
        return (self.data_dir / "postgresql.conf").exists()

    def init_db(self) -> None:
        """Initialize the PostgreSQL data directory."""
        if self.is_initialized():
            return

        self.data_dir.mkdir(parents=True, exist_ok=True)
        initdb = self._find_pg_binary("initdb")

        env = os.environ.copy()
        env["PGDATA"] = str(self.data_dir)

        subprocess.run(
            [initdb, "-D", str(self.data_dir), "-U", self.user, "--encoding=UTF8"],
            check=True,
            env=env,
            capture_output=True,
        )

    def start(self) -> None:
        """Start the PostgreSQL server."""
        if self._process and self._process.poll() is None:
            return

        pg_ctl = self._find_pg_binary("pg_ctl")

        env = os.environ.copy()
        env["PGDATA"] = str(self.data_dir)

        subprocess.run(
            [pg_ctl, "start", "-D", str(self.data_dir), "-l", str(self.data_dir / "postgresql.log"), "-o", f"-p {self.port}"],
            check=True,
            env=env,
            capture_output=True,
        )

        self._wait_for_ready()

    def stop(self) -> None:
        """Stop the PostgreSQL server."""
        if self._process:
            pg_ctl = self._find_pg_binary("pg_ctl")
            env = os.environ.copy()
            env["PGDATA"] = str(self.data_dir)
            subprocess.run(
                [pg_ctl, "stop", "-D", str(self.data_dir), "-m", "fast"],
                check=True,
                env=env,
                capture_output=True,
            )
            self._process = None

    def _wait_for_ready(self, timeout: int = 30) -> None:
        """Wait for PostgreSQL to be ready to accept connections."""
        start = time.time()
        while time.time() - start < timeout:
            try:
                with socket.create_connection(("localhost", self.port), timeout=1):
                    return
            except (ConnectionRefusedError, OSError):
                time.sleep(0.5)
        raise TimeoutError(f"PostgreSQL did not start within {timeout} seconds")

    def create_database(self, db_name: str) -> None:
        """Create the database if it doesn't exist."""
        createdb = self._find_pg_binary("createdb")
        env = os.environ.copy()
        env["PGDATA"] = str(self.data_dir)
        try:
            subprocess.run(
                [createdb, "-h", "localhost", "-p", str(self.port), "-U", self.user, db_name],
                check=True,
                env=env,
                capture_output=True,
            )
        except subprocess.CalledProcessError:
            pass  # Database may already exist

    def enable_pgvector(self) -> None:
        """Enable the pgvector extension."""
        psql = self._find_pg_binary("psql")
        env = os.environ.copy()
        env["PGDATA"] = str(self.data_dir)
        subprocess.run(
            [psql, "-h", "localhost", "-p", str(self.port), "-U", self.user, "-d", "ebook_library", "-c", "CREATE EXTENSION IF NOT EXISTS vector;"],
            check=True,
            env=env,
            capture_output=True,
        )
