from dotenv import load_dotenv
from app import create_app
import os

if __name__ == "__main__":
    load_dotenv()  # load .env at startup
    app = create_app()
    port = int(os.getenv("PORT", "5001"))
    # app.run(host="127.0.0.1", port=port, debug=True)
    app.run(host='0.0.0.0', port=8501, debug=True)
