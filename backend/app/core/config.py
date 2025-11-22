from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    app_name: str = "Supplier Consumer Platform"
    debug: bool = True
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres"
    jwt_secret_key: str = "CHANGE_ME_SECRET"
    jwt_refresh_secret_key: str = "CHANGE_ME_REFRESH_SECRET"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    class Config:
        env_file = ".env"

@lru_cache
def get_settings() -> Settings:
    return Settings()