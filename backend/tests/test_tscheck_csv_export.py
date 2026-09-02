"""Backend coverage for the CSV export feature.

Verifies:
- GET /api/{resource}/export requires a session (401 without one).
- With a session, it returns text/csv with a Content-Disposition attachment
  filename and honours the CURRENT filters while ignoring paging (capped at
  EXPORT_LIMIT rows), i.e. the export row count matches the filtered total,
  not a single page.
"""

from tests.conftest import api_url

import httpx

VALID = {"email": "admin@glowmeout.example", "password": "Admin@12345"}


def _authed_client() -> httpx.Client:
    c = httpx.Client(base_url=api_url(""), timeout=30.0)
    resp = c.post("/auth/login", json=VALID)
    assert resp.status_code == 200, resp.text
    return c


def test_export_requires_authentication():
    with httpx.Client(base_url=api_url(""), timeout=30.0) as c:
        resp = c.get("/customers/export")
        assert resp.status_code == 401, resp.text


def test_customers_export_matches_filtered_total_ignoring_paging():
    c = _authed_client()
    list_resp = c.get("/customers", params={"status": "active", "page_size": 25, "page": 1})
    assert list_resp.status_code == 200
    filtered_total = list_resp.json()["total"]
    assert filtered_total > 25, "expected the active-customer filter to exceed one page"

    export_resp = c.get("/customers/export", params={"status": "active", "page": 1, "page_size": 25})
    assert export_resp.status_code == 200, export_resp.text
    assert "text/csv" in export_resp.headers.get("content-type", "")
    assert "attachment" in export_resp.headers.get("content-disposition", "").lower()
    assert "glowmeout-customers-" in export_resp.headers.get("content-disposition", "")

    lines = [l for l in export_resp.text.strip().splitlines() if l]
    data_rows = len(lines) - 1
    assert data_rows == filtered_total, (
        f"export returned {data_rows} data rows but the filtered total is {filtered_total} "
        "(export should ignore paging and match the filter, not a single page)"
    )
    assert data_rows > 25
    c.close()


def test_audit_export_records_an_audit_entry():
    c = _authed_client()
    before = c.get("/audit", params={"page_size": 5}).json()["total"]
    export_resp = c.get("/audit/export")
    assert export_resp.status_code == 200, export_resp.text
    assert "text/csv" in export_resp.headers.get("content-type", "")
    after = c.get("/audit", params={"page_size": 5}).json()["total"]
    assert after > before, "CSV export itself should be recorded as an audit entry"
    c.close()
