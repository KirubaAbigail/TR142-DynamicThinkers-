from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional

from .models import JobPosting, SearchResponse, AnalysisResult, SearchRequest
from .services.job_service import JobService
from .services.intelligence import IntelligenceService
from .config import settings

app = FastAPI(title="Fake Job Detection Portal API")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Services
job_service = JobService(api_key=settings.ADZUNA_API_KEY, app_id=settings.ADZUNA_APP_ID)
intelligence_service = IntelligenceService(gemini_key=settings.GEMINI_API_KEY)

# History storage for trend analysis
analysis_history = []

@app.get("/")
async def root():
    return {"status": "online", "message": "Fake Job Detection Portal API is running."}

@app.get("/stats/trend", response_model=dict)
async def get_trend_dashboard():
    dashboard_report = await intelligence_service.generate_trend_dashboard(analysis_history)
    return {"report": dashboard_report}

@app.post("/jobs", response_model=SearchResponse)
async def get_jobs(request: SearchRequest):
    jobs, source = job_service.fetch_jobs(request.query, request.location)
    return SearchResponse(jobs=jobs, total_count=len(jobs), source=source)

@app.post("/analyze/{job_id}", response_model=AnalysisResult)
async def analyze_job(job_id: str, job: JobPosting):
    try:
        result = await intelligence_service.analyze_job(job)
        
        # Append to history for trend tracking (Limit to last 100 for memory)
        record = result.dict()
        record.update({
            "title": job.title,
            "company_name": job.company_name,
            "location": job.location
        })
        analysis_history.append(record)
        if len(analysis_history) > 100:
            analysis_history.pop(0)
            
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
