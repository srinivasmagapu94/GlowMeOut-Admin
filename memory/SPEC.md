# GlowMeOut Admin — living spec

Enterprise operations console for the GlowMeOut beauty & wellness marketplace.
Desktop-primary admin web app. React 19 + Vite + Tailwind v4 + shadcn/ui frontend,
FastAPI + MongoDB backend, all data over `/api`.

## Auth

- Email + password, single seeded admin. Session is an **httpOnly cookie**
  (`gmo_admin_session`); no tokens in JSON, no tokens in the frontend.
- Routes: `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`.
- Frontend: `src/lib/session.ts` owns login/logout and the react-query cache;
  `RequireAuth` guards every console route and redirects to `/login`.
- Credentials are in `memory/test_credentials.md`.

## Navigation (13 sections)

Dashboard, Customers, Partners, Partner Verification, Services, Bookings, Payments,
Reviews, Support & Disputes, Offers & Coupons, Analytics, Notifications, Settings.
Collapsible navy sidebar (248px / 68px, persisted in `localStorage`), sticky topbar
with breadcrumb, global search, notification bell (unread count) and profile menu.

## Data model (Mongo collections; string `uuid4` ids, never ObjectId)

| Collection | Notes |
|---|---|
| `admins` | seeded admin, `password_hash` = pbkdf2 |
| `admin_sessions` | session tokens + `expires_at` |
| `customers` (240) | code, name, email, phone, city, segment, status, bookings_count, total_spent, joined_at |
| `partners` (120) | code, business_name, owner_name, city, services[], rating, jobs_completed, revenue, account_status, verification_status |
| `applications` (16) | verification queue: documents[], notes[], checklist{}, services[], portfolio[], status, priority |
| `services` (21) | name, category, duration_min, base_price, commission_pct, enabled |
| `bookings` (340) | code, customer_name, partner_name, service_name, category, scheduled_date, amount, payment_status, status |
| `payments` (340) | code, booking_code, amount, platform_fee, partner_payout, method, status, settlement_status |
| `reviews` (190) | rating 1–5, title, body, status (published/pending/flagged/removed) |
| `tickets` (48) | support + dispute, priority, status, assignee, amount_disputed |
| `offers` (20) | code, discount_type, discount_value, starts_at, ends_at, usage_count/limit, status |
| `notifications` (12) | severity, category, read |
| `roles` (6) | name, description, members, permissions[] |
| `settings` | single `key: "platform"` document |

Seed: `cd /app/backend && python seed.py` (idempotent — wipes and rebuilds the
operational collections and the admin account).

## API surface

- **Generic resource router** (`backend/routers/resources.py`): a registry drives
  `GET /api/{resource}` (query params `q`, per-resource filters, `sort`, `dir`,
  `page`, `page_size`, plus `date_from`/`date_to` where a date field is configured),
  `GET /api/{resource}/facets` (distinct filter values), `GET /api/{resource}/{id}`,
  `PATCH /api/{resource}/{id}` (`{field, value}`, whitelisted per resource),
  `POST /api/{resource}/bulk` (`{ids, field, value}`), `DELETE` (services/offers/
  notifications only). Resources: customers, partners, services, bookings, payments,
  reviews, tickets, offers, notifications.
- **Typed creates**: `POST /api/services`, `POST /api/offers` (409 on duplicate code).
- **Verification** (`/api/verifications`): list + facets + `GET /{id}`,
  `POST /{id}/decision` (`approve` | `reject` | `request_correction`; reason required
  for the latter two, 400 otherwise), `PATCH /{id}/documents/{docId}`,
  `POST /{id}/notes`, `PATCH /{id}/checklist/{key}`. Approving also flips the matching
  partner record to verified/active.
- **Insights**: `GET /api/dashboard/summary`, `GET /api/analytics/overview?range&category`.
- **Settings**: `GET/PUT /api/settings/platform`, `GET /api/settings/roles`,
  `PUT /api/settings/profile`.

Route order in `server.py` matters: auth, insights, settings, verification, typed
creates, then the generic `/{resource}` catch-all last.

## Key flows

1. **Sign in** → `/dashboard`: KPI strip, revenue area chart, category donut, pending
   action queue, alerts, quick actions, activity feed.
2. **Management tables** (`DataTable` + `TableToolbar`): search, filter selects driven
   by real facets, sortable columns, zebra rows, selected-row state, numbered
   pagination + page-size selector. Bulk checkbox column + floating bulk action bar on
   Customers, Partners, Bookings, Reviews.
3. **Customer / Partner detail**: click a row → profile, metrics, recent bookings,
   reviews, account controls.
4. **Partner verification workspace** (`/partner-verification/:id`): 70/30 split.
   Left — partner info, professional info, services & pricing, portfolio (preview
   modal), documents with per-document status buttons. Right — status card with
   compliance progress, Approve / Request correction / Reject (reason dialog),
   interactive checklist, admin notes + audit timeline.
5. **Bookings / Support**: row click opens a detail Sheet with status actions.
6. **Settings**: tabbed — profile, roles & permissions, security, notifications,
   platform config (persisted).

## Audit log (`/audit`)

- Collection `audit_log` (180 backfilled historical entries + every live action).
  Fields: `at, actor_name, actor_role, action, action_label, entity_type, entity_label,
  entity_id, detail, severity`.
- `backend/lib/audit.py` exposes `record(...)`; it is called from every mutating route:
  resource PATCH / bulk / DELETE, service + coupon creation, all verification actions
  (decision, document status, note), settings platform + profile updates, CSV exports,
  and sign-in / sign-out.
- Served through the generic resource registry as `audit` with `editable=[]`, so
  `PATCH /api/audit/{id}` and `DELETE /api/audit/{id}` both return **400** — the log is
  append-only by design.

## Verification SLA

- 48h response target (`SLA_TARGET_HOURS`), at-risk from 36h (`routers/verification.py`).
- Computed on read, never stored: `age_hours`, `sla_state`
  (`breached` | `at_risk` | `on_track` | `closed`), `sla_due_in_hours`. Decided
  applications (verified/rejected) are `closed` and stop consuming SLA.
- Because SLA is computed, `GET /api/verifications` enriches the whole matching set then
  filters/sorts/slices in Python. Supports `sla_state=` filter and `sort=urgency`
  (breached → at risk → on track → closed, oldest first).
- UI: SLA column + filter + "Sort by urgency" on the queue; SLA card in the workspace.

## CSV export

- `GET /api/{resource}/export` — reuses `_build_filters()` so the file matches exactly
  what the table shows (search, filters, date range, sort); paging params are ignored and
  up to `EXPORT_LIMIT` (5000) rows are returned. Columns per resource come from
  `ResourceConfig.export_columns`. Responds `text/csv` with a `Content-Disposition`
  attachment filename. Requires a session (401 without one) and records an audit entry.
- Frontend: `src/lib/download.ts` `downloadCsv(resource, queryString)` — wired to
  Customers, Partners, Bookings, Payments and Audit. No longer mocked.

## Conventions

- Frontend calls only relative `/api` paths through `src/lib/api.ts`; all reads/writes
  go through TanStack Query and invalidate the affected key after a mutation.
- Every Pydantic model in `backend/models/schemas.py` has a hand-written mirror in
  `frontend/src/lib/types.ts` — change both in the same edit.
- Shared list state lives in `useTableState` (`src/lib/table.ts`).
- Status vocabularies map to five tones in `components/admin/StatusBadge.tsx`.
- Currency is INR; `.num` utility applies IBM Plex Mono + tabular numerals.
- No page is gated on a fetch — failed requests degrade to empty/skeleton regions so
  the static preview still renders the shell.
