# Ripple NLP API - Render Deployment Guide

## 🚨 Problem Analysis

Based on your logs, the main issues are:

1. **CORS Configuration**: Your app doesn't know what origins to allow in production
2. **Health Check Failures**: Render keeps restarting because health checks are timing out
3. **Missing Environment Variables**: Critical Azure OpenAI credentials may not be set
4. **App Configuration**: App was binding to localhost instead of 0.0.0.0

## ✅ Solutions Implemented

### 1. Fixed CORS Configuration
- Updated to support both development and production origins
- Automatically detects Render URL from `RENDER_EXTERNAL_URL` environment variable
- Added comprehensive logging for debugging

### 2. Enhanced Health Check
- `/api/health` now provides detailed configuration info
- `/api/debug/info` endpoint for troubleshooting
- Better error handling and logging

### 3. Proper WSGI Configuration
- Created `wsgi.py` for gunicorn
- Fixed app binding to `0.0.0.0` instead of localhost
- Added proper production configuration

### 4. Render Configuration
- Created `render.yaml` with optimal gunicorn settings
- Specified health check endpoint
- Set proper environment variables

## 🚀 Deployment Steps

### Step 1: Set Environment Variables in Render

Go to your Render service settings and set these environment variables:

```bash
# Required Azure OpenAI Configuration
AZURE_OPENAI_KEY=your_azure_openai_key_here
AZURE_OPENAI_ENDPOINT=your_azure_endpoint_here

# Optional Frontend URL (for CORS)
HOSTNAME=https://your-frontend-domain.com

# Production Settings
FLASK_ENV=production
PYTHONUNBUFFERED=1
```

### Step 2: Update Build Command

In Render, set your build command to:
```bash
pip install -r requirements.txt
```

### Step 3: Update Start Command

In Render, set your start command to:
```bash
gunicorn --bind 0.0.0.0:$PORT --workers 2 --timeout 60 --keep-alive 2 --max-requests 1000 wsgi:application
```

### Step 4: Set Health Check Path

In Render service settings:
- Health Check Path: `/api/health`

## 🔍 Testing Your Deployment

### Test 1: Basic Health Check
```bash
curl https://your-render-url.com/api/health
```

Expected response:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2025-06-30T14:30:00.000Z",
  "config": {
    "cors_origins": 3,
    "azure_openai": "configured",
    "environment": "production",
    "port": "5000"
  }
}
```

### Test 2: Debug Information
```bash
curl https://your-render-url.com/api/debug/info
```

### Test 3: Run Local Test Script
```bash
python server/test_deployment.py https://your-render-url.com
```

## 🐛 Troubleshooting

### Issue: "504 Gateway Timeout"
**Cause**: App isn't responding to health checks
**Solution**: 
1. Check that `AZURE_OPENAI_KEY` is set in Render environment variables
2. Verify the start command uses `wsgi:application`
3. Check logs for startup errors

### Issue: "CORS errors in browser"
**Cause**: Frontend URL not allowed
**Solution**:
1. Set `HOSTNAME` environment variable to your frontend URL
2. Ensure it starts with `https://` for production
3. Check `/api/debug/info` to see configured CORS origins

### Issue: "Azure OpenAI errors"
**Cause**: Missing or incorrect API credentials
**Solution**:
1. Verify `AZURE_OPENAI_KEY` and `AZURE_OPENAI_ENDPOINT` are set
2. Test credentials locally first
3. Check Azure OpenAI service is active

### Issue: "Worker timeout" in logs
**Cause**: Requests taking too long to process
**Solution**:
1. Increase worker timeout: `--timeout 120`
2. Add more workers: `--workers 4`
3. Check Azure OpenAI API latency

## 📋 Deployment Checklist

- [ ] Environment variables set in Render
- [ ] Build command updated
- [ ] Start command updated with proper gunicorn config
- [ ] Health check path set to `/api/health`
- [ ] Test health endpoint responds
- [ ] Test debug endpoint shows correct config
- [ ] CORS origins include your frontend domain
- [ ] Azure OpenAI credentials are working

## 🔧 Quick Fix Commands

If deployment is still failing, try these commands in order:

1. **Redeploy with new configuration**:
   - Update start command in Render dashboard
   - Trigger manual deploy

2. **Check logs for specific errors**:
   ```bash
   # Look for these patterns in Render logs:
   # ✅ "🚀 RIPPLE NLP API STARTING UP"
   # ✅ "🌐 CORS allowed origins"
   # ❌ "ERROR: AZURE_OPENAI_KEY not set"
   ```

3. **Test locally first**:
   ```bash
   cd server
   gunicorn --bind 0.0.0.0:5000 wsgi:application
   ```

## 📞 Support

If you're still having issues, check:

1. **Render service logs** - Look for the startup messages I added
2. **Environment variables** - Ensure all required vars are set
3. **Health check endpoint** - Test `https://your-url.com/api/health`
4. **Azure OpenAI status** - Verify your API key and endpoint are working

The deployment should now work correctly with these fixes! 