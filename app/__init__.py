import os
from flask import Flask
from pathlib import Path

def create_app() -> Flask:
    root = Path(__file__).resolve().parents[1]
    app = Flask(
        __name__,
        static_folder=str(root / "angular-app/dist/angular-app/browser"),
        static_url_path='/',
    )

    # Ensure logs dir exists
    (root / "logs").mkdir(exist_ok=True)

    # Register routes
    with app.app_context():
        from .routes import bp
        app.register_blueprint(bp)

    return app
