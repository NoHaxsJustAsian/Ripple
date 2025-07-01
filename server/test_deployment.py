#!/usr/bin/env python3
"""
Quick deployment test for Ripple NLP API
Run this to verify the server is working correctly
"""

import requests
import json
import sys

def test_health_endpoint(base_url):
    """Test the health check endpoint"""
    try:
        response = requests.get(f"{base_url}/api/health")
        if response.status_code == 200:
            data = response.json()
            print("✅ Health check passed")
            print(f"   Status: {data.get('status')}")
            print(f"   Version: {data.get('version')}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def test_debug_endpoint(base_url):
    """Test the debug info endpoint"""
    try:
        response = requests.get(f"{base_url}/api/debug/info")
        if response.status_code == 200:
            data = response.json()
            print("✅ Debug info accessible")
            print(f"   Azure Config: {data.get('azure_config', {})}")
            print(f"   CORS Origins: {len(data.get('cors_origins', []))} configured")
            return True
        else:
            print(f"❌ Debug info failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Debug info error: {e}")
        return False

def main():
    """Run basic deployment tests"""
    if len(sys.argv) > 1:
        base_url = sys.argv[1].rstrip('/')
    else:
        base_url = "http://localhost:5000"
    
    print(f"🔍 Testing Ripple NLP API at: {base_url}")
    print("=" * 50)
    
    tests_passed = 0
    total_tests = 2
    
    if test_health_endpoint(base_url):
        tests_passed += 1
    
    if test_debug_endpoint(base_url):
        tests_passed += 1
    
    print("=" * 50)
    print(f"📊 Tests passed: {tests_passed}/{total_tests}")
    
    if tests_passed == total_tests:
        print("🎉 All tests passed! Deployment looks good.")
        return 0
    else:
        print("⚠️ Some tests failed. Check the configuration.")
        return 1

if __name__ == "__main__":
    exit(main()) 