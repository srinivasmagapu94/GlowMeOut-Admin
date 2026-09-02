"""Partner verification workspace: application review, document statuses, decisions."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from lib.auth import current_admin
from lib.db import db
from lib.query import build_query, paginate
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
):
    filters: Dict[str, Any] = {}
    for name in ("status", "city", "priority"):
        raw = request.query_params.get(name)
        if raw not in (None, "", "all"):
            filters[name] = raw
    query = build_query(q, SEARCH_FIELDS, filters)
    return await paginate(
        db.applications, query=query, sort_field=sort, sort_dir=dir, page=page, page_size=page_size
    )


@router.get("/facets")
async def facets():
    return {
        "status": sorted([v for v in await db.applications.distinct("status") if v]),
        "city": sorted([v for v in await db.applications.distinct("city") if v]),
        "priority": sorted([v for v in await db.applications.distinct("priority") if v]),
    }


async def _load(app_id: str) -> Dict[str, Any]:
    doc = await db.applications.find_one({"id": app_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Application not found")
    return doc


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

    if payload.action == "approve":
        doc = await _load(app_id)
        await db.partners.update_one(
            {"business_name": doc["business_name"]},
            {"$set": {"verification_status": "verified", "account_status": "active"}},
        )

    return Application(**await _load(app_id))


@router.patch("/{app_id}/documents/{doc_id}", response_model=Application)
async def set_document_status(app_id: str, doc_id: str, payload: DocumentStatusRequest):
    allowed = {"pending", "under_review", "verified", "rejected"}
    if payload.status not in allowed:
        raise HTTPException(status_code=400, detail="Invalid document status")
    result = await db.applications.update_one(
        {"id": app_id, "documents.id": doc_id},
        {"$set": {"documents.$.status": payload.status, "updated_at": _now()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    return Application(**await _load(app_id))


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
    return Application(**await _load(app_id))


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
