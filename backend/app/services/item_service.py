import math
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.models.item import Item
from app.models.user import User
from app.models.exchange_request import ExchangeRequest
from app.schemas.item import ItemCreate, ItemUpdate
from app.services.notification_service import create_notification
from app.services.category_service import get_valid_keys


async def list_items(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    category: str | None = None,
    status: str = "available",
    search: str | None = None,
    sort_by: str = "newest",
    owner_id: int | None = None,
    exchange_mode: str | None = None,
):
    q = select(Item).where(Item.status != "deleted")

    if status and status != "all":
        q = q.where(Item.status == status)
    if category:
        q = q.where(Item.category == category)
    if owner_id:
        q = q.where(Item.owner_id == owner_id)
    if exchange_mode:
        q = q.where(Item.exchange_mode == exchange_mode)
    if search:
        q = q.where(or_(Item.title.ilike(f"%{search}%"), Item.description.ilike(f"%{search}%")))

    if sort_by == "oldest":
        q = q.order_by(Item.created_at.asc())
    else:
        q = q.order_by(Item.created_at.desc())

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    total_pages = max(1, math.ceil(total / page_size))
    result = await db.execute(q.offset((page - 1) * page_size).limit(page_size))
    items = result.scalars().all()

    items_out = []
    for item in items:
        owner = await db.get(User, item.owner_id)
        items_out.append({
            "id": item.id,
            "title": item.title,
            "description": item.description,
            "images": item.images or [],
            "category": item.category,
            "status": item.status,
            "exchange_mode": item.exchange_mode,
            "owner_id": item.owner_id,
            "owner_nickname": owner.nickname if owner else None,
            "owner_avatar": owner.avatar if owner else None,
            "wanted_items": item.wanted_items,
            "stock": item.stock,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
        })

    return {"items": items_out, "total": total, "page": page, "page_size": page_size, "total_pages": total_pages}


async def get_item(db: AsyncSession, item_id: int):
    item = await db.get(Item, item_id)
    if not item or item.status == "deleted":
        raise HTTPException(404, "物品不存在")
    owner = await db.get(User, item.owner_id)
    return {
        "id": item.id,
        "title": item.title,
        "description": item.description,
        "images": item.images or [],
        "category": item.category,
        "status": item.status,
        "exchange_mode": item.exchange_mode,
        "owner_id": item.owner_id,
        "owner_nickname": owner.nickname if owner else None,
        "owner_avatar": owner.avatar if owner else None,
        "wanted_items": item.wanted_items,
        "stock": item.stock,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


async def create_item(db: AsyncSession, user_id: int, data: ItemCreate):
    valid_categories = await get_valid_keys(db)
    if data.category not in valid_categories:
        raise HTTPException(400, "無效的物品類別")

    valid_modes = {"reach_out", "swap"}
    if data.exchange_mode not in valid_modes:
        raise HTTPException(400, "無效的交換方式")

    item = Item(
        title=data.title,
        description=data.description,
        images=data.images,
        category=data.category,
        exchange_mode=data.exchange_mode,
        owner_id=user_id,
        wanted_items=data.wanted_items,
        stock=data.stock,
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return await get_item(db, item.id)


async def update_item(db: AsyncSession, item_id: int, user_id: int, data: ItemUpdate):
    item = await db.get(Item, item_id)
    if not item or item.status == "deleted":
        raise HTTPException(404, "物品不存在")
    if item.owner_id != user_id:
        raise HTTPException(403, "無權編輯此物品")

    update_data = data.model_dump(exclude_unset=True)
    if "category" in update_data:
        valid_categories = await get_valid_keys(db)
        if update_data["category"] not in valid_categories:
            raise HTTPException(400, "無效的物品類別")
    if "exchange_mode" in update_data and update_data["exchange_mode"] not in {"reach_out", "swap"}:
        raise HTTPException(400, "無效的交換方式")
    if "status" in update_data and update_data["status"] not in {"available", "reserved"}:
        raise HTTPException(400, "只能將狀態設為 available 或 reserved")
    if "stock" in update_data and update_data["stock"] is not None and update_data["stock"] < 0:
        raise HTTPException(400, "庫存不能為負數")

    for k, v in update_data.items():
        setattr(item, k, v)
    await db.flush()
    await db.refresh(item)
    return await get_item(db, item.id)


async def delete_item(db: AsyncSession, item_id: int, user_id: int, is_admin: bool = False, reason: str | None = None):
    item = await db.get(Item, item_id)
    if not item:
        raise HTTPException(404, "物品不存在")

    is_owner = item.owner_id == user_id
    if not is_owner and not is_admin:
        raise HTTPException(403, "無權刪除此物品")

    # Admin deleting others' items must provide a reason
    if not is_owner and is_admin and (not reason or not reason.strip()):
        raise HTTPException(400, "管理員刪除他人物品需提供理由")

    # Find affected exchanges: active (pending/accepted) + completed
    q = select(ExchangeRequest).where(
        ExchangeRequest.to_item_id == item_id,
        ExchangeRequest.status.in_(["pending", "accepted", "completed"])
    )
    result = await db.execute(q)
    affected_exchanges = result.scalars().all()

    # Notify affected users
    notified = set()
    for ex in affected_exchanges:
        if ex.from_user_id == item.owner_id or ex.from_user_id in notified:
            continue
        notified.add(ex.from_user_id)

        is_active = ex.status in ("pending", "accepted")
        if not is_owner:
            await create_notification(
                db, ex.from_user_id, "item_deleted",
                f"物品「{item.title}」已被管理員刪除。理由：{reason.strip()}", ex.id
            )
        elif is_active:
            await create_notification(
                db, ex.from_user_id, "item_deleted",
                f"你正在交換的物品「{item.title}」已被物主刪除", ex.id
            )
        else:
            await create_notification(
                db, ex.from_user_id, "item_deleted",
                f"你曾交換的物品「{item.title}」已被物主刪除", None
            )

    # If admin deleted another user's item, notify the owner
    if not is_owner and item.owner_id not in notified:
        notified.add(item.owner_id)
        await create_notification(
            db, item.owner_id, "item_deleted",
            f"你的物品「{item.title}」已被管理員刪除。理由：{reason.strip()}", None
        )

    item.status = "deleted"
    await db.flush()

    # Cancel active exchanges
    for ex in affected_exchanges:
        if ex.status in ("pending", "accepted"):
            ex.status = "cancelled"

    await db.flush()
    return {"detail": "已刪除", "notified": len(notified)}
