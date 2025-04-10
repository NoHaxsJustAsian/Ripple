from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from config import Config
import os

def create_app():
    # Initialize Flask with static folder configuration
    app = Flask(__name__, static_folder='../client/dist', static_url_path='')
    
    # Configure CORS for API routes only
    CORS(app, resources={
        r"/api/*": {
            "origins": [Config.HOSTNAME],
            "supports_credentials": True
        }
    })
    
    # Serve React frontend - Updated to use static_folder
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve(path):
        if path and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        return send_from_directory(app.static_folder, 'index.html')
    
    # Register API blueprint
    from .api import bp
    app.register_blueprint(bp, url_prefix='/api')
    
    # Error handlers
    @app.errorhandler(404)
    def not_found(e):
        if request.path.startswith('/api/'):
            return jsonify({"error": "API endpoint not found"}), 404
        return send_from_directory(app.static_folder, 'index.html')
    
    # Debug route listing
    @app.before_first_request
    def show_routes():
        print("Registered routes:")
        for rule in app.url_map.iter_rules():
            print(f"{rule.endpoint}: {rule}")
        print(f"Serving static files from: {app.static_folder}")
    
    return app

app = create_app()

if __name__ == "__main__":
    # Validate client/dist exists
    if not os.path.exists('../client/dist'):
        print("ERROR: React build not found. Please run 'npm run build' in client/ first!")
    else:
        app.run(host='127.0.0.1', port=5000, debug=True)