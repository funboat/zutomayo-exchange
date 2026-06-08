import math
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import require_user
from app.models.notification import Notification
from app.models.user import User

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/")
async def list_notifications(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    q = select(Notification).where(Notification.user_id == user.id).order_by(Notification.created_at.desc())
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    total_pages = max(1, math.ceil(total / page_size))
    result = await db.execute(q.offset((page - 1) * page_size).limit(page_size))
    notifs = result.scalars().all()

    items = [{
        "id": n.id, "type": n.type, "content": n.content,
        "related_id": n.related_id, "is_read": n.is_read, "created_at": n.created_at,
    } for n in notifs]

    return {"items": items, "total": total, "page": page, "page_size": page_size, "total_pages": total_pages}


@router.get("/unread-count")
async def unread_count(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    q = select(func.count()).select_from(Notification).where(
        Notification.user_id == user.id, Notification.is_read == False
    )
    count = (await db.execute(q)).scalar()
    return {"count": count}


@router.get("/{notif_id}")
async def get_notification(
    notif_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    n = await db.get(Notification, notif_id)
    if not n or n.user_id != user.id:
        return {"detail": "通知不存在"}
    return {
        "id": n.id, "type": n.type, "content": n.content,
        "related_id": n.related_id, "is_read": n.is_read, "created_at": n.created_at,
    }


@router.put("/{notif_id}/read")
async def mark_read(
    notif_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    n = await db.get(Notification, notif_id)
    if n and n.user_id == user.id:
        n.is_read = True
        await db.flush()
    return {"detail": "ok"}


@router.put("/read-all")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    await db.execute(
        update(Notification).where(Notification.user_id == user.id).values(is_read=True)
    )
    await db.flush()
    return {"detail": "ok"}
