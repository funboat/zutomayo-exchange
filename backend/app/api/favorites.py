import math
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import require_user
from app.models.favorite import Favorite
from app.models.item import Item
from app.models.user import User
from app.models.user import User as UserModel

router = APIRouter(prefix="/favorites", tags=["favorites"])


@router.get("/")
async def list_favorites(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, le=100),
    db: AsyncSession = Depends(get_db),
    user: UserModel = Depends(require_user),
):
    q = select(Favorite).where(Favorite.user_id == user.id).order_by(Favorite.created_at.desc())
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    total_pages = max(1, math.ceil(total / page_size))
    result = await db.execute(q.offset((page - 1) * page_size).limit(page_size))
    favs = result.scalars().all()

    items = []
    for fav in favs:
        item = await db.get(Item, fav.item_id)
        if item and item.status != "deleted":
            owner = await db.get(User, item.owner_id)
            items.append({
                "id": item.id, "title": item.title, "description": item.description,
                "images": item.images or [], "category": item.category,
                "status": item.status, "exchange_mode": item.exchange_mode,
                "owner_id": item.owner_id,
                "owner_nickname": owner.nickname if owner else None,
                "owner_avatar": owner.avatar if owner else None,
                "wanted_items": item.wanted_items, "stock": item.stock,
                "created_at": item.created_at, "updated_at": item.updated_at,
            })

    return {"items": items, "total": total, "page": page, "page_size": page_size, "total_pages": total_pages}


@router.post("/")
async def add_favorite(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: UserModel = Depends(require_user),
):
    item_id = data.get("item_id")
    existing = await db.execute(
        select(Favorite).where(Favorite.user_id == user.id, Favorite.item_id == item_id)
    )
    if existing.scalar_one_or_none():
        return {"detail": "已收藏"}

    fav = Favorite(user_id=user.id, item_id=item_id)
    db.add(fav)
    await db.flush()
    return {"detail": "已收藏"}


@router.delete("/{item_id}")
async def remove_favorite(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    user: UserModel = Depends(require_user),
):
    result = await db.execute(
        select(Favorite).where(Favorite.user_id == user.id, Favorite.item_id == item_id)
    )
    fav = result.scalar_one_or_none()
    if fav:
        await db.delete(fav)
        await db.flush()
    return {"detail": "已取消收藏"}


@router.get("/check/{item_id}")
async def check_favorite(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    user: UserModel = Depends(require_user),
):
    result = await db.execute(
        select(Favorite).where(Favorite.user_id == user.id, Favorite.item_id == item_id)
    )
    return {"is_favorited": result.scalar_one_or_none() is not None}
