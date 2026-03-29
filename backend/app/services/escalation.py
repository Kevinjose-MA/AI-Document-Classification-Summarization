# app/services/escalation.py
# ─────────────────────────────────────────────────────────────────────────────
# Auto-escalation job — runs on a schedule via APScheduler.
# Documents stuck in "review" beyond the SLA threshold are escalated.
#
# Install: pip install apscheduler
#
# SLA thresholds (configurable via env):
#   HIGH sensitivity   → escalate after 2 hours
#   MEDIUM sensitivity → escalate after 24 hours
#   LOW sensitivity    → escalate after 72 hours
# ─────────────────────────────────────────────────────────────────────────────

import os
import logging
from datetime import datetime, timezone, timedelta
from app.models.models import DocumentModel, AuditLogModel

logger = logging.getLogger("ESCALATION")

# SLA thresholds — override via .env
SLA_HOURS = {
    "high":   int(os.getenv("SLA_HOURS_HIGH",   "2")),
    "medium": int(os.getenv("SLA_HOURS_MEDIUM", "24")),
    "low":    int(os.getenv("SLA_HOURS_LOW",    "72")),
}


def _write_audit(doc, hours_overdue: float):
    """Write escalation event to audit log."""
    try:
        AuditLogModel(
            document_id = str(doc.id),
            filename    = doc.filename,
            event       = "escalated",
            detail      = (
                f"Document auto-escalated after {hours_overdue:.1f}h in review. "
                f"SLA threshold for '{doc.sensitivity}' sensitivity: "
                f"{SLA_HOURS.get(doc.sensitivity or 'medium', 24)}h."
            ),
            agent       = "escalation-agent",
            from_status = "review",
            to_status   = "escalated",
            metadata    = {
                "sensitivity":   doc.sensitivity,
                "department":    doc.department,
                "hours_overdue": round(hours_overdue, 2),
                "sla_threshold": SLA_HOURS.get(doc.sensitivity or "medium", 24),
                "source":        doc.source,
            },
        ).save()
    except Exception as e:
        logger.warning(f"[ESCALATION] Failed to write audit log for {doc.id}: {e}")


def run_escalation_check():
    """
    Main escalation job — called by APScheduler every 30 minutes.
    Finds all documents in 'review' status past their SLA threshold
    and escalates them to 'escalated' status.
    """
    now = datetime.now(timezone.utc)
    escalated_count = 0

    try:
        # Only check documents currently in review
        review_docs = DocumentModel.objects(
            routing_status="review",
            escalated_at=None,   # not already escalated
        )

        for doc in review_docs:
            if not doc.received_at:
                continue

            # Normalise received_at to UTC
            received = doc.received_at
            if received.tzinfo is None:
                received = received.replace(tzinfo=timezone.utc)

            sensitivity    = (doc.sensitivity or "medium").lower()
            sla_hours      = SLA_HOURS.get(sensitivity, 24)
            sla_deadline   = received + timedelta(hours=sla_hours)
            hours_in_review = (now - received).total_seconds() / 3600

            if now > sla_deadline:
                hours_overdue = (now - sla_deadline).total_seconds() / 3600
                try:
                    doc.routing_status = "escalated"
                    doc.escalated_at   = now
                    doc.save()
                    _write_audit(doc, hours_overdue)
                    escalated_count += 1
                    logger.info(
                        f"[ESCALATION] Escalated: {doc.filename} "
                        f"| dept={doc.department} | sensitivity={sensitivity} "
                        f"| overdue={hours_overdue:.1f}h"
                    )
                except Exception as e:
                    logger.error(f"[ESCALATION] Failed to escalate {doc.id}: {e}")

    except Exception as e:
        logger.error(f"[ESCALATION] Job failed: {e}")

    if escalated_count:
        logger.info(f"[ESCALATION] Cycle complete — {escalated_count} document(s) escalated.")
    else:
        logger.debug("[ESCALATION] Cycle complete — no documents to escalate.")

    return escalated_count


def get_escalation_stats() -> dict:
    """Returns current escalation stats for the dashboard."""
    try:
        total_review    = DocumentModel.objects(routing_status="review").count()
        total_escalated = DocumentModel.objects(routing_status="escalated").count()

        # Count documents approaching SLA (within 20% of threshold)
        now = datetime.now(timezone.utc)
        approaching = 0
        for doc in DocumentModel.objects(routing_status="review", escalated_at=None):
            if not doc.received_at:
                continue
            received = doc.received_at
            if received.tzinfo is None:
                received = received.replace(tzinfo=timezone.utc)
            sensitivity  = (doc.sensitivity or "medium").lower()
            sla_hours    = SLA_HOURS.get(sensitivity, 24)
            sla_deadline = received + timedelta(hours=sla_hours)
            time_left    = (sla_deadline - now).total_seconds() / 3600
            if 0 < time_left < sla_hours * 0.2:   # within last 20% of SLA window
                approaching += 1

        return {
            "in_review":          total_review,
            "escalated":          total_escalated,
            "approaching_sla":    approaching,
            "sla_thresholds":     SLA_HOURS,
        }
    except Exception as e:
        logger.error(f"[ESCALATION] Stats failed: {e}")
        return {"in_review": 0, "escalated": 0, "approaching_sla": 0, "sla_thresholds": SLA_HOURS}