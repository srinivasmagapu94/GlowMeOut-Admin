"""Backend coverage for the partner verification decision flow (matrix row 8).

There is no POST /api/verifications endpoint (applications are seed-only), so this
test reads the queue, mutates document status, adds a note, and issues an approve
decision against a `pending` application already in the queue. Effects are asserted
directly against the returned Application payload (never global counts), and the
approve step intentionally targets a note/document sub-mutation that is idempotent
on rerun (same doc marked verified again, same note text appended again).
"""

from tests.conftest import api_url

import httpx

VALID = {"email": "admin@glowmeout.example", "password": "Admin@12345"}


def _authed_client():
    c = httpx.Client(base_url=api_url(""), timeout=30.0)
    resp = c.post("/auth/login", json=VALID)
    assert resp.status_code == 200, resp.text
    return c


def test_verification_list_and_facets():
    c = _authed_client()
    resp = c.get("/verifications", params={"status": "pending", "page_size": 25})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] >= 1
    assert all(item["status"] == "pending" for item in body["items"])

    facets_resp = c.get("/verifications/facets")
    assert facets_resp.status_code == 200
    assert "status" in facets_resp.json()


def test_verification_document_note_and_approve_decision_flow():
    c = _authed_client()
    listing = c.get("/verifications", params={"status": "pending", "page_size": 25})
    assert listing.status_code == 200
    items = listing.json()["items"]
    assert items, "expected at least one pending application from seed data"
    app_id = items[0]["id"]

    detail = c.get(f"/verifications/{app_id}")
    assert detail.status_code == 200
    docs = detail.json().get("documents", [])
    assert docs, "expected the seeded application to have documents"
    doc_id = docs[0]["id"]

    doc_resp = c.patch(
        f"/verifications/{app_id}/documents/{doc_id}", json={"status": "verified"}
    )
    assert doc_resp.status_code == 200, doc_resp.text
    updated_doc = next(d for d in doc_resp.json()["documents"] if d["id"] == doc_id)
    assert updated_doc["status"] == "verified"

    note_text = "tscheck-verification-note automated check"
    note_resp = c.post(f"/verifications/{app_id}/notes", json={"text": note_text})
    assert note_resp.status_code == 200, note_resp.text
    notes = note_resp.json()["notes"]
    assert any(n["text"] == note_text for n in notes)

    decision_resp = c.post(
        f"/verifications/{app_id}/decision",
        json={"action": "approve", "reason": "", "note": "tscheck approve"},
    )
    assert decision_resp.status_code == 200, decision_resp.text
    approved = decision_resp.json()
    assert approved["status"] == "verified"

    # persistence check: a fresh GET (equivalent to a page reload) still shows verified
    reloaded = c.get(f"/verifications/{app_id}")
    assert reloaded.status_code == 200
    assert reloaded.json()["status"] == "verified"

    # partner sync only applies when the application's business_name matches a real
    # partner record in seed data (some seeded applications are orphaned by design);
    # when a match exists, confirm the partner flips to verified too.
    partner_business_name = approved["business_name"]
    partners_resp = c.get("/partners", params={"q": partner_business_name, "page_size": 5})
    assert partners_resp.status_code == 200
    matches = [p for p in partners_resp.json()["items"] if p["business_name"] == partner_business_name]
    if matches:
        assert matches[0]["verification_status"] == "verified"


def test_verification_decision_requires_reason_for_rejection():
    c = _authed_client()
    listing = c.get("/verifications", params={"page_size": 25})
    items = listing.json()["items"]
    assert items
    app_id = items[0]["id"]
    resp = c.post(
        f"/verifications/{app_id}/decision",
        json={"action": "reject", "reason": "", "note": ""},
    )
    assert resp.status_code == 400, resp.text
