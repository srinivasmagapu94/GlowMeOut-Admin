"""Pydantic v2 models for the GlowMeOut admin console.

Every model here has a hand-written TS mirror in frontend/src/lib/types.ts —
keep the two in sync in the same edit.
"""

from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


def new_id() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------- auth
class LoginRequest(BaseModel):
    email: str
    password: str


class AdminUser(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    email: str
    role: str
    title: str
    avatar_url: str = ""
    last_login: Optional[str] = None


# ---------------------------------------------------------------- paging
class Page(BaseModel):
    items: List[Dict[str, Any]]
    total: int
    page: int
    page_size: int
    pages: int


# ---------------------------------------------------------------- domain
class Customer(BaseModel):
    id: str = Field(default_factory=new_id)
    code: str
    name: str
    email: str
    phone: str
    city: str
    segment: str
    status: str
    bookings_count: int
    total_spent: float
    avg_rating_given: float
    joined_at: str
    last_active: str
    notes: str = ""


class Partner(BaseModel):
    id: str = Field(default_factory=new_id)
    code: str
    business_name: str
    owner_name: str
    email: str
    phone: str
    city: str
    services: List[str]
    rating: float
    reviews_count: int
    jobs_completed: int
    revenue: float
    account_status: str
    verification_status: str
    joined_at: str
    bio: str = ""


class VerificationDocument(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    doc_type: str
    file_label: str
    uploaded_at: str
    status: str


class VerificationNote(BaseModel):
    id: str = Field(default_factory=new_id)
    author: str
    text: str
    created_at: str
    kind: str = "note"


class VerificationService(BaseModel):
    name: str
    category: str
    duration_min: int
    price: float


class Application(BaseModel):
    id: str = Field(default_factory=new_id)
    code: str
    business_name: str
    owner_name: str
    email: str
    phone: str
    city: str
    address: str
    business_reg_no: str
    tax_id: str
    license_no: str
    experience_years: int
    team_size: int
    specialties: List[str]
    services: List[VerificationService]
    portfolio: List[str]
    documents: List[VerificationDocument]
    notes: List[VerificationNote]
    checklist: Dict[str, bool]
    status: str
    priority: str
    submitted_at: str
    updated_at: str
    decision_reason: str = ""
    # Computed server-side on read (never stored) — see routers/verification.py
    age_hours: float = 0.0
    sla_state: str = "on_track"
    sla_due_in_hours: float = 0.0


class DecisionRequest(BaseModel):
    action: str  # approve | reject | request_correction | under_review
    reason: str = ""
    note: str = ""


class DocumentStatusRequest(BaseModel):
    status: str


class NoteRequest(BaseModel):
    text: str


class ServiceItem(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    category: str
    description: str = ""
    duration_min: int
    base_price: float
    commission_pct: float
    partners_count: int = 0
    bookings_count: int = 0
    enabled: bool = True
    updated_at: str = ""


class ServiceUpsert(BaseModel):
    name: str
    category: str
    description: str = ""
    duration_min: int
    base_price: float
    commission_pct: float = 15.0
    enabled: bool = True


class Booking(BaseModel):
    id: str = Field(default_factory=new_id)
    code: str
    customer_name: str
    partner_name: str
    service_name: str
    category: str
    city: str
    scheduled_date: str
    scheduled_slot: str
    amount: float
    payment_status: str
    status: str
    channel: str
    created_at: str
    address: str = ""
    notes: str = ""


class Payment(BaseModel):
    id: str = Field(default_factory=new_id)
    code: str
    booking_code: str
    customer_name: str
    partner_name: str
    amount: float
    platform_fee: float
    partner_payout: float
    method: str
    status: str
    settlement_status: str
    created_at: str


class Review(BaseModel):
    id: str = Field(default_factory=new_id)
    code: str
    customer_name: str
    partner_name: str
    service_name: str
    rating: int
    title: str
    body: str
    status: str
    flagged_reason: str = ""
    created_at: str


class Ticket(BaseModel):
    id: str = Field(default_factory=new_id)
    code: str
    subject: str
    body: str
    kind: str  # support | dispute
    category: str
    requester_name: str
    requester_type: str
    priority: str
    status: str
    assignee: str
    amount_disputed: float = 0.0
    created_at: str
    updated_at: str


class Offer(BaseModel):
    id: str = Field(default_factory=new_id)
    code: str
    title: str
    description: str = ""
    discount_type: str
    discount_value: float
    min_order: float
    audience: str
    starts_at: str
    ends_at: str
    usage_count: int
    usage_limit: int
    status: str


class OfferUpsert(BaseModel):
    code: str
    title: str
    description: str = ""
    discount_type: str
    discount_value: float
    min_order: float = 0.0
    audience: str = "All customers"
    starts_at: str
    ends_at: str
    usage_limit: int = 500
    status: str = "scheduled"


class Notification(BaseModel):
    id: str = Field(default_factory=new_id)
    title: str
    body: str
    category: str
    severity: str
    created_at: str
    read: bool = False


class StatusUpdate(BaseModel):
    field: str
    value: Any


class BulkStatusUpdate(BaseModel):
    ids: List[str]
    field: str
    value: Any


# ---------------------------------------------------------------- insights
class Kpi(BaseModel):
    key: str
    label: str
    value: float
    unit: str
    delta_pct: float
    trend: str
    hint: str


class SeriesPoint(BaseModel):
    label: str
    a: float
    b: float


class SlicePoint(BaseModel):
    label: str
    value: float


class ActivityItem(BaseModel):
    id: str
    actor: str
    action: str
    target: str
    at: str
    kind: str


class PendingAction(BaseModel):
    id: str
    label: str
    detail: str
    count: int
    href: str
    severity: str


class AlertItem(BaseModel):
    id: str
    title: str
    detail: str
    severity: str
    at: str


class DashboardSummary(BaseModel):
    kpis: List[Kpi]
    revenue_series: List[SeriesPoint]
    bookings_by_category: List[SlicePoint]
    activity: List[ActivityItem]
    pending_actions: List[PendingAction]
    alerts: List[AlertItem]
    generated_at: str


class AnalyticsOverview(BaseModel):
    kpis: List[Kpi]
    revenue_series: List[SeriesPoint]
    bookings_series: List[SeriesPoint]
    category_split: List[SlicePoint]
    city_split: List[SlicePoint]
    rating_split: List[SlicePoint]
    range_label: str
    generated_at: str


# ---------------------------------------------------------------- audit
class AuditEntry(BaseModel):
    id: str = Field(default_factory=new_id)
    at: str
    actor_name: str
    actor_role: str
    action: str
    action_label: str
    entity_type: str
    entity_label: str = ""
    entity_id: str = ""
    detail: str = ""
    severity: str = "info"


# ---------------------------------------------------------------- settings
class RoleItem(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    description: str
    members: int
    permissions: List[str]


class PlatformSettings(BaseModel):
    platform_name: str = "GlowMeOut"
    support_email: str = "ops@glowmeout.example"
    default_commission_pct: float = 15.0
    booking_cancellation_window_hrs: int = 12
    payout_cycle: str = "Weekly"
    auto_approve_reviews: bool = False
    require_document_reverification_months: int = 12
    maintenance_mode: bool = False
    two_factor_required: bool = True
    session_timeout_min: int = 60
    notify_new_application: bool = True
    notify_dispute_raised: bool = True
    notify_payout_failure: bool = True
    notify_weekly_digest: bool = False
