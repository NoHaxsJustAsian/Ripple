#!/usr/bin/env python3
"""
WSGI entry point for Ripple NLP API
Used by gunicorn and other WSGI servers
"""

import os
import sys

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(__file__))

from app import app

# This is what gunicorn will import
application = app

if __name__ == "__main__":
    # For local testing - use PORT environment variable if available
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False) 