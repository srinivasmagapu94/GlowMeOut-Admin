"""Partner verification workspace: application review, document statuses, decisions."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from lib.audit import record
from lib.auth import current_admin
from lib.db import db
from lib.query import build_query
from models.schemas import (
    Application,
    DecisionRequest,
    DocumentStatusRequest,
    NoteRequest,
    Page,
    VerificationNote,
)

router = APIRouter(prefix="/verifications", dependencies=[Depends(current_admin)], tags=["verification"])

SEARCH_FIELDS = ["code", "business_name", "owner_name", "email", "city"]

# Response-time target for an application sitting in the queue.
SLA_TARGET_HOURS = 48.0
SLA_AT_RISK_HOURS = 36.0
OPEN_STATUSES = {"pending", "under_review", "correction_requested"}


def _sla_for(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Age an application and classify it against the response target.

    Decided applications (verified/rejected) are 'closed' — they no longer consume SLA.
    """
    submitted = doc.get("submitted_at") or ""
    try:
        started = datetime.fromisoformat(submitted)
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        age_hours = max(0.0, (datetime.now(timezone.utc) - started).total_seconds() / 3600.0)
    except ValueError:
        age_hours = 0.0

    if doc.get("status") not in OPEN_STATUSES:
        state = "closed"
    elif age_hours >= SLA_TARGET_HOURS:
        state = "breached"
    elif age_hours >= SLA_AT_RISK_HOURS:
        state = "at_risk"
    else:
        state = "on_track"

    doc["age_hours"] = round(age_hours, 1)
    doc["sla_state"] = state
    doc["sla_due_in_hours"] = round(SLA_TARGET_HOURS - age_hours, 1)
    return doc

_ACTION_STATUS = {
    "approve": "verified",
    "reject": "rejected",
    "request_correction": "correction_requested",
    "under_review": "under_review",
}

_ACTION_LABEL = {
    "approve": "Approved application",
    "reject": "Rejected application",
    "request_correction": "Requested correction",
    "under_review": "Moved to under review",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@router.get("", response_model=Page)
async def list_applications(
    request: Request,
    q: Optional[str] = None,
    sort: str = "submitted_at",
    dir: str = "desc",
    page: int = 1,
    page_size: int = Query(default=25, ge=5, le=200),
    sla_state: Optional[str] = None,
):
    filters: Dict[str, Any] = {}
    for name in ("status", "city", "priority"):
        raw = request.query_params.get(name)
        if raw not in (None, "", "all"):
            filters[name] = raw
    query = build_query(q, SEARCH_FIELDS, filters)

    # SLA is computed, not stored, so enrich the whole matching set and then
    # filter/sort/slice in Python. The verification queue is small by design.
    docs = [_sla_for(d) for d in await db.applications.find(query, {"_id": 0}).to_list(length=1000)]

    if sla_state not in (None, "", "all"):
        docs = [d for d in docs if d["sla_state"] == sla_state]

    reverse = dir == "desc"
    if sort in ("age_hours", "sla_due_in_hours"):
        docs.sort(key=lambda d: d.get(sort, 0.0), reverse=reverse)
    elif sort == "urgency":
        rank = {"breached": 0, "at_risk": 1, "on_track": 2, "closed": 3}
        docs.sort(key=lambda d: (rank.get(d["sla_state"], 9), -d["age_hours"]))
    else:
        docs.sort(key=lambda d: str(d.get(sort, "")), reverse=reverse)

    total = len(docs)
    page = max(1, page)
    start = (page - 1) * page_size
    items = docs[start : start + page_size]
    pages = max(1, (total + page_size - 1) // page_size)
    return Page(items=items, total=total, page=page, page_size=page_size, pages=pages)


@router.get("/facets")
async def facets():
    return {
        "status": sorted([v for v in await db.applications.distinct("status") if v]),
        "city": sorted([v for v in await db.applications.distinct("city") if v]),
        "priority": sorted([v for v in await db.applications.distinct("priority") if v]),
        "sla_state": ["breached", "at_risk", "on_track", "closed"],
    }


async def _load(app_id: str) -> Dict[str, Any]:
    doc = await db.applications.find_one({"id": app_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Application not found")
    return _sla_for(doc)


@router.get("/{app_id}", response_model=Application)
async def get_application(app_id: str):
    return Application(**await _load(app_id))


@router.post("/{app_id}/decision", response_model=Application)
async def decide(app_id: str, payload: DecisionRequest, admin=Depends(current_admin)):
    await _load(app_id)
    status = _ACTION_STATUS.get(payload.action)
    if not status:
        raise HTTPException(status_code=400, detail=f"Unknown action '{payload.action}'")
    if payload.action in ("reject", "request_correction") and not payload.reason.strip():
        raise HTTPException(status_code=400, detail="A reason is required for this action")

    entry = VerificationNote(
        author=admin.get("name", "Admin"),
        text=(payload.note.strip() or payload.reason.strip() or _ACTION_LABEL[payload.action]),
        created_at=_now(),
        kind=payload.action,
    )
    await db.applications.update_one(
        {"id": app_id},
        {
            "$set": {
                "status": status,
                "updated_at": _now(),
                "decision_reason": payload.reason.strip(),
            },
            "$push": {"notes": entry.model_dump()},
        },
    )

    doc = await _load(app_id)
    if payload.action == "approve":
        await db.partners.update_one(
            {"business_name": doc["business_name"]},
            {"$set": {"verification_status": "verified", "account_status": "active"}},
        )

    await record(
        actor=admin,
        action=f"verification.{payload.action}",
        action_label=_ACTION_LABEL[payload.action],
        entity_type="application",
        entity_label=f"{doc['code']} · {doc['business_name']}",
        entity_id=app_id,
        detail=payload.reason.strip() or payload.note.strip(),
        severity="warning" if payload.action in ("reject", "request_correction") else "info",
    )
    return Application(**doc)


@router.patch("/{app_id}/documents/{doc_id}", response_model=Application)
async def set_document_status(
    app_id: str, doc_id: str, payload: DocumentStatusRequest, admin=Depends(current_admin)
):
    allowed = {"pending", "under_review", "verified", "rejected"}
    if payload.status not in allowed:
        raise HTTPException(status_code=400, detail="Invalid document status")
    result = await db.applications.update_one(
        {"id": app_id, "documents.id": doc_id},
        {"$set": {"documents.$.status": payload.status, "updated_at": _now()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    doc = await _load(app_id)
    document = next((d for d in doc["documents"] if d["id"] == doc_id), {})

    await record(
        actor=admin,
        action=f"verification.document_{payload.status}",
        action_label=f"Marked document {payload.status.replace('_', ' ')}",
        entity_type="application",
        entity_label=f"{doc['code']} · {document.get('name', 'document')}",
        entity_id=app_id,
        severity="warning" if payload.status == "rejected" else "info",
    )
    return Application(**doc)


@router.post("/{app_id}/notes", response_model=Application)
async def add_note(app_id: str, payload: NoteRequest, admin=Depends(current_admin)):
    await _load(app_id)
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Note cannot be empty")
    entry = VerificationNote(
        author=admin.get("name", "Admin"), text=payload.text.strip(), created_at=_now(), kind="note"
    )
    await db.applications.update_one(
        {"id": app_id}, {"$push": {"notes": entry.model_dump()}, "$set": {"updated_at": _now()}}
    )
    doc = await _load(app_id)
    await record(
        actor=admin,
        action="verification.note_added",
        action_label="Added an admin note",
        entity_type="application",
        entity_label=f"{doc['code']} · {doc['business_name']}",
        entity_id=app_id,
        detail=payload.text.strip()[:180],
    )
    return Application(**doc)


@router.patch("/{app_id}/checklist/{key}", response_model=Application)
async def toggle_checklist(app_id: str, key: str, payload: DocumentStatusRequest):
    doc = await _load(app_id)
    if key not in doc.get("checklist", {}):
        raise HTTPException(status_code=404, detail="Unknown checklist item")
    await db.applications.update_one(
        {"id": app_id},
        {"$set": {f"checklist.{key}": payload.status == "true", "updated_at": _now()}},
    )
    return Application(**await _load(app_id))
