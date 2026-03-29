"""
Synod Configuration — loads all settings from environment variables.
Uses pydantic-settings for type-safe config with .env support.
"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # --- LLM Providers ---
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # --- Ollama (local fallback) ---
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3"

    # --- MongoDB ---
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "synod"

    # --- Pinecone ---
    PINECONE_API_KEY: Optional[str] = None
    PINECONE_INDEX: str = "synod-decisions"

    # --- Jina AI ---
    JINA_API_KEY: Optional[str] = None

    # --- App ---
    CORS_ORIGINS: str = "http://localhost:3000"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
