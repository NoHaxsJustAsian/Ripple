import requests
import json

url = "http://127.0.0.1:5000/api/segment-texts"  # Update with your actual server URL if different
data = {
    "original": "This is a test.",
    "suggested": "This is a modified test."
}

try:
    response = requests.post(url, json=data)
    print(f"Status code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")