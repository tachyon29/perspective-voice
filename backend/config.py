import os
from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


def load_local_env() -> None:
    """Read backend/.env without replacing values already provided by the process."""
    env_file = Path(__file__).with_name(".env")
    if not env_file.exists():
        return
    for raw_line in env_file.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip().strip("\"'")
        if key:
            os.environ.setdefault(key, value)


load_local_env()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")

    supabase_url: str = ""
    supabase_anon_key: str = ""
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"
    sarvam_api_key: str = ""
    sarvam_chat_model: str = "sarvam-105b-conversations"
    code_runner_image: str = "python:3.12-alpine"
    code_runner_timeout_seconds: int = 5

    @property
    def allowed_origins(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
