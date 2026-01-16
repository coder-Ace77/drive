from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    # AWS Config
    aws_access_key_id: str
    aws_secret_access_key: str
    aws_region: str
    s3_bucket_name: str
    
    # Database Config
    # database_url is now expected to be a MongoDB URI (e.g., mongodb://localhost:27017)
    database_url: str 
    database_name: str = "drive"
    
    # Security Config
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

@lru_cache
def get_settings():
    return Settings()
