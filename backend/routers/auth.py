"""Admin auth routes — httpOnly session cookie, no tokens in JSON."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from lib.audit import record
from lib.auth import create_session, current_admin, destroy_session, verify_password
from lib.db import db
from models.schemas import AdminUser, LoginRequest

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=AdminUser)
async def login(payload: LoginRequest, request: Request, response: Response):
    admin = await db.admins.find_one({"email": payload.email.strip().lower()})
    if not admin or not verify_password(payload.password, admin.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    last_login = datetime.now(timezone.utc).isoformat(timespec="seconds")
    await db.admins.update_one({"id": admin["id"]}, {"$set": {"last_login": last_login}})
    await create_session(request, response, admin["id"])
    admin["last_login"] = last_login
    await record(
        actor=admin,
        action="auth.signed_in",
        action_label="Signed in to the console",
        entity_type="admin",
        entity_label=admin.get("name", ""),
        entity_id=admin["id"],
    )
    return AdminUser(**{k: v for k, v in admin.items() if k not in ("_id", "password_hash")})


@router.get("/me", response_model=AdminUser)
async def me(admin=Depends(current_admin)):
    return AdminUser(**admin)


@router.post("/logout")
async def logout(request: Request, response: Response):
    # Resolve the admin BEFORE the session is destroyed so the entry has an actor.
    actor = None
    try:
        actor = await current_admin(request)
    except HTTPException:
        pass
    await destroy_session(request, response)
    if actor:
        await record(
            actor=actor,
            action="auth.signed_out",
            action_label="Signed out of the console",
            entity_type="admin",
            entity_label=actor.get("name", ""),
            entity_id=actor.get("id", ""),
        )
    return {"ok": True}
