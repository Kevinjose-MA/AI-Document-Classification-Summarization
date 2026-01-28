from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from passlib.context import CryptContext
import jwt
from datetime import datetime, timedelta

from app.models.models import UserModel
from app.core.config import SECRET_KEY


router = APIRouter()

# ----------------------
# Password Context (FIX)
# ----------------------
pwd_context = CryptContext(
    schemes=["bcrypt_sha256"],
    deprecated="auto"
)

# ----------------------
# Schemas
# ----------------------
class RegisterSchema(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)
    name: str


class LoginSchema(BaseModel):
    email: str
    password: str


# ----------------------
# Password Helpers
# ----------------------
def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(password, hashed)


# ----------------------
# JWT Helper
# ----------------------
def create_token(user_id: str) -> str:
    payload = {
        "user_id": str(user_id),
        "exp": datetime.utcnow() + timedelta(days=1),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


# ----------------------
# Routes
# ----------------------
@router.post("/auth/register")
def register(data: RegisterSchema):
    if UserModel.objects(email=data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = UserModel(
        email=data.email,
        password=hash_password(data.password),
        name=data.name,
    )
    user.save()

    return {
        "token": create_token(user.id),
        "user": {"email": user.email, "name": user.name},
    }


@router.post("/auth/login")
def login(data: LoginSchema):
    user = UserModel.objects(email=data.email).first()

    if not user or not verify_password(data.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {
        "token": create_token(user.id),
        "user": {"email": user.email, "name": user.name},
    }
