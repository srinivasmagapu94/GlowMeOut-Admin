"""Shared list-query helper: search + filters + sort + pagination over a motor collection."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Sequence

from models.schemas import Page


def build_query(
    q: Optional[str],
    search_fields: Sequence[str],
    filters: Dict[str, Any],
) -> Dict[str, Any]:
    conditions: List[Dict[str, Any]] = []

    if q:
        needle = re.escape(q.strip())
        if needle:
            conditions.append(
                {"$or": [{f: {"$regex": needle, "$options": "i"}} for f in search_fields]}
            )

    for field, value in filters.items():
        if value is None or value == "" or value == "all":
            continue
        if isinstance(value, dict):
            conditions.append({field: value})
        else:
            conditions.append({field: value})

    if not conditions:
        return {}
    return {"$and": conditions}


async def paginate(
    collection,
    *,
    query: Dict[str, Any],
    sort_field: str,
    sort_dir: str,
    page: int,
    page_size: int,
) -> Page:
    page = max(1, page)
    page_size = min(200, max(5, page_size))
    total = await collection.count_documents(query)
    direction = -1 if sort_dir == "desc" else 1
    cursor = (
        collection.find(query, {"_id": 0})
        .sort([(sort_field, direction), ("id", 1)])
        .skip((page - 1) * page_size)
        .limit(page_size)
    )
    items = await cursor.to_list(length=page_size)
    pages = max(1, (total + page_size - 1) // page_size)
    return Page(items=items, total=total, page=page, page_size=page_size, pages=pages)
