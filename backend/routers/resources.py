"""Generic resource routes: list (search/filter/sort/paginate), read, update, create, delete.

A registry keeps every management table on one well-tested code path. Resource-specific
workflows (verification decisions, insights) live in their own routers.
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response

from lib.audit import humanise, record, severity_for
from lib.auth import current_admin
from lib.db import db
from lib.query import build_query, paginate

EXPORT_LIMIT = 5000
from models.schemas import (
    BulkStatusUpdate,
    Offer,
    OfferUpsert,
    Page,
    ServiceItem,
    ServiceUpsert,
    StatusUpdate,
)

router = APIRouter(dependencies=[Depends(current_admin)], tags=["resources"])


@dataclass
class ResourceConfig:
    collection: str
    search_fields: List[str]
    filter_fields: List[str] = field(default_factory=list)
    numeric_filters: Dict[str, str] = field(default_factory=dict)
    date_field: Optional[str] = None
    default_sort: str = "created_at"
    default_dir: str = "desc"
    editable: List[str] = field(default_factory=list)
    label_field: str = "id"
    export_columns: List[str] = field(default_factory=list)


REGISTRY: Dict[str, ResourceConfig] = {
    "customers": ResourceConfig(
        collection="customers",
        search_fields=["name", "email", "phone", "code", "city"],
        filter_fields=["status", "city", "segment"],
        default_sort="joined_at",
        editable=["status", "segment", "notes"],
        label_field="name",
        export_columns=["code", "name", "email", "phone", "city", "segment", "status", "bookings_count", "total_spent", "joined_at", "last_active"],
    ),
    "partners": ResourceConfig(
        collection="partners",
        search_fields=["business_name", "owner_name", "email", "code", "city"],
        filter_fields=["account_status", "verification_status", "city"],
        default_sort="joined_at",
        editable=["account_status", "verification_status"],
        label_field="business_name",
        export_columns=["code", "business_name", "owner_name", "email", "phone", "city", "rating", "reviews_count", "jobs_completed", "revenue", "verification_status", "account_status", "joined_at"],
    ),
    "services": ResourceConfig(
        collection="services",
        search_fields=["name", "category", "description"],
        filter_fields=["category", "enabled"],
        default_sort="name",
        default_dir="asc",
        editable=["enabled", "name", "category", "description", "duration_min", "base_price", "commission_pct"],
        label_field="name",
        export_columns=["name", "category", "duration_min", "base_price", "commission_pct", "partners_count", "bookings_count", "enabled"],
    ),
    "bookings": ResourceConfig(
        collection="bookings",
        search_fields=["code", "customer_name", "partner_name", "service_name", "city"],
        filter_fields=["status", "payment_status", "category", "city"],
        date_field="scheduled_date",
        default_sort="scheduled_date",
        editable=["status", "payment_status", "notes"],
        label_field="code",
        export_columns=["code", "customer_name", "partner_name", "service_name", "category", "city", "scheduled_date", "scheduled_slot", "amount", "payment_status", "status", "channel"],
    ),
    "payments": ResourceConfig(
        collection="payments",
        search_fields=["code", "booking_code", "customer_name", "partner_name"],
        filter_fields=["status", "method", "settlement_status"],
        date_field="created_at",
        default_sort="created_at",
        editable=["status", "settlement_status"],
        label_field="code",
        export_columns=["code", "booking_code", "customer_name", "partner_name", "amount", "platform_fee", "partner_payout", "method", "status", "settlement_status", "created_at"],
    ),
    "reviews": ResourceConfig(
        collection="reviews",
        search_fields=["code", "customer_name", "partner_name", "service_name", "title", "body"],
        filter_fields=["status", "rating"],
        date_field="created_at",
        default_sort="created_at",
        editable=["status", "flagged_reason"],
        label_field="code",
        export_columns=["code", "customer_name", "partner_name", "service_name", "rating", "title", "status", "created_at"],
    ),
    "tickets": ResourceConfig(
        collection="tickets",
        search_fields=["code", "subject", "requester_name", "assignee", "body"],
        filter_fields=["status", "priority", "kind", "category", "assignee"],
        date_field="created_at",
        default_sort="created_at",
        editable=["status", "priority", "assignee"],
        label_field="code",
        export_columns=["code", "subject", "kind", "category", "requester_name", "requester_type", "priority", "status", "assignee", "amount_disputed", "created_at"],
    ),
    "offers": ResourceConfig(
        collection="offers",
        search_fields=["code", "title", "description", "audience"],
        filter_fields=["status", "discount_type"],
        default_sort="starts_at",
        editable=["status", "title", "description", "discount_value", "min_order", "ends_at", "usage_limit"],
        label_field="code",
        export_columns=["code", "title", "discount_type", "discount_value", "min_order", "audience", "starts_at", "ends_at", "usage_count", "usage_limit", "status"],
    ),
    "notifications": ResourceConfig(
        collection="notifications",
        search_fields=["title", "body", "category"],
        filter_fields=["severity", "category", "read"],
        default_sort="created_at",
        editable=["read"],
        label_field="title",
        export_columns=["title", "category", "severity", "read", "created_at"],
    ),
    # Read-only history: no editable fields, and DELETE is rejected below.
    "audit": ResourceConfig(
        collection="audit_log",
        search_fields=["actor_name", "action_label", "entity_label", "entity_id", "detail", "action"],
        filter_fields=["action", "entity_type", "actor_name", "severity"],
        date_field="at",
        default_sort="at",
        editable=[],
        label_field="action_label",
        export_columns=["at", "actor_name", "actor_role", "action", "action_label", "entity_type", "entity_label", "entity_id", "detail", "severity"],
    ),
}

_BOOL_FIELDS = {"enabled", "read"}
_INT_FIELDS = {"rating"}


def _config(resource: str) -> ResourceConfig:
    cfg = REGISTRY.get(resource)
    if not cfg:
        raise HTTPException(status_code=404, detail=f"Unknown resource '{resource}'")
    return cfg


def _coerce(field_name: str, raw: str) -> Any:
    if field_name in _BOOL_FIELDS:
        return raw.lower() in ("true", "1", "yes")
    if field_name in _INT_FIELDS:
        try:
            return int(raw)
        except ValueError:
            return raw
    return raw


def _csv_cell(value: Any) -> str:
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if isinstance(value, list):
        return ", ".join(str(v) for v in value)
    if value is None:
        return ""
    return str(value)


def _build_filters(
    cfg: ResourceConfig,
    request: Request,
    q: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
) -> Dict[str, Any]:
    """Shared by list and export so a CSV always matches what the table shows."""
    filters: Dict[str, Any] = {}
    for name in cfg.filter_fields:
        raw = request.query_params.get(name)
        if raw not in (None, "", "all"):
            filters[name] = _coerce(name, raw)

    if cfg.date_field and (date_from or date_to):
        bounds: Dict[str, Any] = {}
        if date_from:
            bounds["$gte"] = date_from
        if date_to:
            bounds["$lte"] = date_to + "\uffff"
        filters[cfg.date_field] = bounds

    return build_query(q, cfg.search_fields, filters)


@router.get("/{resource}", response_model=Page)
async def list_resource(
    resource: str,
    request: Request,
    q: Optional[str] = None,
    sort: Optional[str] = None,
    dir: str = "desc",
    page: int = 1,
    page_size: int = Query(default=25, ge=5, le=200),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    cfg = _config(resource)
    query = _build_filters(cfg, request, q, date_from, date_to)
    return await paginate(
        db[cfg.collection],
        query=query,
        sort_field=sort or cfg.default_sort,
        sort_dir=dir if sort else cfg.default_dir,
        page=page,
        page_size=page_size,
    )


@router.get("/{resource}/facets")
async def resource_facets(resource: str):
    """Distinct values per filterable field, so filter dropdowns reflect real data."""
    cfg = _config(resource)
    out: Dict[str, List[Any]] = {}
    for name in cfg.filter_fields:
        values = await db[cfg.collection].distinct(name)
        out[name] = sorted([v for v in values if v not in (None, "")], key=lambda x: str(x))
    return out


@router.get("/{resource}/export")
async def export_resource(
    resource: str,
    request: Request,
    q: Optional[str] = None,
    sort: Optional[str] = None,
    dir: str = "desc",
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    admin=Depends(current_admin),
):
    """Stream the CURRENT filtered result set as CSV (not just the visible page)."""
    cfg = _config(resource)
    query = _build_filters(cfg, request, q, date_from, date_to)

    direction = -1 if dir == "desc" else 1
    cursor = (
        db[cfg.collection]
        .find(query, {"_id": 0})
        .sort([(sort or cfg.default_sort, direction), ("id", 1)])
        .limit(EXPORT_LIMIT)
    )
    rows = await cursor.to_list(length=EXPORT_LIMIT)

    columns = cfg.export_columns or (list(rows[0].keys()) if rows else ["id"])
    buffer = io.StringIO()
    writer = csv.writer(buffer, quoting=csv.QUOTE_MINIMAL, lineterminator="\r\n")
    writer.writerow([c.replace("_", " ").title() for c in columns])
    for row in rows:
        writer.writerow([_csv_cell(row.get(column, "")) for column in columns])

    await record(
        actor=admin,
        action=f"{resource}.exported",
        action_label=f"Exported {resource} to CSV",
        entity_type=resource,
        entity_label=f"{len(rows)} rows",
        detail=f"Filters: {str(request.query_params) or 'none'}",
    )

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M")
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="glowmeout-{resource}-{stamp}.csv"'
        },
    )


@router.get("/{resource}/{item_id}")
async def get_resource(resource: str, item_id: str):
    cfg = _config(resource)
    doc = await db[cfg.collection].find_one({"id": item_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Record not found")
    return doc


@router.patch("/{resource}/{item_id}")
async def update_resource(
    resource: str, item_id: str, payload: StatusUpdate, admin=Depends(current_admin)
):
    cfg = _config(resource)
    if payload.field not in cfg.editable:
        raise HTTPException(status_code=400, detail=f"Field '{payload.field}' is not editable")
    result = await db[cfg.collection].update_one(
        {"id": item_id},
        {
            "$set": {
                payload.field: payload.value,
                "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            }
        },
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Record not found")
    doc = await db[cfg.collection].find_one({"id": item_id}, {"_id": 0})

    await record(
        actor=admin,
        action=f"{resource}.{payload.field}_changed",
        action_label=f"Set {payload.field.replace('_', ' ')} to {humanise(payload.value)}",
        entity_type=resource,
        entity_label=str((doc or {}).get(cfg.label_field, item_id)),
        entity_id=item_id,
        severity=severity_for(payload.value),
    )
    return doc


@router.post("/{resource}/bulk")
async def bulk_update_resource(
    resource: str, payload: BulkStatusUpdate, admin=Depends(current_admin)
):
    cfg = _config(resource)
    if payload.field not in cfg.editable:
        raise HTTPException(status_code=400, detail=f"Field '{payload.field}' is not editable")
    if not payload.ids:
        raise HTTPException(status_code=400, detail="No records selected")
    result = await db[cfg.collection].update_many(
        {"id": {"$in": payload.ids}}, {"$set": {payload.field: payload.value}}
    )

    await record(
        actor=admin,
        action=f"{resource}.bulk_{payload.field}_changed",
        action_label=(
            f"Bulk set {payload.field.replace('_', ' ')} to {humanise(payload.value)} "
            f"on {result.modified_count} records"
        ),
        entity_type=resource,
        entity_label=f"{result.modified_count} records",
        detail=f"Applied to {len(payload.ids)} selected records",
        severity=severity_for(payload.value),
    )
    return {"updated": result.modified_count}


@router.delete("/{resource}/{item_id}")
async def delete_resource(resource: str, item_id: str, admin=Depends(current_admin)):
    cfg = _config(resource)
    if resource not in ("services", "offers", "notifications"):
        raise HTTPException(status_code=400, detail=f"'{resource}' records cannot be deleted")
    doc = await db[cfg.collection].find_one({"id": item_id}, {"_id": 0})
    result = await db[cfg.collection].delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Record not found")

    await record(
        actor=admin,
        action=f"{resource}.deleted",
        action_label=f"Deleted {resource[:-1] if resource.endswith('s') else resource}",
        entity_type=resource,
        entity_label=str((doc or {}).get(cfg.label_field, item_id)),
        entity_id=item_id,
        severity="warning",
    )
    return {"ok": True}


# ------------------------------------------------------- typed create endpoints
create_router = APIRouter(dependencies=[Depends(current_admin)], tags=["resources"])


@create_router.post("/services", response_model=ServiceItem)
async def create_service(payload: ServiceUpsert, admin=Depends(current_admin)):
    item = ServiceItem(
        **payload.model_dump(),
        updated_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
    )
    await db.services.insert_one(item.model_dump())
    await record(
        actor=admin,
        action="services.created",
        action_label="Created service",
        entity_type="services",
        entity_label=item.name,
        entity_id=item.id,
        detail=f"{item.category} · {item.duration_min} min · base price {item.base_price}",
    )
    return item


@create_router.post("/offers", response_model=Offer)
async def create_offer(payload: OfferUpsert, admin=Depends(current_admin)):
    existing = await db.offers.find_one({"code": payload.code.strip().upper()})
    if existing:
        raise HTTPException(status_code=409, detail="Coupon code already exists")
    data = payload.model_dump()
    data["code"] = data["code"].strip().upper()
    item = Offer(**data, usage_count=0)
    await db.offers.insert_one(item.model_dump())
    await record(
        actor=admin,
        action="offers.created",
        action_label="Created coupon",
        entity_type="offers",
        entity_label=item.code,
        entity_id=item.id,
        detail=f"{item.title} · {item.discount_value} {item.discount_type} · {item.starts_at} to {item.ends_at}",
    )
    return item
