import os

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Personal Library Manager"
    APP_VERSION: str = "0.2.0"
    DEBUG: bool = False

    # Database
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "postgres"
    DB_NAME: str = "ebook_library"
    DATABASE_URL: str = ""

    # Desktop mode: set by --data-dir CLI arg
    DATA_DIR: str = ""

    # Embedded PostgreSQL
    PG_DATA_DIR: str = ""
    PG_BIN_DIR: str = ""

    # AI
    AI_PROVIDER: str = "openai"  # openai / claude / ollama / custom
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    OPENAI_MODEL: str = "gpt-4o-mini"
    CLAUDE_API_KEY: str = ""
    CLAUDE_MODEL: str = "claude-sonnet-4-20250514"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.1"
    CUSTOM_API_KEY: str = ""
    CUSTOM_BASE_URL: str = ""
    CUSTOM_MODEL: str = ""

    # Storage
    BOOK_STORAGE_DIR: str = ""
    COVER_CACHE_DIR: str = ""

    # Security
    ENCRYPTION_KEY: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    def get_database_url(self) -> str:
        # Desktop mode: use SQLite when DATA_DIR is set
        if self.DATA_DIR:
            db_path = os.path.join(self.DATA_DIR, "data", "ebook.db")
            return f"sqlite:///{db_path}"
        # Explicit override
        if self.DATABASE_URL:
            return self.DATABASE_URL
        # Default: PostgreSQL
        return f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    def get_async_database_url(self) -> str:
        url = self.get_database_url()
        if url.startswith("sqlite://"):
            return url  # SQLite has no async variant needed
        return url.replace("postgresql://", "postgresql+asyncpg://")

    def get_books_dir(self) -> str:
        if self.DATA_DIR:
            return os.path.join(self.DATA_DIR, "books")
        return self.BOOK_STORAGE_DIR or "books"

    def get_covers_dir(self) -> str:
        if self.DATA_DIR:
            return os.path.join(self.DATA_DIR, "covers")
        return self.COVER_CACHE_DIR or "covers"


settings = Settings()
