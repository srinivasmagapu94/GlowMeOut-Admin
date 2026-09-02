"""Session-cookie auth for the admin console.

Sessions are httpOnly cookies; the token maps to a row in `admin_sessions`.
Passwords are pbkdf2_hmac hashes stored on the `admins` collection.
"""

from __future__ import annotations

import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import HTTPException, Request, Response

from lib.db import db

COOKIE_NAME = "gmo_admin_session"
SESSION_DAYS = 7
_ITERATIONS = 120_000


def hash_password(password: str, salt: Optional[str] = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), _ITERATIONS).hex()
    return f"pbkdf2${salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, salt, digest = stored.split("$")
    except ValueError:
        return False
    check = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), _ITERATIONS).hex()
    return secrets.compare_digest(check, digest)


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def create_session(response: Response, admin_id: str) -> str:
    token = secrets.token_urlsafe(32)
    await db.admin_sessions.insert_one(
        {
            "token": token,
            "admin_id": admin_id,
            "created_at": _now(),
            "expires_at": _now() + timedelta(days=SESSION_DAYS),
        }
    )
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=SESSION_DAYS * 24 * 3600,
        path="/",
    )
    return token


async def destroy_session(request: Request, response: Response) -> None:
    token = request.cookies.get(COOKIE_NAME)
    if token:
        await db.admin_sessions.delete_many({"token": token})
    response.delete_cookie(COOKIE_NAME, path="/")


async def current_admin(request: Request) -> Dict[str, Any]:
    """FastAPI dependency — resolves the signed-in admin or raises 401."""
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await db.admin_sessions.find_one({"token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Session expired")
    expires = session.get("expires_at")
    if isinstance(expires, datetime):
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires < _now():
            await db.admin_sessions.delete_many({"token": token})
            raise HTTPException(status_code=401, detail="Session expired")
    admin = await db.admins.find_one({"id": session["admin_id"]}, {"_id": 0, "password_hash": 0})
    if not admin:
        raise HTTPException(status_code=401, detail="Admin not found")
    return admin


DEMO_ADMIN = {
    "name": "Rehana Qureshi",
    "email": os.environ.get("SEED_ADMIN_EMAIL", "admin@glowmeout.example"),
    "password": os.environ.get("SEED_ADMIN_PASSWORD", "Admin@12345"),
    "role": "Super Admin",
    "title": "Head of Marketplace Operations",
}
