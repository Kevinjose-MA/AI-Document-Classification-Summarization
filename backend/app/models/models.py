from mongoengine import (
    Document,
    StringField,
    DateTimeField,
    ListField,
    DictField,
    BooleanField,
    IntField,
)
from datetime import datetime


class UserModel(Document):
    email      = StringField(required=True, unique=True)
    password   = StringField(required=True)
    name       = StringField()
    username   = StringField(unique=True, required=True)
    role       = StringField(
        choices=["admin", "hr", "legal", "engineering", "finance", "user"],
        default="user"
    )
    departments = ListField(StringField(), default=[])
    created_at  = DateTimeField(default=datetime.utcnow)
    is_active   = BooleanField(default=True)

    meta = {"collection": "users", "indexes": ["email", "username"]}


class EmailCredentialModel(Document):
    user_id       = StringField(required=True, unique=True)
    imap_host     = StringField(required=True, default="imap.gmail.com")
    imap_port     = IntField(default=993)
    email_address = StringField(required=True)
    email_password = StringField(required=True)
    is_active     = BooleanField(default=True)
    connected_at  = DateTimeField(default=datetime.utcnow)
    last_synced_at = DateTimeField()

    meta = {"collection": "email_credentials", "indexes": ["user_id"]}


class DocumentModel(Document):
    user_id    = StringField(required=True)
    filename   = StringField(required=True)
    file_hash  = StringField(required=True)
    file_size  = IntField()
    content_type = StringField()
    version    = IntField(default=1)
    source     = StringField(default="manual")   # manual | email | maximo | scan | whatsapp | cloud_link
    purpose    = StringField()
    received_at = DateTimeField(default=datetime.utcnow)

    # ── Storage ───────────────────────────────────────────────────────────────
    # file_id        → GridFS object ID (new — cloud, works from any machine)
    # storage_path   → local filesystem path (legacy — kept for old documents)
    # public_id      → Cloudinary public ID when using external blob storage
    # file_url       → External URL for preview/download
    # storage_provider → storage backend name: cloudinary | gridfs | local
    # Only one of file_id / file_url / storage_path will be used for new documents.
    file_id          = StringField(default=None)   # GridFS ID
    storage_path     = StringField(default=None)   # legacy local path
    storage_provider = StringField(default="gridfs")
    public_id        = StringField(default=None)
    file_url         = StringField(default=None)

    encrypted_external = BooleanField(default=False)

    summary        = DictField()
    department     = StringField()
    sensitivity    = StringField()
    routing_status = StringField()
    clauses        = ListField(DictField())
    status         = StringField(default="processing")

    # AI enrichment fields
    document_type = StringField(default=None)
    risk_level    = StringField(default=None)
    language      = StringField(default=None)
    confidence    = StringField(default=None)

    # Audit / escalation
    escalated_at  = DateTimeField(default=None)
    reviewed_at   = DateTimeField(default=None)
    reviewed_by   = StringField(default=None)

    # Legacy
    title      = StringField()
    url        = StringField()
    uploadedBy = StringField()
    uploadedAt = DateTimeField()
    __v        = IntField()

    meta = {
        "collection": "documents",
        "indexes": ["user_id", "department", "file_hash", "routing_status", "received_at"],
        "strict": False,
    }


class AuditLogModel(Document):
    """Every agent decision logged here for PS2 auditability requirement."""
    document_id  = StringField(required=True)
    filename     = StringField()
    event        = StringField(required=True)   # ingested | classified | routed | reviewed | escalated | failed | retried
    detail       = StringField()                # human-readable description
    agent        = StringField()                # ocr | classifier | router | escalation | human
    from_status  = StringField()
    to_status    = StringField()
    user_id      = StringField()                # set if a human triggered this
    metadata     = DictField()                  # any extra context (confidence, department, etc.)
    timestamp    = DateTimeField(default=datetime.utcnow)

    meta = {
        "collection": "audit_logs",
        "indexes": ["document_id", "timestamp", "event"],
        "ordering": ["-timestamp"],
    }