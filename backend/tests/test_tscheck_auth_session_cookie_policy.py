"""Backend coverage for the SameSite cookie fix (rows 1-4 of the acceptance matrix).

Verifies:
- POST /api/auth/login sets SameSite=None; Secure when the request looks like HTTPS
  (via X-Forwarded-Proto), so the cookie survives inside a cross-site iframe.
- Plain-HTTP localhost keeps SameSite=Lax with no Secure flag.
- The session cookie actually authenticates a subsequent GET /api/auth/me (200).
- No session -> GET /api/auth/me and GET /api/customers both return 401.
- Wrong credentials are rejected with 401 and no cookie is set.
"""

import os

from dotenv import dotenv_values

from tests.conftest import api_url

import httpx

VALID = {"email": "admin@glowmeout.example", "password": "Admin@12345"}

# The SameSite=None; Secure cookie can only be replayed by a client over a REAL TLS
# connection (http.cookiejar / real browsers both refuse to send a Secure cookie back
# over plain HTTP even if the login request claimed X-Forwarded-Proto: https). So the
# "does the cookie actually authenticate the next request" check must run against the
# real public HTTPS ingress, not localhost with a spoofed header.
_env_app_url = os.environ.get("APP_URL") or dotenv_values(
    os.path.join(os.path.dirname(__file__), "..", ".env")
).get("APP_URL", "")
PUBLIC_API_URL = _env_app_url.rstrip("/") + "/api"


def test_login_over_https_sets_samesite_none_secure():
    with httpx.Client(base_url=api_url(""), timeout=30.0) as c:
        resp = c.post("/auth/login", json=VALID, headers={"X-Forwarded-Proto": "https"})
        assert resp.status_code == 200, resp.text
        set_cookie = resp.headers.get("set-cookie", "")
        assert "gmo_admin_session" in set_cookie
        assert "samesite=none" in set_cookie.lower(), set_cookie
        assert "secure" in set_cookie.lower(), set_cookie


def test_login_over_plain_http_keeps_samesite_lax():
    with httpx.Client(base_url=api_url(""), timeout=30.0) as c:
        resp = c.post("/auth/login", json=VALID)
        assert resp.status_code == 200, resp.text
        set_cookie = resp.headers.get("set-cookie", "")
        assert "gmo_admin_session" in set_cookie
        assert "samesite=lax" in set_cookie.lower(), set_cookie


def test_session_cookie_authenticates_subsequent_me_call():
    with httpx.Client(base_url=PUBLIC_API_URL, timeout=30.0) as c:
        login_resp = c.post("/auth/login", json=VALID)
        assert login_resp.status_code == 200
        set_cookie = login_resp.headers.get("set-cookie", "")
        assert "samesite=none" in set_cookie.lower(), set_cookie
        me_resp = c.get("/auth/me")
        assert me_resp.status_code == 200, me_resp.text
        body = me_resp.json()
        assert body.get("email") == VALID["email"]


def test_unauthenticated_me_and_customers_return_401():
    with httpx.Client(base_url=api_url(""), timeout=30.0) as c:
        me_resp = c.get("/auth/me")
        assert me_resp.status_code == 401, me_resp.text
        customers_resp = c.get("/customers")
        assert customers_resp.status_code == 401, customers_resp.text


def test_wrong_password_rejected():
    with httpx.Client(base_url=api_url(""), timeout=30.0) as c:
        resp = c.post(
            "/auth/login",
            json={"email": VALID["email"], "password": "wrong-password-xyz"},
        )
        assert resp.status_code in (401, 400), resp.text
        assert "gmo_admin_session" not in resp.headers.get("set-cookie", "")


def test_logout_clears_session():
    with httpx.Client(base_url=PUBLIC_API_URL, timeout=30.0) as c:
        login_resp = c.post("/auth/login", json=VALID)
        assert login_resp.status_code == 200
        assert c.get("/auth/me").status_code == 200
        logout_resp = c.post("/auth/logout")
        assert logout_resp.status_code == 200, logout_resp.text
        after_resp = c.get("/auth/me")
        assert after_resp.status_code == 401, after_resp.text
