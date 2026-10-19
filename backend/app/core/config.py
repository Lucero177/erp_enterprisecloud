from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    PROJECT_NAME: str = "ERP EnterpriseCloud"
    DATABASE_URL: str = "postgresql+psycopg2://erp:erp@localhost:5432/erp"
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    CORS_ORIGINS: str = "http://localhost:5173"
    BASE_CURRENCY: str = "PEN"
    DEFAULT_IGV: float = 18.0

    AWS_REGION: str = "us-east-1"
    S3_BUCKET: str = "erp-enterprisecloud-docs"
    S3_PRESIGN_EXPIRES: int = 900
    S3_ENDPOINT_URL: str | None = None
    MAX_UPLOAD_BYTES: int = 20 * 1024 * 1024


settings = Settings()
