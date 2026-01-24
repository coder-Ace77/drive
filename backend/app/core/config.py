from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    aws_access_key_id: str
    aws_secret_access_key: str
    aws_region: str
    s3_bucket_name: str
    
    database_url: str 
    database_name: str = "drive"
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_password: str | None = None

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

@lru_cache
def get_settings():
    return Settings()
