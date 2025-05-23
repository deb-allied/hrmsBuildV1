import os
from typing import Any, Dict, List, Optional, Union

from pydantic import AnyHttpUrl, AnyUrl, BaseSettings, validator
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    """Application settings configuration."""

    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Attendance Tracker"

    # SECURITY
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-for-development")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days

    # DATABASE
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", ""
    )
    SQLALCHEMY_DATABASE_URI: Optional[str] = None

    @validator("SQLALCHEMY_DATABASE_URI", pre=True, always=True)
    def set_db_uri(cls, v: Optional[str], values: Dict[str, Any]) -> str:
        return values.get("DATABASE_URL")

    #Scheduled Auto Logout
    AUTO_LOGOUT_ENABLED: bool = True
    AUTO_LOGOUT_INTERVAL_MINUTES: int = 10
    AUTO_LOGOUT_SESSION_HOURS: int = 2
    INTERNAL_API_KEY: str = "your-secure-internal-api-key"

    # CORS
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []

    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], List[AnyHttpUrl]]:
        if isinstance(v, str):
            # If it's a plain string (either one URL or comma-separated)
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, list):
            return v
        raise ValueError("Invalid format for BACKEND_CORS_ORIGINS")

    class Config:
        case_sensitive = True

    # GEOFENCE SETTINGS
    GEOFENCE_RADIUS_METERS: int = 100

    class Config:
        case_sensitive = True

    # LDAP SETTINGS
    LDAP_SERVER: str = os.getenv("LDAP_SERVER", "ldap.example.com")
    LDAP_PORT: int = int(os.getenv("LDAP_PORT", 389))
    LDAP_DOMAIN: str = os.getenv("LDAP_DOMAIN", "example.com")


settings = Settings()
