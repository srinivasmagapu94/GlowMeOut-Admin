"""Audit trail recorder.

Every state-changing admin action funnels through `record()` so the audit log is a
single, queryable history rather than something each route reinvents.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from lib.db import db
from models.schemas import AuditEntry

# Values that represent a restrictive/negative outcome get a louder severity.
_WARNING_VALUES = {
    "suspended",
    "rejected",
    "removed",
    "cancelled",
    "flagged",
    "paused",
    "disabled",
    "deactivated",
    "failed",
    "refunded",
    "correction_requested",
    "on_hold",
}


def severity_for(value: Any) -> str:
    return "warning" if str(value).lower() in _WARNING_VALUES else "info"


def humanise(value: Any) -> str:
    text = str(value)
    if text in ("True", "False"):
        return "enabled" if text == "True" else "disabled"
    return text.replace("_", " ")


async def record(
    *,
    actor: Optional[Dict[str, Any]],
    action: str,
    action_label: str,
    entity_type: str,
    entity_label: str = "",
    entity_id: str = "",
    detail: str = "",
    severity: str = "info",
) -> AuditEntry:
    entry = AuditEntry(
        at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        actor_name=(actor or {}).get("name", "System"),
        actor_role=(actor or {}).get("role", "System"),
        action=action,
        action_label=action_label,
        entity_type=entity_type,
        entity_label=entity_label,
        entity_id=entity_id,
        detail=detail,
        severity=severity,
    )
    await db.audit_log.insert_one(entry.model_dump())
    return entry
