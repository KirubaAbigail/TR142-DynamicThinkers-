from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    ADZUNA_API_KEY: str = ""
    ADZUNA_APP_ID: str = ""
    GEMINI_API_KEY: str = ""
    GOOGLE_MAPS_API_KEY: str = ""
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "fake_job_detection"
    
    class Config:
        env_file = ".env"

settings = Settings()
