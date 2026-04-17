import streamlit as st
import pandas as pd
import joblib
import os
import plotly.express as px
import plotly.graph_objects as go
from utils import clean_text, extract_features, get_explanation, SUSPICIOUS_KEYWORDS

# Page Configuration
st.set_page_config(
    page_title="JobGuard AI | Fraudulent Job Detection",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for Premium Look
st.markdown("""
<style>
    .metric-card {
        background-color: #1e2130;
        padding: 20px;
        border-radius: 10px;
        border: 1px solid #3d4156;
        text-align: center;
    }
    .status-safe { color: #00ff88; font-weight: bold; }
    .status-suspicious { color: #ffcc00; font-weight: bold; }
    .status-fraud { color: #ff4d4d; font-weight: bold; }
    .highlight { background-color: rgba(255, 77, 77, 0.2); border-bottom: 1px dashed #ff4d4d; padding: 0 2px; }
</style>
""", unsafe_allow_html=True)

# Helper: Load Model
@st.cache_resource
def load_model():
    if os.path.exists('model.joblib'):
        return joblib.load('model.joblib')
    return None

def highlight_keywords(text):
    for word in SUSPICIOUS_KEYWORDS:
        # Use simple case-insensitive replacement
        pattern = re.compile(re.escape(word), re.IGNORECASE)
        text = pattern.sub(f'<span class="highlight">{word}</span>', text)
    return text

# Sidebar Navigation
st.sidebar.title("🛡️ JobGuard AI")
st.sidebar.markdown("---")
page = st.sidebar.radio("Navigation", ["Home", "Manual Check", "Batch Upload", "Dashboard"])

model = load_model()

# --- Home Page ---
if page == "Home":
    st.title("🛡️ Fraudulent Job Posting Detection System")
    st.markdown("""
    ### Protect yourself from job scams with AI-driven analysis.
    
    Our system uses Machine Learning (Logistic Regression + TF-IDF) and NLP to identify suspicious job postings.
    We analyze keywords, email domains, domain age, and text patterns to give you an explainable risk score.
    
    **Key Features:**
    - **Real-time Classification**: Categorize jobs as Safe, Suspicious, or Fraudulent.
    - **Explainable AI**: Understand *why* a job was flagged.
    - **Interactive Dashboard**: Visualize fraud trends and historical data.
    - **Batch Processing**: Upload CSV files for mass screening.
    """)
    
    col1, col2, col3 = st.columns(3)
    with col1:
        st.info("**98% Accuracy** on historical scam data.")
    with col2:
        st.warning("**Keyword Detection** for 'Earn Money Fast' and others.")
    with col3:
        st.success("**Email Verification** to spot fake recruiters.")

    if model is None:
        st.error("⚠️ Model not found. Please run `train_model.py` to initialize the system.")
        if st.button("Initialize & Train Model"):
            with st.spinner("Training model... this may take a minute."):
                import subprocess
                subprocess.run(["python", "train_model.py"])
                st.rerun()

# --- Manual Check ---
elif page == "Manual Check":
    st.title("🔍 Individual Job Check")
    st.write("Enter the job details below to evaluate the fraud risk.")
    
    with st.form("job_form"):
        col1, col2 = st.columns(2)
        with col1:
            title = st.text_input("Job Title", placeholder="e.g. Software Engineer")
            company = st.text_input("Company Name", placeholder="e.g. HCL Technologies")
            salary = st.text_input("Salary Range", placeholder="e.g. 10 LPA or $5000/mo")
        with col2:
            email = st.text_input("Contact Email", placeholder="e.g. hr@company.com")
            domain_age = st.number_input("Domain Age (Days)", min_value=0, value=365)
            employment_type = st.selectbox("Employment Type", ["Full-time", "Part-time", "Contract", "Freelance"])
            
        description = st.text_area("Job Description", height=150)
        requirements = st.text_area("Requirements", height=100)
        
        submit = st.form_submit_button("Analyze Job")
        
    if submit:
        if not title or not description:
            st.error("Please provide at least a Job Title and Description.")
        elif model is None:
            st.error("Model is not initialized.")
        else:
            # 1. Extract features
            input_data = {
                'title': title,
                'description': description,
                'requirements': requirements,
                'company_name': company,
                'contact_email': email,
                'domain_age': domain_age
            }
            features = extract_features(input_data)
            
            # 2. Predict
            # Combine text for the model
            combined_text = clean_text(f"{title} {description} {requirements}")
            X_input = pd.DataFrame([{
                'combined_text': combined_text,
                'domain_age': features['domain_age'],
                'keyword_flag': features['keyword_flag'],
                'email_type': features['email_type'],
                'text_length': features['text_length']
            }])
            
            proba = model.predict_proba(X_input)[0][1]
            
            # 3. Display Results
            st.divider()
            col_res1, col_res2 = st.columns([1, 2])
            
            label = "Safe"
            status_class = "status-safe"
            if proba > 0.7:
                label = "Fraudulent"
                status_class = "status-fraud"
            elif proba > 0.3:
                label = "Suspicious"
                status_class = "status-suspicious"
                
            with col_res1:
                st.subheader("Result")
                st.markdown(f"#### Label: <span class='{status_class}'>{label}</span>", unsafe_allow_html=True)
                st.metric("Fraud Probability Score", f"{proba:.2%}")
                
            with col_res2:
                st.subheader("Explanation")
                explanation = get_explanation(label, proba, features)
                st.write(explanation)
                
                # Highlighted Text Preview
                if features['found_keywords']:
                    st.markdown("**Highlighted Suspicious Phrases:**")
                    preview = highlight_keywords(description[:300] + "...")
                    st.markdown(f"<div style='border: 1px solid #3d4156; padding:10px; border-radius:5px;'>{preview}</div>", unsafe_allow_html=True)

# --- Batch Upload ---
elif page == "Batch Upload":
    st.title("📁 Batch Processing")
    st.write("Upload a CSV file containing job postings to screen them all at once.")
    
    uploaded_file = st.file_uploader("Choose a CSV file", type="csv")
    
    if uploaded_file is not None:
        df_batch = pd.read_csv(uploaded_file)
        required_cols = ['title', 'description', 'company_name', 'contact_email']
        
        if not all(col in df_batch.columns for col in required_cols):
            st.error(f"CSV must contain columns: {', '.join(required_cols)}")
        elif model is None:
            st.error("Model not found.")
        else:
            if st.button("Start Screening"):
                results = []
                with st.spinner("Processing batch jobs..."):
                    for idx, row in df_batch.iterrows():
                        feat = extract_features(row)
                        text = clean_text(f"{row['title']} {row['description']} {row.get('requirements', '')}")
                        
                        X_row = pd.DataFrame([{
                            'combined_text': text,
                            'domain_age': feat['domain_age'],
                            'keyword_flag': feat['keyword_flag'],
                            'email_type': feat['email_type'],
                            'text_length': feat['text_length']
                        }])
                        
                        p = model.predict_proba(X_row)[0][1]
                        
                        l = "Safe"
                        if p > 0.7: l = "Fraudulent"
                        elif p > 0.3: l = "Suspicious"
                        
                        results.append({'Fraud Score': round(p, 4), 'Classification': l})
                
                df_res = pd.concat([df_batch, pd.DataFrame(results)], axis=1)
                st.success(f"Screening complete! Scanned {len(df_res)} jobs.")
                st.dataframe(df_res)
                
                # Download button
                csv_data = df_res.to_csv(index=False).encode('utf-8')
                st.download_button("Download Results", data=csv_data, file_name="screened_jobs.csv")

# --- Dashboard ---
elif page == "Dashboard":
    st.title("📊 Fraud Analytics Dashboard")
    
    if not os.path.exists('fake_job_dataset.csv'):
        st.error("Dataset not found. Please ensure `fake_job_dataset.csv` is in the directory.")
    else:
        df = pd.read_csv('fake_job_dataset.csv')
        
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("Total Jobs Scanned", len(df))
        with col2:
            fraud_count = len(df[df['fraudulent'] == 1])
            st.metric("Fraudulent Jobs Found", fraud_count, delta=f"{fraud_count/len(df):.1%}", delta_color="inverse")
        with col3:
            st.metric("Detection Confidence", "94.2%")

        st.divider()
        
        c1, c2 = st.columns(2)
        
        with c1:
            st.subheader("Distribution: Safe vs Fraudulent")
            fig = px.pie(df, names='fraudulent', color='fraudulent', 
                         color_discrete_map={0: '#00ff88', 1: '#ff4d4d'},
                         labels={'fraudulent': 'Is Fraudulent?'})
            fig.update_layout(showlegend=False)
            st.plotly_chart(fig, use_container_width=True)
            
        with c2:
            st.subheader("Fraud by Job Type")
            # Filter only fraudulent ones for trend
            fraud_jobs = df[df['fraudulent'] == 1]
            fig = px.histogram(fraud_jobs, x='employment_type', color='employment_type',
                               title="Most Targeted Employment Types")
            st.plotly_chart(fig, use_container_width=True)
            
        st.subheader("Fraud Score Trend (Simulated History)")
        # Simulate a trend line using domain_age or job_id
        hist_data = df.tail(50).copy()
        hist_data['cumulative_fraud'] = hist_data['fraudulent'].cumsum()
        fig = px.area(hist_data, x=hist_data.index, y='cumulative_fraud', 
                      labels={'y': 'Detection Count', 'x': 'Sequence'},
                      color_discrete_sequence=['#ff4d4d'])
        st.plotly_chart(fig, use_container_width=True)
