"""Admin settings: profile, roles/permissions, platform configuration."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import current_admin
from lib.db import db
from models.schemas import AdminUser, PlatformSettings, RoleItem

router = APIRouter(prefix="/settings", dependencies=[Depends(current_admin)], tags=["settings"])

SETTINGS_KEY = "platform"


@router.get("/platform", response_model=PlatformSettings)
async def get_platform_settings():
    doc = await db.settings.find_one({"key": SETTINGS_KEY}, {"_id": 0, "key": 0})
    return PlatformSettings(**(doc or {}))


@router.put("/platform", response_model=PlatformSettings)
async def update_platform_settings(payload: PlatformSettings):
    await db.settings.update_one(
        {"key": SETTINGS_KEY}, {"$set": {"key": SETTINGS_KEY, **payload.model_dump()}}, upsert=True
    )
    return payload


@router.get("/roles", response_model=List[RoleItem])
async def list_roles():
    docs = await db.roles.find({}, {"_id": 0}).sort([("name", 1)]).to_list(length=50)
    return [RoleItem(**d) for d in docs]


@router.put("/profile", response_model=AdminUser)
async def update_profile(payload: AdminUser, admin=Depends(current_admin)):
    updates = {"name": payload.name, "title": payload.title}
    result = await db.admins.update_one({"id": admin["id"]}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Admin not found")
    doc = await db.admins.find_one({"id": admin["id"]}, {"_id": 0, "password_hash": 0})
    return AdminUser(**doc)
