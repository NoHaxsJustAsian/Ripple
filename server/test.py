from openai import AzureOpenAI
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Print environment variables (mask the key)
azure_endpoint = os.getenv('AZURE_OPENAI_ENDPOINT')
azure_key = os.getenv('AZURE_OPENAI_KEY')
deployment = "PROPILOT"  # This is hardcoded in your app.py

print(f"Azure OpenAI Endpoint: {azure_endpoint}")
print(f"Azure OpenAI Key: {'*' * (len(azure_key) - 4) + azure_key[-4:] if azure_key else 'Not found'}")
print(f"Deployment Name: {deployment}")

# Try to initialize the client
try:
    client = AzureOpenAI(
        azure_endpoint=azure_endpoint,
        api_key=azure_key,
        api_version="2024-05-01-preview"
    )
    print("Client initialized successfully")
    
    # List available deployments
    print("\nAttempting to list available deployments...")
    # Note: Not all Azure OpenAI SDKs support listing deployments directly
    # You may need to check the Azure portal for this information
    
    # Try a simple API call
    print("\nTesting with a simple API call...")
    response = client.chat.completions.create(
        model=deployment,
        messages=[{"role": "user", "content": "Hello, are you working?"}],
        max_tokens=100
    )
    print("API call successful!")
    print(f"Response: {response.choices[0].message.content}")
    
except Exception as e:
    print(f"\nError: {str(e)}")
    print("\nPossible issues:")
    print("1. The deployment 'PROPILOT' may not exist or may have been deleted")
    print("2. The deployment name may be incorrect (check case sensitivity)")
    print("3. Your API key may have expired or been rotated")
    print("4. The endpoint URL may be incorrect")
    print("5. Your Azure subscription may have limitations or quota issues")