"""Generic resource routes: list (search/filter/sort/paginate), read, update, create, delete.

A registry keeps every management table on one well-tested code path. Resource-specific
workflows (verification decisions, insights) live in their own routers.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from lib.auth import current_admin
from lib.db import db
from lib.query import build_query, paginate
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


REGISTRY: Dict[str, ResourceConfig] = {
    "customers": ResourceConfig(
        collection="customers",
        search_fields=["name", "email", "phone", "code", "city"],
        filter_fields=["status", "city", "segment"],
        default_sort="joined_at",
        editable=["status", "segment", "notes"],
    ),
    "partners": ResourceConfig(
        collection="partners",
        search_fields=["business_name", "owner_name", "email", "code", "city"],
        filter_fields=["account_status", "verification_status", "city"],
        default_sort="joined_at",
        editable=["account_status", "verification_status"],
    ),
    "services": ResourceConfig(
        collection="services",
        search_fields=["name", "category", "description"],
        filter_fields=["category", "enabled"],
        default_sort="name",
        default_dir="asc",
        editable=["enabled", "name", "category", "description", "duration_min", "base_price", "commission_pct"],
    ),
    "bookings": ResourceConfig(
        collection="bookings",
        search_fields=["code", "customer_name", "partner_name", "service_name", "city"],
        filter_fields=["status", "payment_status", "category", "city"],
        date_field="scheduled_date",
        default_sort="scheduled_date",
        editable=["status", "payment_status", "notes"],
    ),
    "payments": ResourceConfig(
        collection="payments",
        search_fields=["code", "booking_code", "customer_name", "partner_name"],
        filter_fields=["status", "method", "settlement_status"],
        date_field="created_at",
        default_sort="created_at",
        editable=["status", "settlement_status"],
    ),
    "reviews": ResourceConfig(
        collection="reviews",
        search_fields=["code", "customer_name", "partner_name", "service_name", "title", "body"],
        filter_fields=["status", "rating"],
        date_field="created_at",
        default_sort="created_at",
        editable=["status", "flagged_reason"],
    ),
    "tickets": ResourceConfig(
        collection="tickets",
        search_fields=["code", "subject", "requester_name", "assignee", "body"],
        filter_fields=["status", "priority", "kind", "category", "assignee"],
        date_field="created_at",
        default_sort="created_at",
        editable=["status", "priority", "assignee"],
    ),
    "offers": ResourceConfig(
        collection="offers",
        search_fields=["code", "title", "description", "audience"],
        filter_fields=["status", "discount_type"],
        default_sort="starts_at",
        editable=["status", "title", "description", "discount_value", "min_order", "ends_at", "usage_limit"],
    ),
    "notifications": ResourceConfig(
        collection="notifications",
        search_fields=["title", "body", "category"],
        filter_fields=["severity", "category", "read"],
        default_sort="created_at",
        editable=["read"],
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

    query = build_query(q, cfg.search_fields, filters)
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


@router.get("/{resource}/{item_id}")
async def get_resource(resource: str, item_id: str):
    cfg = _config(resource)
    doc = await db[cfg.collection].find_one({"id": item_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Record not found")
    return doc


@router.patch("/{resource}/{item_id}")
async def update_resource(resource: str, item_id: str, payload: StatusUpdate):
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
    return await db[cfg.collection].find_one({"id": item_id}, {"_id": 0})


@router.post("/{resource}/bulk")
async def bulk_update_resource(resource: str, payload: BulkStatusUpdate):
    cfg = _config(resource)
    if payload.field not in cfg.editable:
        raise HTTPException(status_code=400, detail=f"Field '{payload.field}' is not editable")
    if not payload.ids:
        raise HTTPException(status_code=400, detail="No records selected")
    result = await db[cfg.collection].update_many(
        {"id": {"$in": payload.ids}}, {"$set": {payload.field: payload.value}}
    )
    return {"updated": result.modified_count}


@router.delete("/{resource}/{item_id}")
async def delete_resource(resource: str, item_id: str):
    cfg = _config(resource)
    if resource not in ("services", "offers", "notifications"):
        raise HTTPException(status_code=400, detail=f"'{resource}' records cannot be deleted")
    result = await db[cfg.collection].delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"ok": True}


# ------------------------------------------------------- typed create endpoints
create_router = APIRouter(dependencies=[Depends(current_admin)], tags=["resources"])


@create_router.post("/services", response_model=ServiceItem)
async def create_service(payload: ServiceUpsert):
    item = ServiceItem(
        **payload.model_dump(),
        updated_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
    )
    await db.services.insert_one(item.model_dump())
    return item


@create_router.post("/offers", response_model=Offer)
async def create_offer(payload: OfferUpsert):
    existing = await db.offers.find_one({"code": payload.code.strip().upper()})
    if existing:
        raise HTTPException(status_code=409, detail="Coupon code already exists")
    data = payload.model_dump()
    data["code"] = data["code"].strip().upper()
    item = Offer(**data, usage_count=0)
    await db.offers.insert_one(item.model_dump())
    return item
