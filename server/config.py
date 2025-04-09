from dotenv import load_dotenv
import os

load_dotenv()

class Config:
    HOSTNAME = os.getenv('HOSTNAME')
    AZURE_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
    AZURE_KEY = os.getenv("AZURE_OPENAI_KEY")
    AZURE_DEPLOYMENT = "PROPILOT"
    API_VERSION = "2024-05-01-preview"