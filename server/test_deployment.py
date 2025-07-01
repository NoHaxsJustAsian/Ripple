#!/usr/bin/env python3
"""
Deployment testing script for Ripple NLP API
Run this before deploying to Render to catch issues early
"""

import requests
import json
import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_local_server(base_url="http://localhost:5000"):
    """Test all endpoints on local server"""
    print(f"🧪 Testing server at {base_url}")
    print("=" * 50)
    
    # Test basic connectivity
    try:
        response = requests.get(f"{base_url}/api/ping", timeout=10)
        if response.status_code == 200:
            print("✅ Ping endpoint works")
        else:
            print(f"❌ Ping failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Cannot connect to server: {e}")
        return False
    
    # Test health check
    try:
        response = requests.get(f"{base_url}/api/health", timeout=10)
        if response.status_code == 200:
            health_data = response.json()
            print(f"✅ Health check passed")
            print(f"   Status: {health_data.get('status', 'unknown')}")
            print(f"   Azure OpenAI: {health_data.get('azure_openai', 'unknown')}")
        else:
            print(f"❌ Health check failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Health check error: {e}")
    
    # Test analyze-context endpoint
    try:
        test_data = {
            "content": "This is a test sentence for analysis.",
            "fullContext": "This is a test sentence for analysis. It should be analyzed for clarity and flow.",
            "type": "paragraph",
            "targetType": "clarity"
        }
        
        response = requests.post(
            f"{base_url}/api/analyze-context",
            json=test_data,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Analysis endpoint works")
            if result.get('success'):
                comments = result.get('data', {}).get('comments', [])
                print(f"   Generated {len(comments)} comments")
            else:
                print(f"   Warning: Analysis returned success=false")
        else:
            print(f"❌ Analysis failed: {response.status_code}")
            try:
                error_data = response.json()
                print(f"   Error: {error_data.get('error', 'Unknown error')}")
            except:
                print(f"   Raw response: {response.text[:200]}")
                
    except Exception as e:
        print(f"❌ Analysis endpoint error: {e}")
    
    # Test custom prompt endpoint
    try:
        test_data = {
            "selectedText": "The quick brown fox jumps over the lazy dog.",
            "prompt": "Make this more engaging",
            "fullContext": "This is a sample document with the sentence: The quick brown fox jumps over the lazy dog."
        }
        
        response = requests.post(
            f"{base_url}/api/custom-prompt",
            json=test_data,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Custom prompt endpoint works")
            if result.get('success'):
                print(f"   Generated suggestion")
            else:
                print(f"   Warning: Custom prompt returned success=false")
        else:
            print(f"❌ Custom prompt failed: {response.status_code}")
                
    except Exception as e:
        print(f"❌ Custom prompt endpoint error: {e}")
    
    print("\n🎯 Local testing complete!")
    return True

def test_environment_variables():
    """Check that all required environment variables are set"""
    print("🔍 Checking environment variables...")
    print("=" * 50)
    
    required_vars = [
        'AZURE_OPENAI_KEY',
        'AZURE_OPENAI_ENDPOINT'
    ]
    
    all_good = True
    for var in required_vars:
        value = os.getenv(var)
        if value:
            print(f"✅ {var}: {'*' * min(len(value), 20)}... (set)")
        else:
            print(f"❌ {var}: Not set")
            all_good = False
    
    # Optional variables
    optional_vars = [
        'FLASK_ENV',
        'HOSTNAME',
        'RENDER_EXTERNAL_URL'
    ]
    
    print("\nOptional variables:")
    for var in optional_vars:
        value = os.getenv(var)
        if value:
            print(f"✅ {var}: {value}")
        else:
            print(f"⚠️  {var}: Not set (optional)")
    
    return all_good

def test_render_deployment(render_url):
    """Test deployed Render service"""
    print(f"🌐 Testing Render deployment at {render_url}")
    print("=" * 50)
    
    return test_local_server(render_url)

def main():
    print("🚀 RIPPLE NLP API DEPLOYMENT TESTING")
    print("=" * 60)
    
    # Check environment variables
    if not test_environment_variables():
        print("\n❌ Environment variable check failed!")
        print("Please set the required environment variables before testing.")
        sys.exit(1)
    
    print("\n" + "=" * 60)
    
    # Test local server if requested
    if len(sys.argv) > 1:
        if sys.argv[1] == "local":
            print("Testing local server...")
            test_local_server()
        elif sys.argv[1].startswith("http"):
            print("Testing remote server...")
            test_render_deployment(sys.argv[1])
        else:
            print("Usage: python test_deployment.py [local|<url>]")
    else:
        print("Usage:")
        print("  python test_deployment.py local           # Test local server")
        print("  python test_deployment.py <render-url>    # Test Render deployment")
        print("\nExample:")
        print("  python test_deployment.py https://your-app.onrender.com")

if __name__ == "__main__":
    main() 