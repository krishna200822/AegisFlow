from pathlib import Path
from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]

class Settings(BaseSettings):
    app_name: str = "AegisFlow API"
    environment: str = "development"
    api_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.6-flash"
    stripe_webhook_secret: str = ""
    salesforce_client_id: str = ""
    salesforce_client_secret: SecretStr = SecretStr("")
    salesforce_login_url: str = "https://login.salesforce.com"
    salesforce_api_version: str = "v62.0"
    database_path: str = "./data/aegisflow.sqlite3"
    max_request_bytes: int = 1_048_576
    model_config = SettingsConfigDict(
        env_file=(BACKEND_DIR / ".env", BACKEND_DIR.parent / ".env"),
        extra="ignore",
        case_sensitive=False,
    )

    @property
    def database_file(self) -> Path:
        path = Path(self.database_path)
        if not path.is_absolute():
            path = Path(__file__).resolve().parents[2] / path
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

settings = Settings()
