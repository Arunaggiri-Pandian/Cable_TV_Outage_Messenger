import os
from flask import Flask
from dotenv import load_dotenv
from datetime import timedelta

load_dotenv()

def create_app():
    app = Flask(__name__, template_folder='../templates', static_folder='../static')
    # Use a stable secret key from the environment for session persistence
    app.secret_key = os.environ.get('SECRET_KEY')
    
    # Set session lifetime for testing
    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(seconds=5)
    print(f" * Session lifetime set to: {app.config['PERMANENT_SESSION_LIFETIME']}")

    from . import routes
    app.register_blueprint(routes.bp)

    return app
