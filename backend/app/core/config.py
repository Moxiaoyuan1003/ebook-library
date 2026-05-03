from pydantic_settings import BaseSettings
from pathlib import Path
import os


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Personal Library Manager"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    # Database
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "postgres"
    DB_NAME: str = "ebook_library"
    DATABASE_URL: str = ""

    # Embedded PostgreSQL
    PG_DATA_DIR: str = ""
    PG_BIN_DIR: str = ""

    # AI
    AI_PROVIDER: str = "openai"  # openai / claude / ollama
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    CLAUDE_API_KEY: str = ""
    OLLAMA_BASE_URL: str = "http://localhost:11434"

    # Storage
    BOOK_STORAGE_DIR: str = ""
    COVER_CACHE_DIR: str = ""

    # Security
    ENCRYPTION_KEY: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    def get_database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    def get_async_database_url(self) -> str:
        url = self.get_database_url()
        return url.replace("postgresql://", "postgresql+asyncpg://")


settings = Settings()
