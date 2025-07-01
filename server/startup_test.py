#!/usr/bin/env python3
"""
Startup test for Ripple NLP API
Tests that the server can start without errors
"""

import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_imports():
    """Test that all imports work correctly"""
    print("🔍 Testing imports...")
    
    try:
        # Test Flask imports
        from flask import Flask
        print("✅ Flask imports work")
        
        # Test OpenAI imports
        from openai import AzureOpenAI
        print("✅ OpenAI imports work")
        
        # Test app imports
        import app
        print("✅ App module imports work")
        
        # Test services imports (if using modular structure)
        try:
            import services
            print("✅ Services module imports work")
        except ImportError as e:
            print(f"⚠️  Services module import failed: {e} (this might be OK)")
        
        return True
        
    except ImportError as e:
        print(f"❌ Import failed: {e}")
        return False

def test_environment():
    """Test environment variables"""
    print("\n🔍 Testing environment...")
    
    required_vars = {
        'AZURE_OPENAI_KEY': 'Azure OpenAI API key',
        'AZURE_OPENAI_ENDPOINT': 'Azure OpenAI endpoint URL'
    }
    
    missing = []
    for var, description in required_vars.items():
        if not os.getenv(var):
            missing.append(f"{var} ({description})")
            print(f"❌ Missing: {var}")
        else:
            print(f"✅ Found: {var}")
    
    if missing:
        print(f"\n❌ Missing environment variables:")
        for var in missing:
            print(f"   - {var}")
        return False
    
    return True

def test_azure_client():
    """Test Azure OpenAI client initialization"""
    print("\n🔍 Testing Azure OpenAI client...")
    
    try:
        from openai import AzureOpenAI
        
        client = AzureOpenAI(
            azure_endpoint=os.getenv('AZURE_OPENAI_ENDPOINT'),
            api_key=os.getenv('AZURE_OPENAI_KEY'),
            api_version="2024-05-01-preview"
        )
        
        print("✅ Azure OpenAI client created successfully")
        return True
        
    except Exception as e:
        print(f"❌ Azure OpenAI client failed: {e}")
        return False

def test_app_creation():
    """Test Flask app creation"""
    print("\n🔍 Testing Flask app creation...")
    
    try:
        # Import the app
        from app import app
        
        # Test basic app properties
        if app.name:
            print(f"✅ App created with name: {app.name}")
        else:
            print("⚠️  App name not set")
        
        # Test that routes are registered
        rules = list(app.url_map.iter_rules())
        print(f"✅ App has {len(rules)} routes registered")
        
        # List some key routes
        key_routes = ['/api/health', '/api/ping', '/api/analyze-context']
        found_routes = []
        for rule in rules:
            if str(rule.rule) in key_routes:
                found_routes.append(str(rule.rule))
        
        print(f"✅ Found key routes: {found_routes}")
        
        if len(found_routes) >= 2:
            print("✅ App appears to be properly configured")
            return True
        else:
            print("⚠️  Some key routes missing")
            return False
            
    except Exception as e:
        print(f"❌ App creation failed: {e}")
        return False

def test_wsgi():
    """Test WSGI application"""
    print("\n🔍 Testing WSGI application...")
    
    try:
        from wsgi import application
        
        if application:
            print("✅ WSGI application imported successfully")
            print(f"✅ Application type: {type(application)}")
            return True
        else:
            print("❌ WSGI application is None")
            return False
            
    except Exception as e:
        print(f"❌ WSGI import failed: {e}")
        return False

def main():
    """Run all startup tests"""
    print("🚀 RIPPLE NLP API STARTUP TESTING")
    print("=" * 50)
    
    tests = [
        ("Import Test", test_imports),
        ("Environment Test", test_environment),
        ("Azure Client Test", test_azure_client),
        ("App Creation Test", test_app_creation),
        ("WSGI Test", test_wsgi),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n{'='*20} {test_name} {'='*20}")
        try:
            if test_func():
                passed += 1
                print(f"✅ {test_name} PASSED")
            else:
                print(f"❌ {test_name} FAILED")
        except Exception as e:
            print(f"❌ {test_name} ERROR: {e}")
    
    print("\n" + "=" * 50)
    print(f"📊 RESULTS: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All startup tests passed! Ready for deployment.")
        return 0
    else:
        print("⚠️  Some tests failed. Fix issues before deploying.")
        return 1

if __name__ == "__main__":
    sys.exit(main()) 