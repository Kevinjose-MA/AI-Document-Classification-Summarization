from mongoengine import Document, StringField, DateTimeField, ListField, DictField, BooleanField
from datetime import datetime

# ------------------------------
# User Model
# ------------------------------
class UserModel(Document):
    email = StringField(required=True, unique=True)
    password = StringField(required=True)  # hashed password
    name = StringField()
    created_at = DateTimeField(default=datetime.utcnow)
    is_active = BooleanField(default=True)

# ------------------------------
# Document Model
# ------------------------------
class DocumentModel(Document):
    user_id = StringField(required=True)
    filename = StringField(required=True)
    purpose = StringField()
    received_at = DateTimeField()
    clauses = ListField(DictField())  # existing
    status = StringField(default="processing")

    # 🔹 Add this
    summary = StringField()