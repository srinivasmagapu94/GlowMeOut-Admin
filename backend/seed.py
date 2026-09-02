"""Idempotent seed for the GlowMeOut admin console.

Run: cd /app/backend && python seed.py
Rebuilds every operational collection with deterministic, realistic demo records.
"""

from __future__ import annotations

import asyncio
import random
from datetime import date, datetime, timedelta, timezone
from lib.auth import DEMO_ADMIN, hash_password
from lib.db import client, db
from models.schemas import (
    Application,
    Booking,
    Customer,
    Notification,
    Offer,
    Partner,
    Payment,
    PlatformSettings,
    Review,
    RoleItem,
    ServiceItem,
    Ticket,
    VerificationDocument,
    VerificationNote,
    VerificationService,
    new_id,
)

RNG = random.Random(20260214)

CITIES = [
    "Mumbai", "Bengaluru", "Delhi NCR", "Hyderabad", "Pune",
    "Chennai", "Kolkata", "Ahmedabad", "Jaipur", "Kochi",
]

FIRST = [
    "Aarav", "Ananya", "Ishaan", "Meera", "Rohan", "Kavya", "Vikram", "Nisha", "Arjun", "Divya",
    "Kabir", "Sanya", "Aditya", "Tara", "Yash", "Ira", "Nikhil", "Riya", "Dev", "Anjali",
    "Farhan", "Zoya", "Manav", "Leela", "Siddharth", "Pooja", "Rahul", "Neha", "Karan", "Sneha",
]
LAST = [
    "Sharma", "Iyer", "Kapoor", "Nair", "Reddy", "Mehta", "Bose", "Grewal", "Deshmukh", "Pillai",
    "Chatterjee", "Malhotra", "Rao", "Joshi", "Sethi", "Varma", "Banerjee", "Patel", "Gupta", "Menon",
]

BRAND_A = [
    "Lumen", "Verve", "Aura", "Nova", "Cadence", "Studio", "Atelier", "Meridian", "Halo", "Onyx",
    "Bloom", "Vantage", "Kalon", "Serene", "Prism", "Ivory", "Kindred", "Solace",
]
BRAND_B = [
    "Beauty Lab", "Grooming Co", "Salon Collective", "Wellness Studio", "Hair Atelier",
    "Skin Clinic", "Spa House", "Style Room", "Glow Bar", "Care Studio",
]

CATEGORIES = {
    "Hair": [
        ("Signature haircut & finish", 60, 1200),
        ("Global hair colour", 150, 4800),
        ("Keratin smoothing", 180, 7500),
        ("Scalp therapy treatment", 75, 2600),
        ("Blow-dry & styling", 45, 900),
    ],
    "Skin": [
        ("Hydrating facial", 75, 2400),
        ("Chemical peel session", 60, 3900),
        ("Acne clarifying facial", 90, 3100),
        ("LED rejuvenation", 45, 2800),
    ],
    "Nails": [
        ("Classic manicure", 45, 800),
        ("Gel extensions", 105, 2900),
        ("Spa pedicure", 60, 1400),
    ],
    "Spa & Massage": [
        ("Deep tissue massage", 90, 3400),
        ("Aromatherapy full body", 75, 2900),
        ("Hot stone therapy", 90, 3800),
    ],
    "Makeup": [
        ("Party makeup", 90, 3500),
        ("Bridal makeup package", 240, 18500),
        ("Editorial makeup session", 120, 6500),
    ],
    "Grooming": [
        ("Beard sculpt & shave", 45, 700),
        ("Men's hair & beard combo", 75, 1500),
        ("Detan & cleanup", 40, 950),
    ],
}

SPECIALTIES = [
    "Balayage", "Bridal styling", "Curly hair specialist", "Medical-grade facials", "Nail art",
    "Sports massage", "Editorial makeup", "Men's grooming", "Colour correction", "Ayurvedic therapy",
]

PORTFOLIO_IMAGES = [
    "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=640&q=70",
    "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=640&q=70",
    "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=640&q=70",
    "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?auto=format&fit=crop&w=640&q=70",
    "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=640&q=70",
    "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=640&q=70",
]

DOC_TYPES = [
    ("Government photo ID", "identity", "aadhaar-front-back.pdf"),
    ("Cosmetology licence", "licence", "state-cosmetology-licence.pdf"),
    ("Business registration", "business", "gst-registration-certificate.pdf"),
    ("Liability insurance", "insurance", "professional-indemnity-policy.pdf"),
    ("Background check consent", "compliance", "bgv-consent-signed.pdf"),
    ("Bank account proof", "finance", "cancelled-cheque.jpg")
]

AGENTS = ["Nadia Farooqui", "Tomas Vega", "Priya Balan", "Owen Whitaker", "Chitra Menon"]

TODAY = date.today()


def iso_date(days_offset: int) -> str:
    return (TODAY + timedelta(days=days_offset)).isoformat()


def iso_dt(days_offset: int, hour: int = 10) -> str:
    base = datetime.combine(TODAY + timedelta(days=days_offset), datetime.min.time())
    return base.replace(hour=hour, minute=RNG.randint(0, 59), tzinfo=timezone.utc).isoformat(
        timespec="seconds"
    )


def iso_hours_ago(hours: float) -> str:
    """Timestamp `hours` in the past — lets seeded applications land on both sides
    of the 48h verification SLA so the queue shows on-track/at-risk/breached."""
    return (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat(timespec="seconds")


def person() -> str:
    return f"{RNG.choice(FIRST)} {RNG.choice(LAST)}"


def weighted(options):
    values = [o[0] for o in options]
    weights = [o[1] for o in options]
    return RNG.choices(values, weights=weights, k=1)[0]


def build_customers(n=240):
    rows = []
    for i in range(n):
        name = person()
        handle = name.lower().replace(" ", ".")
        bookings = RNG.randint(0, 42)
        rows.append(
            Customer(
                code=f"CUS-{4100 + i}",
                name=name,
                email=f"{handle}{RNG.randint(11, 99)}@mail.example",
                phone=f"+91 9{RNG.randint(100000000, 999999999)}",
                city=RNG.choice(CITIES),
                segment=weighted([("Standard", 60), ("Frequent", 25), ("VIP", 10), ("At risk", 5)]),
                status=weighted([("active", 76), ("pending", 10), ("suspended", 8), ("dormant", 6)]),
                bookings_count=bookings,
                total_spent=round(bookings * RNG.uniform(900, 4200), 2),
                avg_rating_given=round(RNG.uniform(3.2, 5.0), 1),
                joined_at=iso_date(-RNG.randint(5, 900)),
                last_active=iso_date(-RNG.randint(0, 60)),
            ).model_dump()
        )
    return rows


def build_partners(n=120):
    rows = []
    for i in range(n):
        business = f"{RNG.choice(BRAND_A)} {RNG.choice(BRAND_B)}"
        cats = RNG.sample(list(CATEGORIES.keys()), RNG.randint(1, 3))
        jobs = RNG.randint(0, 620)
        rows.append(
            Partner(
                code=f"PTR-{2200 + i}",
                business_name=business,
                owner_name=person(),
                email=f"contact@{business.split()[0].lower()}{RNG.randint(2, 88)}.example",
                phone=f"+91 8{RNG.randint(100000000, 999999999)}",
                city=RNG.choice(CITIES),
                services=cats,
                rating=round(RNG.uniform(3.4, 5.0), 1),
                reviews_count=RNG.randint(0, 340),
                jobs_completed=jobs,
                revenue=round(jobs * RNG.uniform(1100, 3800), 2),
                account_status=weighted(
                    [("active", 70), ("pending", 12), ("suspended", 10), ("deactivated", 8)]
                ),
                verification_status=weighted(
                    [("verified", 66), ("under_review", 14), ("pending", 12), ("rejected", 8)]
                ),
                joined_at=iso_date(-RNG.randint(10, 1100)),
                bio=(
                    f"{business} operates a {RNG.choice(['boutique', 'multi-chair', 'at-home', 'flagship'])} "
                    f"studio serving {RNG.choice(CITIES)} with a team of {RNG.randint(2, 18)} certified "
                    f"professionals across {', '.join(cats).lower()} services."
                ),
            ).model_dump()
        )
    return rows


def build_services():
    rows = []
    for category, items in CATEGORIES.items():
        for name, duration, price in items:
            rows.append(
                ServiceItem(
                    name=name,
                    category=category,
                    description=(
                        f"{name} delivered by verified {category.lower()} specialists, including "
                        f"consultation, service delivery and aftercare guidance."
                    ),
                    duration_min=duration,
                    base_price=float(price),
                    commission_pct=round(RNG.choice([12.0, 15.0, 18.0, 20.0]), 1),
                    partners_count=RNG.randint(4, 68),
                    bookings_count=RNG.randint(20, 1400),
                    enabled=RNG.random() > 0.15,
                    updated_at=iso_dt(-RNG.randint(1, 120)),
                ).model_dump()
            )
    return rows


def build_applications(partners, n=16):
    statuses = [
        ("pending", 6),
        ("under_review", 4),
        ("correction_requested", 2),
        ("verified", 2),
        ("rejected", 2),
    ]
    pool = []
    for status, count in statuses:
        pool.extend([status] * count)
    RNG.shuffle(pool)

    rows = []
    for i, status in enumerate(pool[:n]):
        business = f"{RNG.choice(BRAND_A)} {RNG.choice(BRAND_B)}"
        city = RNG.choice(CITIES)
        cats = RNG.sample(list(CATEGORIES.keys()), RNG.randint(2, 3))
        services = []
        for cat in cats:
            for name, duration, price in RNG.sample(CATEGORIES[cat], min(2, len(CATEGORIES[cat]))):
                services.append(
                    VerificationService(
                        name=name,
                        category=cat,
                        duration_min=duration,
                        price=float(price) * RNG.choice([0.9, 1.0, 1.15]),
                    )
                )

        if status == "verified":
            doc_statuses = ["verified"] * 6
        elif status == "rejected":
            doc_statuses = ["verified", "rejected", "verified", "pending", "rejected", "pending"]
        elif status == "under_review":
            doc_statuses = ["verified", "under_review", "under_review", "verified", "pending", "pending"]
        elif status == "correction_requested":
            doc_statuses = ["verified", "rejected", "under_review", "pending", "verified", "pending"]
        else:
            doc_statuses = ["pending"] * 6

        documents = [
            VerificationDocument(
                name=label,
                doc_type=kind,
                file_label=file_label,
                uploaded_at=iso_dt(-RNG.randint(2, 25)),
                status=doc_statuses[idx],
            )
            for idx, (label, kind, file_label) in enumerate(DOC_TYPES)
        ]

        notes = [
            VerificationNote(
                author="System",
                text="Application received and queued for compliance review.",
                created_at=iso_dt(-RNG.randint(10, 25), 9),
                kind="system",
            )
        ]
        if status in ("under_review", "correction_requested", "verified", "rejected"):
            notes.append(
                VerificationNote(
                    author=RNG.choice(AGENTS),
                    text=RNG.choice(
                        [
                            "Identity document matches the business registration name. Proceeding to licence checks.",
                            "Called the owner to confirm studio address; line of business verified.",
                            "Insurance certificate is valid but expires in four months — flagged for re-verification.",
                        ]
                    ),
                    created_at=iso_dt(-RNG.randint(2, 9), 14),
                    kind="note",
                )
            )

        rows.append(
            Application(
                code=f"APP-{9100 + i}",
                business_name=business,
                owner_name=person(),
                email=f"apply@{business.split()[0].lower()}{RNG.randint(2, 99)}.example",
                phone=f"+91 7{RNG.randint(100000000, 999999999)}",
                city=city,
                address=f"{RNG.randint(2, 190)} {RNG.choice(['Linking Rd', 'MG Rd', 'Park Street', 'Sector 29', 'Jubilee Hills'])}, {city}",
                business_reg_no=f"REG-{RNG.randint(10000000, 99999999)}",
                tax_id=f"{RNG.randint(10, 37)}ABCDE{RNG.randint(1000, 9999)}F1Z{RNG.randint(1, 9)}",
                license_no=f"CSM-{RNG.randint(100000, 999999)}",
                experience_years=RNG.randint(1, 22),
                team_size=RNG.randint(1, 16),
                specialties=RNG.sample(SPECIALTIES, RNG.randint(2, 4)),
                services=services,
                portfolio=RNG.sample(PORTFOLIO_IMAGES, 4),
                documents=documents,
                notes=notes,
                checklist={
                    "identity_verified": status in ("verified", "under_review"),
                    "licence_validated": status == "verified",
                    "address_confirmed": status in ("verified", "under_review", "correction_requested"),
                    "bank_details_matched": status == "verified",
                    "background_check_clear": status == "verified",
                },
                status=status,
                priority=weighted([("high", 3), ("medium", 5), ("low", 2)]),
                submitted_at=iso_hours_ago(
                    RNG.choice([4.0, 9.0, 20.0, 27.0, 38.0, 44.0, 52.0, 71.0, 96.0, 150.0, 260.0, 420.0])
                ),
                updated_at=iso_dt(-RNG.randint(0, 3), 16),
                decision_reason=(
                    "Licence number could not be validated with the issuing board."
                    if status == "rejected"
                    else ""
                ),
            ).model_dump()
        )
    return rows


def build_bookings(customers, partners, services, n=340):
    rows = []
    for i in range(n):
        customer = RNG.choice(customers)
        partner = RNG.choice(partners)
        service = RNG.choice(services)
        offset = RNG.randint(-150, 30)
        if offset < -1:
            status = weighted([("completed", 78), ("cancelled", 14), ("disputed", 8)])
        elif offset <= 0:
            status = weighted([("in_progress", 60), ("completed", 40)])
        else:
            status = weighted([("upcoming", 88), ("cancelled", 12)])

        payment_status = {
            "completed": weighted([("paid", 92), ("refunded", 8)]),
            "cancelled": weighted([("refunded", 70), ("failed", 30)]),
            "disputed": "on_hold",
            "in_progress": "authorised",
            "upcoming": weighted([("paid", 55), ("authorised", 45)]),
        }[status]

        amount = round(float(service["base_price"]) * RNG.choice([1.0, 1.0, 1.2, 0.9]), 2)
        rows.append(
            Booking(
                code=f"BKG-{70500 + i}",
                customer_name=customer["name"],
                partner_name=partner["business_name"],
                service_name=service["name"],
                category=service["category"],
                city=customer["city"],
                scheduled_date=iso_date(offset),
                scheduled_slot=RNG.choice(
                    ["09:00 – 10:30", "11:00 – 12:30", "13:30 – 15:00", "16:00 – 17:30", "18:30 – 20:00"]
                ),
                amount=amount,
                payment_status=payment_status,
                status=status,
                channel=weighted([("Customer app", 62), ("Web", 24), ("Ops console", 8), ("Partner app", 6)]),
                created_at=iso_dt(offset - RNG.randint(1, 20), RNG.randint(8, 20)),
                address=f"{RNG.randint(2, 240)} {RNG.choice(['Hill View Apartments', 'Palm Grove', 'Riverside Towers', 'Green Meadows'])}, {customer['city']}",
                notes=RNG.choice(
                    ["", "", "Customer requested a fragrance-free product line.", "Parking available at the rear gate.", "Repeat booking with the same stylist."]
                ),
            ).model_dump()
        )
    return rows


def build_payments(bookings):
    rows = []
    for i, booking in enumerate(bookings):
        if booking["payment_status"] == "authorised":
            status = "pending"
        elif booking["payment_status"] == "refunded":
            status = "refunded"
        elif booking["payment_status"] == "failed":
            status = "failed"
        elif booking["payment_status"] == "on_hold":
            status = "on_hold"
        else:
            status = "captured"

        amount = float(booking["amount"])
        fee = round(amount * RNG.choice([0.12, 0.15, 0.18]), 2)
        settlement = (
            weighted([("settled", 80), ("scheduled", 14), ("failed", 6)])
            if status == "captured"
            else "not_applicable"
        )
        rows.append(
            Payment(
                code=f"PAY-{50800 + i}",
                booking_code=booking["code"],
                customer_name=booking["customer_name"],
                partner_name=booking["partner_name"],
                amount=amount,
                platform_fee=fee,
                partner_payout=round(amount - fee, 2),
                method=weighted([("UPI", 44), ("Credit card", 24), ("Debit card", 14), ("Wallet", 10), ("Net banking", 8)]),
                status=status,
                settlement_status=settlement,
                created_at=booking["created_at"],
            ).model_dump()
        )
    return rows


def build_reviews(bookings, n=190):
    completed = [b for b in bookings if b["status"] == "completed"]
    rows = []
    positives = [
        "Excellent finish and spotless setup",
        "Punctual, professional and thorough",
        "Exactly the result I asked for",
        "Great consultation before starting",
    ]
    negatives = [
        "Arrived late and rushed the service",
        "Products used were not as described",
        "Result did not match the consultation",
    ]
    for i, booking in enumerate(RNG.sample(completed, min(n, len(completed)))):
        rating = weighted([(5, 46), (4, 28), (3, 12), (2, 8), (1, 6)])
        title = RNG.choice(positives) if rating >= 4 else RNG.choice(negatives)
        status = "published" if rating >= 3 else weighted([("flagged", 55), ("published", 25), ("removed", 20)])
        if RNG.random() < 0.08:
            status = "pending"
        rows.append(
            Review(
                code=f"REV-{31200 + i}",
                customer_name=booking["customer_name"],
                partner_name=booking["partner_name"],
                service_name=booking["service_name"],
                rating=rating,
                title=title,
                body=(
                    f"{title}. The {booking['service_name'].lower()} appointment in {booking['city']} "
                    f"{'met' if rating >= 4 else 'fell short of'} expectations and the follow-up guidance was "
                    f"{'clear' if rating >= 4 else 'limited'}."
                ),
                status=status,
                flagged_reason="Low rating auto-flag" if status == "flagged" else "",
                created_at=iso_dt(-RNG.randint(1, 120), RNG.randint(9, 21)),
            ).model_dump()
        )
    return rows


def build_tickets(bookings, n=48):
    subjects_support = [
        "Unable to reschedule an existing appointment",
        "Partner did not arrive at the scheduled slot",
        "Coupon code not applying at checkout",
        "Request to change registered phone number",
        "App crashes when uploading portfolio images",
    ]
    subjects_dispute = [
        "Refund requested for an incomplete service",
        "Charged twice for the same appointment",
        "Service quality dispute raised by customer",
        "Partner disputes a withheld payout",
    ]
    rows = []
    for i in range(n):
        kind = weighted([("support", 62), ("dispute", 38)])
        booking = RNG.choice(bookings)
        subject = RNG.choice(subjects_support if kind == "support" else subjects_dispute)
        status = weighted([("open", 30), ("in_progress", 26), ("waiting", 14), ("resolved", 22), ("closed", 8)])
        rows.append(
            Ticket(
                code=f"TKT-{60400 + i}",
                subject=subject,
                body=(
                    f"{subject}. Raised against booking {booking['code']} "
                    f"({booking['service_name']} with {booking['partner_name']} in {booking['city']}). "
                    f"Customer has been contacted through the in-app thread."
                ),
                kind=kind,
                category=RNG.choice(
                    ["Booking", "Payments", "Account", "Service quality", "Technical", "Payout"]
                ),
                requester_name=RNG.choice([booking["customer_name"], booking["partner_name"]]),
                requester_type=weighted([("Customer", 70), ("Partner", 30)]),
                priority=weighted([("urgent", 14), ("high", 26), ("medium", 40), ("low", 20)]),
                status=status,
                assignee=RNG.choice(AGENTS) if status != "open" else weighted([("Unassigned", 6), (RNG.choice(AGENTS), 4)]),
                amount_disputed=round(float(booking["amount"]), 2) if kind == "dispute" else 0.0,
                created_at=iso_dt(-RNG.randint(1, 60), RNG.randint(8, 20)),
                updated_at=iso_dt(-RNG.randint(0, 5), RNG.randint(8, 20)),
            ).model_dump()
        )
    return rows


def build_offers(n=20):
    titles = [
        ("Monsoon hair care week", "percent", 20),
        ("First booking welcome credit", "flat", 300),
        ("Bridal package advance saver", "percent", 12),
        ("Weekday spa hours", "percent", 25),
        ("Refer a friend reward", "flat", 250),
        ("Men's grooming combo", "percent", 15),
        ("Festive glow bundle", "percent", 30),
        ("Loyalty tier top-up", "flat", 500),
    ]
    rows = []
    for i in range(n):
        title, dtype, value = titles[i % len(titles)]
        start_offset = RNG.randint(-120, 40)
        end_offset = start_offset + RNG.randint(10, 90)
        if start_offset > 0:
            status = "scheduled"
        elif end_offset < 0:
            status = "expired"
        else:
            status = weighted([("active", 80), ("paused", 20)])
        limit = RNG.choice([250, 500, 1000, 2500])
        rows.append(
            Offer(
                code=f"GMO{RNG.choice(['GLOW', 'CARE', 'SPA', 'HAIR', 'NEW'])}{RNG.randint(10, 99)}",
                title=f"{title} {2025 + (i % 2)}",
                description=f"{title} promotion applied automatically at checkout for eligible bookings.",
                discount_type=dtype,
                discount_value=float(value),
                min_order=float(RNG.choice([0, 500, 999, 1500, 2500])),
                audience=weighted(
                    [("All customers", 5), ("New customers", 3), ("VIP segment", 2), ("Lapsed customers", 2)]
                ),
                starts_at=iso_date(start_offset),
                ends_at=iso_date(end_offset),
                usage_count=RNG.randint(0, limit),
                usage_limit=limit,
                status=status,
            ).model_dump()
        )
    return rows


def build_notifications():
    items = [
        ("Verification queue above threshold", "12 partner applications have been waiting longer than 48 hours.", "Verification", "warning"),
        ("Payout batch returned", "3 partner payouts failed settlement and require updated bank details.", "Payments", "critical"),
        ("New dispute escalated", "A service-quality dispute crossed the 24-hour first-response target.", "Support", "critical"),
        ("Weekly operations digest ready", "Bookings, revenue and partner performance summary for last week.", "Reports", "info"),
        ("Coupon nearing usage limit", "Festive glow bundle has consumed 92% of its allocated redemptions.", "Marketing", "warning"),
        ("Partner licences expiring", "14 verified partners hold licences expiring within 30 days.", "Compliance", "warning"),
        ("Review moderation backlog cleared", "All auto-flagged reviews from last week have been actioned.", "Reviews", "success"),
        ("New city launched", "Kochi onboarding completed with 18 verified partners live.", "Growth", "success"),
        ("Security policy updated", "Two-factor authentication is now enforced for all admin roles.", "Security", "info"),
        ("Scheduled maintenance window", "Payments settlement service maintenance on Sunday 02:00–04:00 UTC.", "Platform", "info"),
        ("Capacity alert", "Weekend bridal slots are at 92% utilisation across metro cities.", "Operations", "warning"),
        ("Refund threshold exceeded", "Refund rate for the Spa category exceeded 6% this month.", "Payments", "warning"),
    ]
    return [
        Notification(
            title=title,
            body=body,
            category=category,
            severity=severity,
            created_at=iso_dt(-i, RNG.randint(7, 20)),
            read=i > 4,
        ).model_dump()
        for i, (title, body, category, severity) in enumerate(items)
    ]


def build_roles():
    return [
        RoleItem(
            name="Super Admin",
            description="Unrestricted access to every module, including platform configuration and role management.",
            members=2,
            permissions=["All modules", "Role management", "Platform config", "Payout approval", "Data export"],
        ).model_dump(),
        RoleItem(
            name="Operations Manager",
            description="Manages bookings, partners and the verification queue without financial settlement rights.",
            members=6,
            permissions=["Bookings", "Partners", "Verification", "Services", "Reviews"],
        ).model_dump(),
        RoleItem(
            name="Verification Analyst",
            description="Reviews partner applications and document compliance; can approve or request corrections.",
            members=4,
            permissions=["Verification", "Partners (read)", "Document review", "Notes"],
        ).model_dump(),
        RoleItem(
            name="Finance Controller",
            description="Owns payments, payouts, refunds and settlement reconciliation.",
            members=3,
            permissions=["Payments", "Payouts", "Refunds", "Reports", "Data export"],
        ).model_dump(),
        RoleItem(
            name="Support Agent",
            description="Handles support tickets and disputes with limited read access to customer records.",
            members=11,
            permissions=["Support & Disputes", "Customers (read)", "Bookings (read)"],
        ).model_dump(),
        RoleItem(
            name="Marketing Analyst",
            description="Creates offers and coupons and reads analytics dashboards.",
            members=3,
            permissions=["Offers & Coupons", "Analytics", "Notifications"],
        ).model_dump(),
    ]


def build_audit(customers, partners, applications, bookings, payments, offers, services, n=180):
    """Backfill a believable admin history so the audit log has depth on day one."""
    actors = [
        ("Rehana Qureshi", "Super Admin"),
        ("Nadia Farooqui", "Verification Analyst"),
        ("Tomas Vega", "Operations Manager"),
        ("Priya Balan", "Support Agent"),
        ("Owen Whitaker", "Finance Controller"),
        ("Chitra Menon", "Marketing Analyst"),
    ]

    templates = [
        ("verification.approve", "Approved partner application", "application", "info"),
        ("verification.reject", "Rejected application", "application", "warning"),
        ("verification.request_correction", "Requested correction", "application", "warning"),
        ("verification.document_verified", "Marked document verified", "application", "info"),
        ("verification.note_added", "Added an admin note", "application", "info"),
        ("partners.account_status_changed", "Set account status to suspended", "partners", "warning"),
        ("partners.verification_status_changed", "Set verification status to verified", "partners", "info"),
        ("customers.status_changed", "Set status to suspended", "customers", "warning"),
        ("customers.segment_changed", "Set segment to VIP", "customers", "info"),
        ("bookings.status_changed", "Set status to cancelled", "bookings", "warning"),
        ("payments.status_changed", "Set status to refunded", "payments", "warning"),
        ("payments.settlement_status_changed", "Set settlement status to settled", "payments", "info"),
        ("reviews.status_changed", "Set status to removed", "reviews", "warning"),
        ("offers.status_changed", "Set status to paused", "offers", "warning"),
        ("offers.created", "Created coupon", "offers", "info"),
        ("services.enabled_changed", "Set enabled to disabled", "services", "warning"),
        ("services.created", "Created service", "services", "info"),
        ("settings.platform_updated", "Updated platform configuration", "settings", "info"),
        ("customers.exported", "Exported customers to CSV", "customers", "info"),
        ("auth.signed_in", "Signed in to the console", "admin", "info"),
    ]

    details = {
        "verification.reject": "Licence number could not be validated with the issuing board.",
        "verification.request_correction": "Insurance certificate was illegible — asked for a clearer scan.",
        "partners.account_status_changed": "Repeated late arrivals reported by three customers.",
        "customers.status_changed": "Chargeback pattern flagged by the payments team.",
        "bookings.status_changed": "Partner unavailable; customer offered a full refund.",
        "payments.status_changed": "Service not delivered — refund authorised by finance.",
        "reviews.status_changed": "Contained personal contact details.",
        "settings.platform_updated": "commission 15.0% · payout Weekly · 2FA on · maintenance off",
    }

    rows = []
    for i in range(n):
        action, label, entity_type, severity = RNG.choice(templates)
        actor_name, actor_role = RNG.choice(actors)

        if entity_type == "application":
            src = RNG.choice(applications)
            entity_label, entity_id = f"{src['code']} · {src['business_name']}", src["id"]
        elif entity_type == "partners":
            src = RNG.choice(partners)
            entity_label, entity_id = src["business_name"], src["id"]
        elif entity_type == "customers":
            src = RNG.choice(customers)
            entity_label, entity_id = src["name"], src["id"]
        elif entity_type == "bookings":
            src = RNG.choice(bookings)
            entity_label, entity_id = src["code"], src["id"]
        elif entity_type == "payments":
            src = RNG.choice(payments)
            entity_label, entity_id = src["code"], src["id"]
        elif entity_type == "offers":
            src = RNG.choice(offers)
            entity_label, entity_id = src["code"], src["id"]
        elif entity_type == "services":
            src = RNG.choice(services)
            entity_label, entity_id = src["name"], src["id"]
        elif entity_type == "settings":
            entity_label, entity_id = "Platform configuration", ""
        else:
            entity_label, entity_id = actor_name, ""

        if action == "customers.exported":
            entity_label = f"{RNG.randint(25, 240)} rows"

        rows.append(
            {
                "id": new_id(),
                "at": iso_dt(-RNG.randint(0, 45), RNG.randint(7, 21)),
                "actor_name": actor_name,
                "actor_role": actor_role,
                "action": action,
                "action_label": label,
                "entity_type": entity_type,
                "entity_label": entity_label,
                "entity_id": entity_id,
                "detail": details.get(action, ""),
                "severity": severity,
            }
        )

    rows.sort(key=lambda r: r["at"], reverse=True)
    return rows


async def main() -> None:
    print("Seeding GlowMeOut admin data …")

    customers = build_customers()
    partners = build_partners()
    services = build_services()
    applications = build_applications(partners)
    bookings = build_bookings(customers, partners, services)
    payments = build_payments(bookings)
    reviews = build_reviews(bookings)
    tickets = build_tickets(bookings)
    offers = build_offers()
    notifications = build_notifications()
    roles = build_roles()
    audit_log = build_audit(customers, partners, applications, bookings, payments, offers, services)

    # a few applications should map onto real partner records for the approve flow
    for app_row, partner in zip(applications[:6], partners[:6]):
        app_row["business_name"] = partner["business_name"]
        app_row["city"] = partner["city"]

    collections = {
        "customers": customers,
        "partners": partners,
        "services": services,
        "applications": applications,
        "bookings": bookings,
        "payments": payments,
        "reviews": reviews,
        "tickets": tickets,
        "offers": offers,
        "notifications": notifications,
        "roles": roles,
        "audit_log": audit_log,
    }

    for name, rows in collections.items():
        await db[name].delete_many({})
        if rows:
            await db[name].insert_many(rows)
        await db[name].create_index("id")
        print(f"  {name:<15} {len(rows):>5} records")

    await db.settings.update_one(
        {"key": "platform"},
        {"$set": {"key": "platform", **PlatformSettings().model_dump()}},
        upsert=True,
    )

    await db.admin_sessions.delete_many({})
    email = DEMO_ADMIN["email"].lower()
    await db.admins.delete_many({})
    await db.admins.insert_one(
        {
            "id": new_id(),
            "name": DEMO_ADMIN["name"],
            "email": email,
            "role": DEMO_ADMIN["role"],
            "title": DEMO_ADMIN["title"],
            "avatar_url": "",
            "last_login": None,
            "password_hash": hash_password(DEMO_ADMIN["password"]),
        }
    )
    print(f"  admin           {email} / {DEMO_ADMIN['password']}")
    print("Seed complete.")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
