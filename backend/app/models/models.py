from mongoengine import (
    Document,
    StringField,
    DateTimeField,
    ListField,
    DictField,
    BooleanField,
    IntField
)
from datetime import datetime


# ------------------------------
# User Model (RBAC enabled)
# ------------------------------
class UserModel(Document):
    email = StringField(required=True, unique=True)
    password = StringField(required=True)   # hashed
    name = StringField()
    username = StringField(unique=True, required=True)

    role = StringField(
        choices=["admin", "hr", "legal", "engineering", "finance", "user"],
        default="user"
    )

    departments = ListField(StringField(), default=[])
    created_at = DateTimeField(default=datetime.utcnow)
    is_active = BooleanField(default=True)

    meta = {
        "collection": "users",
        "indexes": ["email", "username"]
    }


# ------------------------------
# Per-user Email Credential Model
# Stores each user's connected inbox so email ingestion is truly per-user.
# Passwords are stored as-is here; in production encrypt at rest with Fernet/KMS.
# ------------------------------
class EmailCredentialModel(Document):
    user_id = StringField(required=True, unique=True)   # one inbox per user for now
    imap_host = StringField(required=True, default="imap.gmail.com")
    imap_port = IntField(default=993)
    email_address = StringField(required=True)
    email_password = StringField(required=True)         # app password / OAuth token
    is_active = BooleanField(default=True)
    connected_at = DateTimeField(default=datetime.utcnow)
    last_synced_at = DateTimeField()

    meta = {
        "collection": "email_credentials",
        "indexes": ["user_id"]
    }


# ------------------------------
# Document Model
# ------------------------------
class DocumentModel(Document):
    user_id = StringField(required=True)
    filename = StringField(required=True)
    file_hash = StringField(required=True)
    file_size = IntField()
    content_type = StringField()
    version = IntField(default=1)
    source = StringField(default="manual")      # manual | email
    purpose = StringField()
    received_at = DateTimeField(default=datetime.utcnow)

    storage_path = StringField()
    encrypted_external = BooleanField(default=False)

    summary = DictField()
    department = StringField()
    sensitivity = StringField()
    routing_status = StringField()
    clauses = ListField(DictField())
    status = StringField(default="processing")

    # Legacy fields
    title = StringField()
    url = StringField()
    uploadedBy = StringField()
    uploadedAt = DateTimeField()
    __v = IntField()

    meta = {
        "collection": "documents",
        "indexes": ["user_id", "department", "file_hash"],
        "strict": False
    }