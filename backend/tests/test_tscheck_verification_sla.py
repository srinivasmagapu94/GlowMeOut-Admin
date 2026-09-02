"""Backend coverage for the Verification SLA feature.

Verifies:
- GET /api/verifications enriches every item with age_hours, sla_state and
  sla_due_in_hours.
- Decided applications (verified/rejected) are sla_state == "closed".
- sla_state= filter narrows the set and every item matches.
- sort=urgency orders breached first, oldest first.
"""

from tests.conftest import api_url

import httpx

VALID = {"email": "admin@glowmeout.example", "password": "Admin@12345"}

SLA_ORDER = {"breached": 0, "at_risk": 1, "on_track": 2, "closed": 3}


def _authed_client() -> httpx.Client:
    c = httpx.Client(base_url=api_url(""), timeout=30.0)
    resp = c.post("/auth/login", json=VALID)
    assert resp.status_code == 200, resp.text
    return c


def test_verifications_include_sla_fields():
    c = _authed_client()
    resp = c.get("/verifications", params={"page_size": 50})
    assert resp.status_code == 200, resp.text
    items = resp.json()["items"]
    assert len(items) >= 16
    for item in items:
        assert "age_hours" in item
        assert "sla_state" in item
        assert "sla_due_in_hours" in item
        assert item["sla_state"] in ("breached", "at_risk", "on_track", "closed")
        if item["status"] in ("verified", "rejected"):
            assert item["sla_state"] == "closed", item
    c.close()


def test_verifications_sla_state_filter():
    c = _authed_client()
    resp = c.get("/verifications", params={"sla_state": "breached", "page_size": 50})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] >= 1
    assert all(i["sla_state"] == "breached" for i in body["items"])
    c.close()


def test_verifications_sort_urgency_orders_breached_first():
    c = _authed_client()
    resp = c.get("/verifications", params={"sort": "urgency", "page_size": 50})
    assert resp.status_code == 200, resp.text
    items = resp.json()["items"]
    ranks = [SLA_ORDER[i["sla_state"]] for i in items]
    assert ranks == sorted(ranks), f"urgency sort not ordered breached-first: {ranks}"
    if items:
        assert items[0]["sla_state"] == "breached"
    c.close()
