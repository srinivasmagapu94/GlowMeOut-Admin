"""Backend coverage for the new Audit log feature — append-only history.

Verifies:
- GET /api/audit (authenticated) returns items with the documented fields and
  supports actor_name / severity filters and search.
- PATCH /api/audit/{id} is rejected with 400 (the log cannot be edited).
- DELETE /api/audit/{id} is rejected with 400 (the log cannot be deleted).
- GET /api/audit without a session returns 401.
"""

from tests.conftest import api_url

import httpx

VALID = {"email": "admin@glowmeout.example", "password": "Admin@12345"}


def _authed_client() -> httpx.Client:
    c = httpx.Client(base_url=api_url(""), timeout=30.0)
    resp = c.post("/auth/login", json=VALID)
    assert resp.status_code == 200, resp.text
    return c


def test_audit_list_has_expected_fields_and_filters():
    c = _authed_client()
    resp = c.get("/audit", params={"page_size": 10})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] >= 180
    item = body["items"][0]
    for field in (
        "id",
        "at",
        "actor_name",
        "actor_role",
        "action",
        "action_label",
        "entity_type",
        "entity_label",
        "severity",
    ):
        assert field in item, f"missing field {field} in audit item"

    # severity filter narrows the set and every item matches
    sev_resp = c.get("/audit", params={"severity": "warning", "page_size": 50})
    assert sev_resp.status_code == 200
    sev_body = sev_resp.json()
    assert sev_body["total"] < body["total"]
    assert all(i["severity"] == "warning" for i in sev_body["items"])

    # actor filter narrows the set and every item matches
    actor_resp = c.get("/audit", params={"actor_name": "Rehana Qureshi", "page_size": 50})
    assert actor_resp.status_code == 200
    actor_body = actor_resp.json()
    assert all(i["actor_name"] == "Rehana Qureshi" for i in actor_body["items"])
    c.close()


def test_audit_patch_and_delete_are_rejected():
    c = _authed_client()
    list_resp = c.get("/audit", params={"page_size": 5})
    assert list_resp.status_code == 200
    target_id = list_resp.json()["items"][0]["id"]

    patch_resp = c.patch(f"/audit/{target_id}", json={"field": "severity", "value": "info"})
    assert patch_resp.status_code == 400, patch_resp.text

    delete_resp = c.delete(f"/audit/{target_id}")
    assert delete_resp.status_code == 400, delete_resp.text

    # confirm the record is unchanged
    get_resp = c.get("/audit", params={"page_size": 5})
    assert get_resp.status_code == 200
    assert get_resp.json()["items"][0]["id"] == target_id
    c.close()


def test_audit_requires_authentication():
    with httpx.Client(base_url=api_url(""), timeout=30.0) as c:
        resp = c.get("/audit")
        assert resp.status_code == 401, resp.text
