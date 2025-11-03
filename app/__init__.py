import os
from flask import Flask
from dotenv import load_dotenv
from datetime import timedelta

load_dotenv()

def create_app():
    app = Flask(__name__, template_folder='../templates', static_folder='../static')
    # Generate a new secret key on each startup to invalidate old sessions
    app.secret_key = os.urandom(16)
    
    # Set session lifetime for testing
    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(seconds=10)

    from . import routes
    app.register_blueprint(routes.bp)

    return app
