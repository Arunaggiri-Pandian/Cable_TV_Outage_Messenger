# KGM Cables Notification System

The KGM Cables Notification System is a simple, local web application designed for the owner of the KGM Cables television network. It provides a user-friendly interface to send bulk notifications to customers during a service outage.

## Features

*   **Area-Based Targeting:** Allows the user to select a specific geographical area to send notifications to.
*   **Multi-Channel Messaging:** Enables the user to choose between sending notifications via SMS or WhatsApp.
*   **Templated Messages:** Uses pre-approved message templates for reliability with providers like MSG91.
*   **Secure Access:** The application is protected by a password with a timed session for security.
*   **Light & Dark Mode:** Includes a theme toggle for user comfort.

## Technology Stack

![Python](https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54)
*   The core backend language for the application.

![Flask](https://img.shields.io/badge/flask-%23000.svg?style=for-the-badge&logo=flask&logoColor=white)
*   A lightweight micro web framework used to build the application's routes and logic.

![Gunicorn](https://img.shields.io/badge/gunicorn-%23499848.svg?style=for-the-badge&logo=gunicorn&logoColor=white)
*   The production-grade WSGI server used to run the application reliably.

![WhiteNoise](https://img.shields.io/badge/whitenoise-FFFFFF?style=for-the-badge&logo=python&logoColor=black)
*   Handles the serving of static files (`.css`, `.js`) efficiently in a production environment.

![HTML5](https://img.shields.io/badge/html5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/css3-%231572B6.svg?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)
*   Standard frontend technologies for the user interface.

![MSG91](https://img.shields.io/badge/MSG91-Integration-blue?style=for-the-badge)
*   The primary messaging API used for sending templated WhatsApp messages.

## Setup and Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Arunaggiri-Pandian/Cable_TV_Outage_Messenger.git
    cd Cable_TV_Outage_Messenger
    ```

2.  **Create and activate a virtual environment:**
    ```bash
    python -m venv .venv
    source .venv/bin/activate
    ```

3.  **Install the dependencies:**
    ```bash
    pip install uv
    uv pip sync
    ```

4.  **Create a `.env` file:**
    Copy the contents of `.env.example` into a new file named `.env` and fill in your credentials.

## Security

The application is protected by a password to prevent unauthorized access. This feature is controlled by environment variables in your `.env` file.

*   `PASSWORD_PROTECT=true`: Set to `true` to enable the login screen. If set to `false`, the application will be publicly accessible.
*   `APP_PASSWORD=your_secret_password`: The password required to log in.
*   `SECRET_KEY=a_long_random_string`: A long, random string used to sign the user's session cookie. This should be kept secret.

## Running the Application

There are two ways to run the application, depending on your needs.

### For Development

This method uses the Flask development server, which provides an interactive debugger and automatically reloads when you change the code. It is perfect for local development and testing.

```bash
python run.py
```
The application will be available at `http://127.0.0.1:8501`.

### For Production (Local Simulation)

This method uses **Gunicorn**, the same production-grade server that will be used for deployment. It is the best way to test the application in a production-like environment.

```bash
gunicorn --bind 0.0.0.0:8501 --reload "app:create_app()"
```
The `--reload` flag tells Gunicorn to watch for file changes, similar to the development server.

## Deployment

The application is configured for easy deployment on cloud platforms like **Render**.

*   **`Procfile`**: This file tells the hosting service how to run the app using the command `gunicorn "app:create_app()"`.
*   **Gunicorn**: A robust WSGI server that runs the Python application efficiently and reliably.
*   **WhiteNoise**: A library that enables the application to serve its own static files (`.css`, `.js`) in a production environment, a task Gunicorn does not handle on its own.

---

<div align="center">
  
**Author: Arunaggiri Pandian Karunanidhi**

</div>
