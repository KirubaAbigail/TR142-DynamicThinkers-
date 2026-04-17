from pydantic import BaseModel, Field
from typing import List, Optional

class JobPosting(BaseModel):
    id: str
    title: str
    company_name: str
    location: str
    description: str
    salary_range: Optional[str] = None
    contact_email: Optional[str] = None
    url: str
    source: str = "Adzuna"

class RiskFactor(BaseModel):
    factor: str
    impact: float # 0 to 1
    description: str

class VerificationLayers(BaseModel):
    linkedin_verified: bool = False
    website_valid: str = "Unknown" # "Valid", "Suspicious", "Missing"
    traceable: bool = False
    presence_score: str = "Low" # "Low", "Medium", "High"
    https_enabled: bool = False

class PostingHistory(BaseModel):
    repost_count: int = 0
    first_seen: str = "Recently"
    frequency: str = "Stable" # "Stable", "Frequent", "Irregular"

class AnalysisResult(BaseModel):
    job_id: str
    trust_score: float # 0 to 100
    category: str # "Safe", "Suspicious", "Fraudulent"
    explanation: str
    risk_factors: List[RiskFactor]
    verification: VerificationLayers
    history: PostingHistory
    company_size: str = "Unknown"
    company_presence: str = "Unclear"
    hiring_consistency: str = "Realistic"
    network_linked_jobs: List[str] = []

class SearchRequest(BaseModel):
    query: str
    location: str

class SearchResponse(BaseModel):
    jobs: List[JobPosting]
    total_count: int
    source: str = "Live API"
