from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from passlib.context import CryptContext
import jwt
from datetime import datetime, timedelta

from app.models.models import UserModel
from app.core.config import SECRET_KEY

from fastapi import Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials


router = APIRouter()

# ----------------------
# Password Context
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
    role: str = Field(default="user")  # optional, default user


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
def create_token(user_id: str, role: str) -> str:
    payload = {
        "user_id": str(user_id),
        "role": role,  # add role to JWT for RBAC
        "exp": datetime.utcnow() + timedelta(days=1),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

security = HTTPBearer()

def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload.get("user_id")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")



# ----------------------
# Routes
# ----------------------
@router.post("/auth/register")
def register(data: RegisterSchema):
    if UserModel.objects(email=data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Generate username from email (before @)
    username = data.email.split("@")[  0]

    # Ensure username is unique
    suffix = 1
    base_username = username
    while UserModel.objects(username=username).first():
        username = f"{base_username}{suffix}"
        suffix += 1

    user = UserModel(
        email=data.email,
        password=hash_password(data.password),
        name=data.name,
        role=data.role.lower(),
        username=username
    )
    user.save()

    return {
        "token": create_token(user.id, user.role),
        "user": {"email": user.email, "name": user.name, "role": user.role, "username": user.username},
    }



@router.post("/auth/login")
def login(data: LoginSchema):
    user = UserModel.objects(email=data.email).first()

    if not user or not verify_password(data.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {
        "token": create_token(user.id, user.role),
        "user": {"email": user.email, "name": user.name, "role": user.role},
    }
