from dotenv import load_dotenv
# Main entry point for the KGM Cables Flask application.
from app import create_app

# Note: The app is created and run in this file.
# Any changes here will trigger the Flask auto-reloader.

if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=8501, debug=True)

