
import os
import base64
from cryptography.fernet import Fernet, InvalidToken

def _get_fernet() -> Fernet:
    key = os.getenv("CREDENTIAL_ENCRYPTION_KEY")
    if not key:
        raise RuntimeError(
            "CREDENTIAL_ENCRYPTION_KEY not set in environment. "
            "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_password(plain_password: str) -> str:
    """Encrypt a plain-text password. Returns base64 Fernet token string."""
    f = _get_fernet()
    return f.encrypt(plain_password.encode()).decode()


def decrypt_password(encrypted_password: str) -> str:
    """Decrypt a Fernet-encrypted password back to plain text."""
    f = _get_fernet()
    try:
        return f.decrypt(encrypted_password.encode()).decode()
    except InvalidToken:
        raise ValueError(
            "Failed to decrypt credential. "
            "The encryption key may have changed or the value is corrupted."
        )


def is_encrypted(value: str) -> bool:
    """
    Heuristic check — Fernet tokens always start with 'gAAAAA'.
    Used during migration to avoid double-encrypting already-encrypted values.
    """
    return value.startswith("gAAAAA")


# ─────────────────────────────────────────────────────────────────────────────
# ── Migration script — run ONCE to encrypt existing plain-text passwords ─────
# ─────────────────────────────────────────────────────────────────────────────
# Run from your backend root:
#   python -m app.core.encryption
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import mongoengine
    from dotenv import load_dotenv
    load_dotenv()

    mongoengine.connect(
        db=os.getenv("DB_NAME", "kmrl_docuflow"),
        host=os.getenv("MONGO_URI"),
    )

    from app.models.models import EmailCredentialModel

    all_creds = EmailCredentialModel.objects()
    migrated = 0
    skipped  = 0

    for cred in all_creds:
        if not cred.email_password:
            skipped += 1
            continue
        if is_encrypted(cred.email_password):
            print(f"  SKIP (already encrypted): {cred.email_address}")
            skipped += 1
            continue
        try:
            cred.email_password = encrypt_password(cred.email_password)
            cred.save()
            print(f"  ENCRYPTED: {cred.email_address}")
            migrated += 1
        except Exception as e:
            print(f"  ERROR for {cred.email_address}: {e}")

    print(f"\nDone. Migrated: {migrated}, Skipped: {skipped}")