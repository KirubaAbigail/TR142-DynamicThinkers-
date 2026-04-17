import requests
import os
from typing import List, Dict
from ..models import JobPosting

class JobService:
    def __init__(self, api_key: str = None, app_id: str = None):
        self.api_key = api_key
        self.app_id = app_id
        # Official Adzuna API Base URL
        self.base_url = "https://api.adzuna.com/v1/api/jobs/gb/search/1"

    def fetch_jobs(self, query: str, location: str = "London") -> tuple[List[JobPosting], str]:
        # If credentials are missing, use simulated data
        if not self.api_key or not self.app_id:
            return self._get_mock_jobs(query, location), "Simulated Data (Credentials Missing)"
        
        params = {
            "app_id": self.app_id,
            "app_key": self.api_key,
            "results_per_page": 15,
            "what": query,
            "where": location,
            "content-type": "application/json"
        }
        
        try:
            response = requests.get(self.base_url, params=params)
            
            if response.status_code != 200:
                print(f"Adzuna API Error: {response.status_code} - {response.text}")
                return self._get_mock_jobs(query, location), f"Simulated (API Error {response.status_code})"
                
            data = response.json()
            jobs = []
            for item in data.get("results", []):
                # Standardize location display
                loc_disp = "Remote"
                if item.get("location"):
                    loc_parts = item.get("location", {}).get("area", [])
                    loc_disp = ", ".join(loc_parts[-2:]) if loc_parts else item.get("location", {}).get("display_name", "Remote")

                jobs.append(JobPosting(
                    id=str(item.get("id")),
                    title=item.get("title", "No Title").replace("<strong>", "").replace("</strong>", ""),
                    company_name=item.get("company", {}).get("display_name", "Confidential"),
                    location=loc_disp,
                    description=item.get("description", "").replace("<strong>", "").replace("</strong>", ""),
                    salary_range=f"£{item.get('salary_min', '')} - £{item.get('salary_max', '')}" if item.get('salary_min') else "Competitive",
                    url=item.get("redirect_url", ""),
                    source="Adzuna Live Data"
                ))
            return jobs, "Adzuna Live API"
        except Exception as e:
            print(f"Error fetching from Adzuna: {e}")
            return self._get_mock_jobs(query, location), "Simulated (Network Error)"

    def _get_mock_jobs(self, query: str, location: str) -> List[JobPosting]:
        import random
        # Real patterns
        companies = ["Google", "Microsoft", "Amazon", "Meta", "TCS", "Infosys", "Wipro", "Accenture", "Deloitte", "HCLTech", "LTIMindtree", "Cognizant"]
        prefixes = ["Junior", "Senior", "Lead", "Principal", "Associate", "Intern", "Expert"]
        safe_salaries = ["₹8,00,000 - ₹12,00,000", "₹15,00,000 - ₹25,00,000", "Competitive", "Not Disclosed"]
        
        # Fraud patterns
        fraud_phrases = ["Registration fee required", "Urgent hiring - Join without interview", "Security deposit mandatory for laptop", "Immediate earnings! Pay 500 processing fee"]
        fraud_companies = ["Quick Cash HR", "Fast Hire Solutions", "Job Hub (Confidential)", "Global Wealth Group"]
        personal_emails = ["hr.support@gmail.com", "career.recruiter@yahoo.com", "jobs.verified@outlook.com"]
        fraud_salaries = ["₹50,000/week", "₹1,00,000/month (No Tax)", "₹5,000 Joining Bonus"]
        
        descriptions = [
            "We are seeking a talented {query} to join our growing team in {location}. You will be responsible for building scalable systems.",
            "Exciting opportunity for a {query} professional. Work from {location} or Remote. Competitive benefits included.",
            "Help us redefine the future of technology as our new {query}. Must have 3+ years experience. Office located in {location}.",
            "Join {company} as a {role}. We are looking for passionate individuals who love {query} and innovation."
        ]
        
        jobs = []
        num_jobs = random.randint(6, 12)
        
        for i in range(num_jobs):
            is_fraud = random.random() < 0.4 # 40% probability of fraud
            
            if is_fraud:
                company = random.choice(fraud_companies)
                title = f"{query.title()} - {random.choice(['URGENT', 'Direct Join', 'Work from Home'])}"
                salary = random.choice(fraud_salaries)
                
                phrase = random.choice(fraud_phrases)
                email = random.choice(personal_emails)
                desc = f"{phrase}. We need a {title} for {location}. No interviews, direct joining after {phrase.lower()}. Contact us at {email}. {query} experts only."
            else:
                company = random.choice(companies)
                prefix = random.choice(prefixes)
                title = f"{prefix} {query.title()}" if random.random() > 0.3 else query.title()
                salary = random.choice(safe_salaries)
                
                desc_template = random.choice(descriptions)
                desc = desc_template.format(query=query, location=location, company=company, role=title)
            
            jobs.append(JobPosting(
                id=f"sim-{random.randint(1000, 9999)}",
                title=title,
                company_name=company,
                location=location.title(),
                description=desc,
                salary_range=salary,
                url="https://example.com/simulated-job",
                source="Simulated"
            ))
            
        return jobs
