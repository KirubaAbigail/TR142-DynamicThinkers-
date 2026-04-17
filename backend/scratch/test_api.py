import requests
api_key = "5e0b0f5e36944778fb9c05a568c36d7a"
url = "https://adzuna-adzuna-v1.p.rapidapi.com/v1/api/jobs/gb/search/1"
headers = {
    "X-RapidAPI-Key": api_key,
    "X-RapidAPI-Host": "adzuna-adzuna-v1.p.rapidapi.com"
}
params = {
    "results_per_page": "5",
    "what": "software",
    "where": "london",
}
response = requests.get(url, headers=headers, params=params)
print(f"Status: {response.status_code}")
print(f"Body: {response.text[:500]}")
