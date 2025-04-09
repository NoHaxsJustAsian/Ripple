# server/__init__.py
from flask import Blueprint

# Create the Blueprint instance
bp = Blueprint('api', __name__, url_prefix='/api')

# Import routes AFTER creating bp to avoid circular imports
from . import api