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
    password = StringField(required=True)  # hashed password
    name = StringField()

    # Add username for future use
    username = StringField(unique=True, required=True)

    # 🔐 Role-Based Access Control
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
# Document Model
# ------------------------------
class DocumentModel(Document):
    # ------------------------------
    # Core fields
    # ------------------------------
    user_id = StringField(required=True)          # maps to uploadedBy in old data
    filename = StringField(required=True)
    file_hash = StringField(required=True)        # for deduplication
    file_size = IntField()                        # size in bytes (was StringField)
    content_type = StringField()                  # MIME type
    version = IntField(default=1)                 # numeric version (was StringField)
    source = StringField(default="manual")       # manual / email / whatsapp etc
    purpose = StringField()
    received_at = DateTimeField(default=datetime.utcnow)

    # ------------------------------
    # Storage / encryption (NEW)
    # ------------------------------
    storage_path = StringField()                  # physical file path
    encrypted_external = BooleanField(default=False)

    # ------------------------------
    # New metadata fields
    # ------------------------------
    summary = StringField()
    department = StringField()                    # HR / Legal / Finance / etc
    sensitivity = StringField()                   # low / medium / high
    routing_status = StringField()                # routed / restricted / pending
    clauses = ListField(DictField())
    status = StringField(default="processing")

    # ------------------------------
    # Legacy fields (from existing DB)
    # ------------------------------
    title = StringField()
    url = StringField()
    uploadedBy = StringField()
    uploadedAt = DateTimeField()
    __v = IntField()

    meta = {
        "collection": "documents",
        "indexes": ["user_id", "department", "file_hash"],
        "strict": False  # allows unknown fields, just in case
    }
