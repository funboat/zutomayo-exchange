import math
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.item import Item
from app.models.review import Review

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}")
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user or user.is_banned:
        return {"detail": "用戶不存在"}

    item_count = (await db.execute(
        select(func.count()).select_from(Item).where(Item.owner_id == user_id, Item.status != "deleted")
    )).scalar()

    avg_result = await db.execute(
        select(func.avg(Review.rating)).where(Review.reviewed_user_id == user_id)
    )
    avg_rating = avg_result.scalar()

    return {
        "id": user.id,
        "nickname": user.nickname,
        "avatar": user.avatar,
        "created_at": user.created_at,
        "item_count": item_count,
        "avg_rating": round(float(avg_rating), 1) if avg_rating else None,
    }


@router.get("/{user_id}/items")
async def get_user_items(
    user_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, le=100),
    db: AsyncSession = Depends(get_db),
):
    q = select(Item).where(Item.owner_id == user_id, Item.status != "deleted").order_by(Item.created_at.desc())
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    total_pages = max(1, math.ceil(total / page_size))
    result = await db.execute(q.offset((page - 1) * page_size).limit(page_size))
    items = result.scalars().all()

    items_out = []
    for item in items:
        owner = await db.get(User, item.owner_id)
        items_out.append({
            "id": item.id, "title": item.title, "description": item.description,
            "images": item.images or [], "category": item.category,
            "status": item.status, "exchange_mode": item.exchange_mode,
            "owner_id": item.owner_id,
            "owner_nickname": owner.nickname if owner else None,
            "owner_avatar": owner.avatar if owner else None,
            "wanted_items": item.wanted_items, "stock": item.stock,
            "created_at": item.created_at, "updated_at": item.updated_at,
        })

    return {"items": items_out, "total": total, "page": page, "page_size": page_size, "total_pages": total_pages}


@router.get("/{user_id}/reviews")
async def get_user_reviews(
    user_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, le=100),
    db: AsyncSession = Depends(get_db),
):
    q = select(Review).where(Review.reviewed_user_id == user_id).order_by(Review.created_at.desc())
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    total_pages = max(1, math.ceil(total / page_size))
    result = await db.execute(q.offset((page - 1) * page_size).limit(page_size))
    reviews = result.scalars().all()

    items = []
    for r in reviews:
        reviewer = await db.get(User, r.reviewer_id)
        items.append({
            "id": r.id, "rating": r.rating, "comment": r.comment,
            "reviewer_nickname": reviewer.nickname if reviewer else None,
            "created_at": r.created_at,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size, "total_pages": total_pages}
