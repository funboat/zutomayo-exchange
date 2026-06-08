from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://zutomayo:zutomayo@localhost:5432/zutomayo"
    jwt_secret: str = "change-me-to-a-random-secret-at-least-32-chars"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    upload_dir: str = "uploads/items"
    image_quality: int = 85
    max_image_dimension: int = 2048
    cors_origins: list[str] = ["http://localhost:5173"]
    max_image_size: int = 5 * 1024 * 1024  # 5MB
    allowed_image_types: list[str] = ["image/jpeg", "image/png", "image/webp", "image/gif"]

    model_config = {"env_file": ".env", "case_sensitive": False}


settings = Settings()
