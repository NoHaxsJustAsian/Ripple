#!/bin/bash

# Activate virtual environment
source venv/bin/activate

# Install dependencies if needed
pip install -r requirements.txt

# Download spaCy model if needed
python -m spacy download en_core_web_sm

# Run the Flask app
python app.py 