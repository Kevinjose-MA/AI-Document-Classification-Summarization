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

class UpdateUserSchema(BaseModel):
    role:      str | None = None
    is_active: bool | None = None


# ── Add this dependency (improved version of get_current_user_id) ──
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Returns full payload dict: user_id, role, exp"""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def require_admin(user: dict = Depends(get_current_user)):
    if user.get("role", "").lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ── Add these 3 routes at the bottom of auth.py ───────────────

@router.get("/auth/users")
def list_users(admin=Depends(require_admin)):
    """Admin only — list all users"""
    users = UserModel.objects().order_by("-created_at")
    return [
        {
            "id":         str(u.id),
            "name":       u.name,
            "username":   u.username,
            "email":      u.email,
            "role":       u.role,
            "is_active":  u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


@router.patch("/auth/users/{user_id}")
def update_user(user_id: str, data: UpdateUserSchema, admin=Depends(require_admin)):
    """Admin only — update role and/or active status"""
    user = UserModel.objects(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    VALID_ROLES = ["admin", "hr", "legal", "engineering", "finance", "operations", "compliance", "user"]

    if data.role is not None:
        if data.role.lower() not in VALID_ROLES:
            raise HTTPException(status_code=400, detail=f"Invalid role. Choose from: {VALID_ROLES}")
        user.role = data.role.lower()

    if data.is_active is not None:
        user.is_active = data.is_active

    user.save()
    return {
        "id":        str(user.id),
        "name":      user.name,
        "email":     user.email,
        "role":      user.role,
        "is_active": user.is_active,
    }


@router.delete("/auth/users/{user_id}")
def delete_user(user_id: str, admin=Depends(require_admin)):
    """Admin only — delete a user"""
    user = UserModel.objects(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.delete()
    return {"message": "User deleted"}


    # ── Add these to app/api/auth.py ─────────────────────────────
# These two endpoints handle saving and retrieving email credentials.
# The password is stored as-is here. In production, encrypt with Fernet.

from app.models.models import EmailCredentialModel  # already in your models.py

class EmailCredentialSchema(BaseModel):
    imap_host:      str  = "imap.gmail.com"
    imap_port:      int  = 993
    email_address:  str
    email_password: str  # app password / oauth token


@router.post("/auth/email-credentials")
def save_email_credentials(
    data: EmailCredentialSchema,
    user: dict = Depends(get_current_user),
):
    """Save or update IMAP credentials for the current user."""
    user_id = str(user["user_id"])

    # Upsert — one inbox per user
    cred = EmailCredentialModel.objects(user_id=user_id).first()
    if cred:
        cred.imap_host      = data.imap_host
        cred.imap_port      = data.imap_port
        cred.email_address  = data.email_address
        cred.email_password = data.email_password
        cred.is_active      = True
    else:
        cred = EmailCredentialModel(
            user_id        = user_id,
            imap_host      = data.imap_host,
            imap_port      = data.imap_port,
            email_address  = data.email_address,
            email_password = data.email_password,
            is_active      = True,
        )
    cred.save()
    return {
        "message":       "Credentials saved",
        "email_address": cred.email_address,
        "imap_host":     cred.imap_host,
        "imap_port":     cred.imap_port,
    }


@router.get("/auth/email-credentials")
def get_email_credentials(user: dict = Depends(get_current_user)):
    """Get current user's email credentials (password never returned)."""
    user_id = str(user["user_id"])
    cred = EmailCredentialModel.objects(user_id=user_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail="No email credentials configured")
    return {
        "email_address": cred.email_address,
        "imap_host":     cred.imap_host,
        "imap_port":     cred.imap_port,
        "is_active":     cred.is_active,
        "last_synced_at": cred.last_synced_at.isoformat() if cred.last_synced_at else None,
    }