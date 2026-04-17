import re
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize

# Download necessary NLTK data (this might take time on first run)
try:
    nltk.download('punkt', quiet=True)
    nltk.download('stopwords', quiet=True)
except Exception:
    pass

SUSPICIOUS_KEYWORDS = [
    "earn money fast", "no experience", "registration fee", 
    "work from home", "quick cash", "no interview", 
    "security deposit", "whatsapp to", "immediate join"
]

FREE_EMAIL_DOMAINS = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "rediffmail.com"]

def clean_text(text):
    if not isinstance(text, str):
        return ""
    # Lowercase
    text = text.lower()
    # Remove special characters
    text = re.sub(r'[^a-zA-Z\s]', '', text)
    # Tokenize
    tokens = word_tokenize(text)
    # Remove stopwords
    stop_words = set(stopwords.words('english'))
    tokens = [t for t in tokens if t not in stop_words]
    return " ".join(tokens)

def extract_features(row):
    """
    Expects a dictionary or Series with keys: 
    title, description, requirements, company_name, contact_email, domain_age
    """
    title = str(row.get('title', '')).lower()
    description = str(row.get('description', '')).lower()
    requirements = str(row.get('requirements', '')).lower()
    contact_email = str(row.get('contact_email', '')).lower()
    
    full_text = f"{title} {description} {requirements}"
    
    # 1. keyword_flag
    keyword_flag = 0
    found_keywords = []
    for kw in SUSPICIOUS_KEYWORDS:
        if kw in full_text:
            keyword_flag = 1
            found_keywords.append(kw)
            
    # 2. email_type (1 for free, 0 for professional)
    email_type = 0
    if "@" in contact_email:
        domain = contact_email.split("@")[-1]
        if domain in FREE_EMAIL_DOMAINS:
            email_type = 1
            
    # 3. text_length
    text_length = len(full_text)
    
    # 4. domain_age (passed through or default to 0 if missing)
    domain_age = float(row.get('domain_age', 0))
    
    return {
        'keyword_flag': keyword_flag,
        'email_type': email_type,
        'text_length': text_length,
        'domain_age': domain_age,
        'found_keywords': found_keywords
    }

def get_explanation(prediction, proba, features):
    if proba < 0.3:
        return "This job posting appears to be legitimate. The company name and contact details look standard, and no common scam patterns were detected."
    
    reasons = []
    if features['keyword_flag'] == 1:
        reasons.append(f"Contains suspicious phrases: {', '.join(features['found_keywords'][:3])}")
    if features['email_type'] == 1:
        reasons.append("Uses a free/public email domain instead of a corporate one")
    if features['domain_age'] < 50 and features['domain_age'] > 0:
        reasons.append("The company website or email domain is very new")
    if features['text_length'] < 100:
        reasons.append("The job description is unusually short or lacks detail")
        
    if not reasons:
        reasons.append("The combination of title and company metadata carries high risk factors common in fraudulent postings.")
        
    explanation = "Flagged because: " + " | ".join(reasons)
    return explanation
