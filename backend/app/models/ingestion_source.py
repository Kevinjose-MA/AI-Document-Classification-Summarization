# backend/models/ingestion_source.py


from mongoengine import (
    Document, StringField, DateTimeField,
    EnumField, BooleanField
)
from datetime import datetime, timezone
from enum import Enum


class SourceType(str, Enum):
    EMAIL      = "email"
    MAXIMO     = "maximo"       # CSV / Excel / PDF export
    SHAREPOINT = "sharepoint"   # folder sync (design-level, no OAuth yet)
    WHATSAPP   = "whatsapp"     # manual PDF upload simulation
    SCAN       = "scan"         # hard-copy OCR upload
    CLOUD_LINK = "cloud_link"   # user pastes a URL


class SourceStatus(str, Enum):
    CONNECTED  = "connected"
    SYNCING    = "syncing"
    ERROR      = "error"
    PENDING    = "pending"      # configured but never synced
    DISABLED   = "disabled"


class IngestionSourceModel(Document):
    """
    One record per configured ingestion channel.
    Created by admin or dept user; enforced by RBAC on reads.
    """
    meta = {"collection": "ingestion_sources", "indexes": ["department", "created_by"]}

    # ── Core ──────────────────────────────────────
    type          = StringField(required=True)          # SourceType value
    label         = StringField(required=True)          # Human-readable name, e.g. "Finance Email"
    department    = StringField(required=True)          # engineering / finance / hr / legal / …
    status        = StringField(default=SourceStatus.PENDING)

    # ── Connection config (non-sensitive) ─────────
    config_hint   = StringField(default="")            # e.g. email address, SharePoint URL, Maximo URL
                                                        # NOT credentials — those live in env/secrets

    # ── Sync tracking ─────────────────────────────
    last_sync     = DateTimeField(default=None)
    last_doc_count = StringField(default="0")           # docs ingested in last sync, stored as str for flexibility
    error_message = StringField(default="")

    # ── Audit ─────────────────────────────────────
    created_by    = StringField(required=True)          # user_id of creator
    created_at    = DateTimeField(default=lambda: datetime.now(timezone.utc))
    updated_at    = DateTimeField(default=lambda: datetime.now(timezone.utc))

    # ── Capabilities ──────────────────────────────
    supports_auto_sync = BooleanField(default=False)    # True for email/SharePoint once configured
    is_manual          = BooleanField(default=True)     # True = upload-only, no scheduled sync

    def to_dict(self):
        return {
            "id":                str(self.pk),
            "type":              self.type,
            "label":             self.label,
            "department":        self.department,
            "status":            self.status,
            "config_hint":       self.config_hint,
            "last_sync":         self.last_sync.isoformat() if self.last_sync else None,
            "last_doc_count":    self.last_doc_count,
            "error_message":     self.error_message,
            "created_by":        self.created_by,
            "created_at":        self.created_at.isoformat(),
            "updated_at":        self.updated_at.isoformat(),
            "supports_auto_sync": self.supports_auto_sync,
            "is_manual":         self.is_manual,
        }