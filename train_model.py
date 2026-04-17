import pandas as pd
import joblib
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler
from utils import clean_text

def train():
    print("Loading dataset...")
    df = pd.read_csv('fake_job_dataset.csv')
    
    # Fill missing values
    df = df.fillna('')
    
    # Combine text columns for TF-IDF
    df['combined_text'] = (df['title'] + " " + df['description'] + " " + df['requirements']).apply(clean_text)
    
    # Features and Target
    X = df[['combined_text', 'domain_age', 'keyword_flag', 'email_type', 'text_length']]
    y = df['fraudulent']
    
    # Preprocessing for text and numeric data
    preprocessor = ColumnTransformer(
        transformers=[
            ('text', TfidfVectorizer(max_features=1000), 'combined_text'),
            ('num', StandardScaler(), ['domain_age', 'keyword_flag', 'email_type', 'text_length'])
        ]
    )
    
    # Create the pipeline
    model = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('classifier', LogisticRegression(random_state=42))
    ])
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print("Training model...")
    model.fit(X_train, y_train)
    
    # Evaluate
    score = model.score(X_test, y_test)
    print(f"Model accuracy: {score:.2f}")
    
    # Save the model
    joblib.dump(model, 'model.joblib')
    print("Model saved as model.joblib")

if __name__ == "__main__":
    train()
