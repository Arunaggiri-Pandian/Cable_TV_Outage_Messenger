import os
from flask import Flask
from dotenv import load_dotenv
from datetime import timedelta
from whitenoise import WhiteNoise

load_dotenv()

def create_app():
    app = Flask(__name__, template_folder='../templates', static_folder='../static')
    
    # Add WhiteNoise middleware to serve static files in production
    # The static folder is automatically detected
    app.wsgi_app = WhiteNoise(app.wsgi_app, root='static/')

    # Use a stable secret key from the environment for session persistence
    app.secret_key = os.environ.get('SECRET_KEY')
    
    # Set session lifetime for testing
    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(seconds=10)

    from . import routes
    app.register_blueprint(routes.bp)

    return app
