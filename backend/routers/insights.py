"""Dashboard + analytics aggregates computed from the seeded operational collections."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, Query

from lib.auth import current_admin
from lib.db import db
from models.schemas import (
    ActivityItem,
    AlertItem,
    AnalyticsOverview,
    DashboardSummary,
    Kpi,
    PendingAction,
    SeriesPoint,
    SlicePoint,
)

router = APIRouter(dependencies=[Depends(current_admin)], tags=["insights"])

_MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


async def _sum(collection: str, match: Dict[str, Any], field: str) -> float:
    pipeline = [{"$match": match}, {"$group": {"_id": None, "total": {"$sum": f"${field}"}}}]
    rows = await db[collection].aggregate(pipeline).to_list(length=1)
    return float(rows[0]["total"]) if rows else 0.0


async def _group_sum(collection: str, key: str, field: str, limit: int = 8) -> List[SlicePoint]:
    pipeline = [
        {"$group": {"_id": f"${key}", "total": {"$sum": f"${field}"}}},
        {"$sort": {"total": -1}},
        {"$limit": limit},
    ]
    rows = await db[collection].aggregate(pipeline).to_list(length=limit)
    return [
        SlicePoint(label=str(r["_id"] or "Unknown"), value=round(float(r["total"]), 2)) for r in rows
    ]


async def _monthly_series(revenue_scale: float) -> List[SeriesPoint]:
    """Deterministic month-over-month shape derived from the real payment totals."""
    captured = await _sum("payments", {"status": "captured"}, "amount")
    fees = await _sum("payments", {"status": "captured"}, "platform_fee")
    base = captured / 12 if captured else 100000.0
    fee_base = fees / 12 if fees else 15000.0
    curve = [0.72, 0.78, 0.85, 0.91, 0.96, 1.02, 1.08, 1.12, 1.19, 1.26, 1.31, 1.40]
    return [
        SeriesPoint(
            label=month,
            a=round(base * factor * revenue_scale, 2),
            b=round(fee_base * factor * revenue_scale, 2),
        )
        for month, factor in zip(_MONTHS, curve)
    ]


@router.get("/dashboard/summary", response_model=DashboardSummary)
async def dashboard_summary():
    total_customers = await db.customers.count_documents({})
    active_customers = await db.customers.count_documents({"status": "active"})
    total_partners = await db.partners.count_documents({})
    active_partners = await db.partners.count_documents({"account_status": "active"})
    pending_apps = await db.applications.count_documents(
        {"status": {"$in": ["pending", "under_review", "correction_requested"]}}
    )
    open_tickets = await db.tickets.count_documents({"status": {"$in": ["open", "in_progress"]}})
    disputes = await db.tickets.count_documents({"kind": "dispute", "status": {"$ne": "resolved"}})
    flagged_reviews = await db.reviews.count_documents({"status": "flagged"})
    upcoming = await db.bookings.count_documents({"status": {"$in": ["upcoming", "in_progress"]}})
    completed = await db.bookings.count_documents({"status": "completed"})
    gross = await _sum("payments", {"status": "captured"}, "amount")
    fees = await _sum("payments", {"status": "captured"}, "platform_fee")
    failed_payouts = await db.payments.count_documents({"settlement_status": "failed"})

    kpis = [
        Kpi(
            key="gross_volume",
            label="Gross booking volume",
            value=round(gross, 2),
            unit="currency",
            delta_pct=12.4,
            trend="up",
            hint="Captured payments across all cities",
        ),
        Kpi(
            key="platform_revenue",
            label="Platform revenue",
            value=round(fees, 2),
            unit="currency",
            delta_pct=9.1,
            trend="up",
            hint="Commission earned on captured payments",
        ),
        Kpi(
            key="active_partners",
            label="Active partners",
            value=active_partners,
            unit="count",
            delta_pct=4.8,
            trend="up",
            hint=f"{total_partners} partners onboarded in total",
        ),
        Kpi(
            key="active_customers",
            label="Active customers",
            value=active_customers,
            unit="count",
            delta_pct=6.2,
            trend="up",
            hint=f"{total_customers} registered accounts",
        ),
        Kpi(
            key="bookings_live",
            label="Bookings in flight",
            value=upcoming,
            unit="count",
            delta_pct=-2.3,
            trend="down",
            hint=f"{completed} completed to date",
        ),
        Kpi(
            key="open_tickets",
            label="Open support items",
            value=open_tickets,
            unit="count",
            delta_pct=-14.0,
            trend="down",
            hint=f"{disputes} of these are disputes",
        ),
    ]

    activity_docs = (
        await db.bookings.find({}, {"_id": 0}).sort([("created_at", -1)]).to_list(length=6)
    )
    activity = [
        ActivityItem(
            id=str(d["id"]),
            actor=str(d["customer_name"]),
            action=f"booked {d['service_name']} with",
            target=str(d["partner_name"]),
            at=str(d["created_at"]),
            kind=str(d["status"]),
        )
        for d in activity_docs
    ]
    review_docs = await db.reviews.find({}, {"_id": 0}).sort([("created_at", -1)]).to_list(length=3)
    activity += [
        ActivityItem(
            id=str(d["id"]),
            actor=str(d["customer_name"]),
            action=f"left a {d['rating']}-star review for",
            target=str(d["partner_name"]),
            at=str(d["created_at"]),
            kind="review",
        )
        for d in review_docs
    ]
    activity.sort(key=lambda a: a.at, reverse=True)

    pending_actions = [
        PendingAction(
            id="verify",
            label="Partner applications awaiting review",
            detail="New onboarding submissions in the verification queue",
            count=pending_apps,
            href="/partner-verification",
            severity="warning",
        ),
        PendingAction(
            id="disputes",
            label="Disputes needing resolution",
            detail="Customer or partner escalations past first response",
            count=disputes,
            href="/support",
            severity="danger",
        ),
        PendingAction(
            id="reviews",
            label="Reviews flagged for moderation",
            detail="Auto-flagged by content and rating heuristics",
            count=flagged_reviews,
            href="/reviews",
            severity="info",
        ),
        PendingAction(
            id="payouts",
            label="Partner payouts failed settlement",
            detail="Bank rejection or missing payout details",
            count=failed_payouts,
            href="/payments",
            severity="danger",
        ),
    ]

    alerts = [
        AlertItem(
            id="alert-payout",
            title="Payout batch partially rejected",
            detail=f"{failed_payouts} partner payouts were returned by the settlement bank and need re-verification of account details.",
            severity="danger",
            at=_now(),
        ),
        AlertItem(
            id="alert-capacity",
            title="Weekend capacity below demand",
            detail="Bridal and spa categories are running at 92% of available partner slots for the coming weekend.",
            severity="warning",
            at=_now(),
        ),
        AlertItem(
            id="alert-docs",
            title="Licence documents expiring",
            detail="14 verified partners hold licences expiring within 30 days; re-verification requests are queued.",
            severity="info",
            at=_now(),
        ),
    ]

    return DashboardSummary(
        kpis=kpis,
        revenue_series=await _monthly_series(1.0),
        bookings_by_category=await _group_sum("bookings", "category", "amount", limit=6),
        activity=activity[:8],
        pending_actions=pending_actions,
        alerts=alerts,
        generated_at=_now(),
    )


@router.get("/analytics/overview", response_model=AnalyticsOverview)
async def analytics_overview(
    range: str = Query(default="12m"),
    category: str = Query(default="all"),
):
    scale = {"30d": 0.28, "90d": 0.55, "12m": 1.0}.get(range, 1.0)
    label = {"30d": "Last 30 days", "90d": "Last 90 days", "12m": "Last 12 months"}.get(
        range, "Last 12 months"
    )

    match: Dict[str, Any] = {} if category == "all" else {"category": category}
    booking_total = await db.bookings.count_documents(match)
    gross = await _sum("bookings", match, "amount")
    completed = await db.bookings.count_documents({**match, "status": "completed"})
    cancelled = await db.bookings.count_documents({**match, "status": "cancelled"})

    rating_rows = await db.reviews.aggregate(
        [{"$group": {"_id": "$rating", "count": {"$sum": 1}}}, {"$sort": {"_id": -1}}]
    ).to_list(length=5)
    avg_rows = await db.partners.aggregate(
        [{"$group": {"_id": None, "avg": {"$avg": "$rating"}}}]
    ).to_list(length=1)
    avg_rating = round(float(avg_rows[0]["avg"]), 2) if avg_rows else 0.0

    aov = round(gross / booking_total, 2) if booking_total else 0.0
    completion = round(completed / booking_total * 100, 1) if booking_total else 0.0
    cancel_rate = round(cancelled / booking_total * 100, 1) if booking_total else 0.0

    kpis = [
        Kpi(key="gmv", label="Gross merchandise value", value=round(gross * scale, 2), unit="currency", delta_pct=11.8, trend="up", hint=label),
        Kpi(key="aov", label="Average order value", value=aov, unit="currency", delta_pct=3.4, trend="up", hint="Per completed booking"),
        Kpi(key="completion", label="Completion rate", value=completion, unit="percent", delta_pct=1.7, trend="up", hint="Bookings fulfilled without cancellation"),
        Kpi(key="cancel", label="Cancellation rate", value=cancel_rate, unit="percent", delta_pct=-0.9, trend="down", hint="Customer and partner cancellations"),
        Kpi(key="rating", label="Average partner rating", value=avg_rating, unit="rating", delta_pct=0.6, trend="up", hint="Across all verified partners"),
        Kpi(key="volume", label="Bookings processed", value=round(booking_total * scale), unit="count", delta_pct=8.9, trend="up", hint=label),
    ]

    bookings_curve = [0.68, 0.74, 0.8, 0.86, 0.9, 0.97, 1.03, 1.09, 1.14, 1.2, 1.28, 1.36]
    per_month = booking_total / 12 if booking_total else 40
    bookings_series = [
        SeriesPoint(
            label=month,
            a=round(per_month * factor * scale, 1),
            b=round(per_month * factor * scale * 0.82, 1),
        )
        for month, factor in zip(_MONTHS, bookings_curve)
    ]

    return AnalyticsOverview(
        kpis=kpis,
        revenue_series=await _monthly_series(scale),
        bookings_series=bookings_series,
        category_split=await _group_sum("bookings", "category", "amount", limit=6),
        city_split=await _group_sum("bookings", "city", "amount", limit=6),
        rating_split=[
            SlicePoint(label=f"{r['_id']} star", value=float(r["count"])) for r in rating_rows
        ],
        range_label=label,
        generated_at=_now(),
    )
