from mongoengine import connect
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://Kevin:Year2006@users.s5a3uxi.mongodb.net/?appName=Users")
SECRET_KEY = os.getenv("SECRET_KEY", "supersecret123")
DB_NAME = os.getenv("DB_NAME", "test")

# Legacy global email credentials (kept for backward compat / admin fallback)
EMAIL_USER = os.getenv("EMAIL_USER", "")
EMAIL_PASS = os.getenv("EMAIL_PASS", "")


def init_db():
    connect(
        db=os.getenv("DB_NAME"),
        host=os.getenv("MONGO_URI")
    )
    print("MongoDB connected")