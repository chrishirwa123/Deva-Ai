"""
Deva AI — central configuration.

All tunable values live here (or in .env). Nothing else in the codebase
should hardcode the Ollama URL, model name, or DB path.
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

# Load .env if python-dotenv is available and a .env file exists.
try:
    from dotenv import load_dotenv
    load_dotenv(BASE_DIR / ".env")
except ImportError:
    pass


def _get_bool(name, default=False):
    val = os.environ.get(name)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")


class Config:
    # --- Server ---
    HOST = os.environ.get("DEVA_HOST", "127.0.0.1")  # local-first: never 0.0.0.0 by default
    PORT = int(os.environ.get("DEVA_PORT", 5000))
    SECRET_KEY = os.environ.get("DEVA_SECRET_KEY", "dev-only-change-me-in-.env")
    DEBUG = _get_bool("DEVA_DEBUG", True)

    # --- Ollama ---
    OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
    OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen3:1.7b")
    OLLAMA_EMBED_MODEL = os.environ.get("OLLAMA_EMBED_MODEL", "nomic-embed-text")
    OLLAMA_TIMEOUT_SECONDS = int(os.environ.get("OLLAMA_TIMEOUT_SECONDS", 120))
    DEFAULT_TEMPERATURE = float(os.environ.get("DEVA_TEMPERATURE", 0.7))
    DEFAULT_MAX_TOKENS = int(os.environ.get("DEVA_MAX_TOKENS", 1024))

    # --- Storage ---
    INSTANCE_DIR = BASE_DIR / "instance"
    DB_PATH = INSTANCE_DIR / "deva.db"
    KNOWLEDGE_UPLOAD_DIR = INSTANCE_DIR / "uploads"
    MAX_UPLOAD_MB = int(os.environ.get("DEVA_MAX_UPLOAD_MB", 20))
    ALLOWED_UPLOAD_EXTENSIONS = {".pdf", ".txt", ".md"}

    # --- Identity ---
    IDENTITY_PATH = BASE_DIR / "identity" / "owner_profile.json"
    AI_NAME_DEFAULT = "Deva AI"
    CREATOR_NAME_DEFAULT = "Hirwa Christian"

    # --- Research ---
    RESEARCH_PROVIDER = os.environ.get("DEVA_RESEARCH_PROVIDER", "duckduckgo")
    SEARCH_API_KEY = os.environ.get("DEVA_SEARCH_API_KEY", "")  # only needed for paid providers
    RESEARCH_MAX_SOURCES = int(os.environ.get("DEVA_RESEARCH_MAX_SOURCES", 4))
    RESEARCH_FETCH_TIMEOUT = int(os.environ.get("DEVA_RESEARCH_FETCH_TIMEOUT", 12))

    # --- Retrieval (memory + knowledge context injected into prompts) ---
    MAX_MEMORY_ITEMS_IN_CONTEXT = int(os.environ.get("DEVA_MAX_MEMORY_ITEMS", 6))
    MAX_KNOWLEDGE_CHUNKS_IN_CONTEXT = int(os.environ.get("DEVA_MAX_KNOWLEDGE_CHUNKS", 4))
    KNOWLEDGE_CHUNK_SIZE_CHARS = int(os.environ.get("DEVA_CHUNK_SIZE", 1200))


config = Config()
