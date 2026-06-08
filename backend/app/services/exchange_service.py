import math
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.models.exchange_request import ExchangeRequest
from app.models.item import Item
from app.models.user import User
from app.schemas.exchange import ExchangeCreate, CancelRequest
from app.services.notification_service import create_notification


def _deduct_stock(item, count=1):
    """Deduct item stock by count. Mark exchanged if stock exhausted."""
    if item and item.stock is not None and item.stock > 0:
        item.stock -= count
    if item and item.stock is not None and item.stock <= 0:
        item.status = "exchanged"


def _restore_stock(item, count=1):
    """Restore item stock by count."""
    if item and item.stock is not None:
        item.stock += count
        if item.status == "exchanged" and item.stock > 0:
            item.status = "available"


async def check_exchange_status(db: AsyncSession, user_id: int, item_id: int):
    q = (
        select(ExchangeRequest)
        .where(
            ExchangeRequest.from_user_id == user_id,
            ExchangeRequest.to_item_id == item_id,
            ExchangeRequest.status.in_(["pending", "accepted", "completed", "cancel_requested"]),
        )
        .order_by(ExchangeRequest.created_at.desc())
        .limit(1)
    )
    result = await db.execute(q)
    ex = result.scalar_one_or_none()
    return {"status": ex.status if ex else None}


async def create_exchange(db: AsyncSession, from_user_id: int, data: ExchangeCreate):
    to_item = await db.get(Item, data.to_item_id)
    if not to_item or to_item.status == "deleted":
        raise HTTPException(404, "物品不存在")
    if to_item.owner_id == from_user_id:
        raise HTTPException(400, "不能與自己交換")
    if to_item.status != "available":
        raise HTTPException(400, "此物品目前不可交換")
    if to_item.stock is not None and to_item.stock <= 0:
        raise HTTPException(400, "此物品已無庫存")

    # Validate exchange mode
    if to_item.exchange_mode == "swap":
        if not data.from_item_id:
            raise HTTPException(400, "此物品需要互換，請選擇你提供的物品")
        from_item = await db.get(Item, data.from_item_id)
        if not from_item or from_item.status == "deleted":
            raise HTTPException(404, "你提供的物品不存在")
        if from_item.owner_id != from_user_id:
            raise HTTPException(403, "你提供的物品不屬於你")
        if from_item.status != "available":
            raise HTTPException(400, "你提供的物品目前不可交換")
        if from_item.stock is not None and from_item.stock <= 0:
            raise HTTPException(400, "你提供的物品已無庫存")
    elif to_item.exchange_mode == "reach_out":
        if data.from_item_id:
            from_item = await db.get(Item, data.from_item_id)
            if not from_item or from_item.status == "deleted":
                raise HTTPException(404, "你提供的物品不存在")
            if from_item.owner_id != from_user_id:
                raise HTTPException(403, "你提供的物品不屬於你")

    # Check for existing active/completed exchange on this item
    dup = await db.execute(
        select(ExchangeRequest).where(
            ExchangeRequest.from_user_id == from_user_id,
            ExchangeRequest.to_item_id == data.to_item_id,
            ExchangeRequest.status.in_(["pending", "accepted", "completed", "cancel_requested"]),
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(400, "你已對此物品發起過交換請求")

    ex = ExchangeRequest(
        from_user_id=from_user_id,
        to_user_id=to_item.owner_id,
        from_item_id=data.from_item_id,
        to_item_id=data.to_item_id,
        message=data.message,
    )
    db.add(ex)

    # Deduct stock immediately on exchange creation
    _deduct_stock(to_item)
    if data.from_item_id:
        from_item = await db.get(Item, data.from_item_id)
        _deduct_stock(from_item)

    await db.flush()

    from_user = await db.get(User, from_user_id)
    mode_label = "伸手向你要" if to_item.exchange_mode == "reach_out" else "想與你交換"
    from_item_info = ""
    if data.from_item_id:
        fi = await db.get(Item, data.from_item_id)
        from_item_info = f"，提供「{fi.title}」" if fi else ""
    await create_notification(
        db, to_item.owner_id, "exchange_request",
        f"{from_user.nickname} {mode_label}「{to_item.title}」{from_item_info}", ex.id
    )

    return await get_exchange_detail(db, ex.id, from_user_id)


async def list_exchanges(db: AsyncSession, user_id: int, role: str | None = None, status: str | None = None, page: int = 1, page_size: int = 20):
    q = select(ExchangeRequest).where(
        or_(ExchangeRequest.from_user_id == user_id, ExchangeRequest.to_user_id == user_id)
    )
    if role == "sent":
        q = q.where(ExchangeRequest.from_user_id == user_id)
    elif role == "received":
        q = q.where(ExchangeRequest.to_user_id == user_id)
    if status:
        q = q.where(ExchangeRequest.status == status)

    q = q.order_by(ExchangeRequest.updated_at.desc())

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    total_pages = max(1, math.ceil(total / page_size))
    result = await db.execute(q.offset((page - 1) * page_size).limit(page_size))
    exchanges = result.scalars().all()

    items = []
    for ex in exchanges:
        items.append(await _format_exchange(db, ex))
    return {"items": items, "total": total, "page": page, "page_size": page_size, "total_pages": total_pages}


async def get_exchange_detail(db: AsyncSession, exchange_id: int, user_id: int):
    ex = await db.get(ExchangeRequest, exchange_id)
    if not ex:
        raise HTTPException(404, "交換請求不存在")
    if ex.from_user_id != user_id and ex.to_user_id != user_id:
        raise HTTPException(403, "無權查看")
    return await _format_exchange(db, ex)


async def _format_exchange(db: AsyncSession, ex: ExchangeRequest):
    from_user = await db.get(User, ex.from_user_id)
    to_user = await db.get(User, ex.to_user_id)
    to_item = await db.get(Item, ex.to_item_id)
    from_item = await db.get(Item, ex.from_item_id) if ex.from_item_id else None
    return {
        "id": ex.id,
        "from_user_id": ex.from_user_id,
        "from_user_nickname": from_user.nickname if from_user else None,
        "to_user_id": ex.to_user_id,
        "to_user_nickname": to_user.nickname if to_user else None,
        "from_item_id": ex.from_item_id,
        "from_item_title": from_item.title if from_item else None,
        "from_item_images": from_item.images if from_item else [],
        "to_item_id": ex.to_item_id,
        "to_item_title": to_item.title if to_item else None,
        "to_item_images": to_item.images if to_item else [],
        "from_item_exchange_mode": from_item.exchange_mode if from_item else None,
        "to_item_exchange_mode": to_item.exchange_mode if to_item else None,
        "status": ex.status,
        "message": ex.message,
        "cancel_reason": ex.cancel_reason,
        "cancel_requested_by": ex.cancel_requested_by,
        "created_at": ex.created_at,
        "updated_at": ex.updated_at,
    }


async def accept_exchange(db: AsyncSession, exchange_id: int, user_id: int):
    ex = await db.get(ExchangeRequest, exchange_id)
    if not ex:
        raise HTTPException(404, "交換請求不存在")
    if ex.to_user_id != user_id:
        raise HTTPException(403, "只有物品持有者可以接受交換")
    if ex.status != "pending":
        raise HTTPException(400, "此交換請求已不是待確認狀態")

    ex.status = "accepted"

    from_user = await db.get(User, ex.from_user_id)
    to_item = await db.get(Item, ex.to_item_id)
    await create_notification(
        db, ex.from_user_id, "exchange_accepted",
        f"{to_item.title if to_item else '物品'} 的交換請求已被接受", ex.id
    )
    await db.flush()
    await db.refresh(ex)
    return await _format_exchange(db, ex)


async def reject_exchange(db: AsyncSession, exchange_id: int, user_id: int):
    ex = await db.get(ExchangeRequest, exchange_id)
    if not ex:
        raise HTTPException(404, "交換請求不存在")
    if ex.to_user_id != user_id:
        raise HTTPException(403, "只有物品持有者可以拒絕交換")
    if ex.status != "pending":
        raise HTTPException(400, "此交換請求已不是待確認狀態")

    ex.status = "rejected"

    # Restore stock
    to_item = await db.get(Item, ex.to_item_id)
    _restore_stock(to_item)
    if ex.from_item_id:
        from_item = await db.get(Item, ex.from_item_id)
        _restore_stock(from_item)

    from_user = await db.get(User, ex.from_user_id)
    await create_notification(
        db, ex.from_user_id, "exchange_rejected",
        f"{to_item.title if to_item else '物品'} 的交換請求已被拒絕", ex.id
    )
    await db.flush()
    await db.refresh(ex)
    return await _format_exchange(db, ex)


async def cancel_exchange(db: AsyncSession, exchange_id: int, user_id: int):
    ex = await db.get(ExchangeRequest, exchange_id)
    if not ex:
        raise HTTPException(404, "交換請求不存在")
    if ex.from_user_id != user_id:
        raise HTTPException(403, "只有請求發起者可以取消")
    if ex.status != "pending":
        raise HTTPException(400, "只能取消待確認的交換請求")

    ex.status = "cancelled"

    # Restore stock
    to_item = await db.get(Item, ex.to_item_id)
    _restore_stock(to_item)
    if ex.from_item_id:
        from_item = await db.get(Item, ex.from_item_id)
        _restore_stock(from_item)

    await db.flush()
    await db.refresh(ex)
    return await _format_exchange(db, ex)


async def complete_exchange(db: AsyncSession, exchange_id: int, user_id: int):
    ex = await db.get(ExchangeRequest, exchange_id)
    if not ex:
        raise HTTPException(404, "交換請求不存在")
    if ex.from_user_id != user_id and ex.to_user_id != user_id:
        raise HTTPException(403, "無權操作")
    if ex.status != "accepted":
        raise HTTPException(400, "只能完成已接受的交換請求")

    ex.status = "completed"

    other_user_id = ex.to_user_id if user_id == ex.from_user_id else ex.from_user_id
    await create_notification(
        db, other_user_id, "exchange_completed",
        f"交換 #{ex.id} 已完成！快去留下評價吧", ex.id
    )
    await db.flush()
    await db.refresh(ex)
    return await _format_exchange(db, ex)


async def request_cancel_exchange(db: AsyncSession, exchange_id: int, user_id: int, data: CancelRequest):
    ex = await db.get(ExchangeRequest, exchange_id)
    if not ex:
        raise HTTPException(404, "交換請求不存在")
    if ex.from_user_id != user_id and ex.to_user_id != user_id:
        raise HTTPException(403, "無權操作")
    if ex.status != "accepted":
        raise HTTPException(400, "只能對已接受的交換提出取消申請")
    if not data.reason or not data.reason.strip():
        raise HTTPException(400, "請提供取消理由")

    ex.status = "cancel_requested"
    ex.cancel_reason = data.reason.strip()
    ex.cancel_requested_by = user_id

    # Notify the other party
    other_user_id = ex.to_user_id if user_id == ex.from_user_id else ex.from_user_id
    from_user = await db.get(User, user_id)
    await create_notification(
        db, other_user_id, "cancel_requested",
        f"{from_user.nickname} 提出取消交換，理由：{data.reason.strip()}", ex.id
    )

    await db.flush()
    await db.refresh(ex)
    return await _format_exchange(db, ex)


async def approve_cancel_exchange(db: AsyncSession, exchange_id: int, user_id: int):
    ex = await db.get(ExchangeRequest, exchange_id)
    if not ex:
        raise HTTPException(404, "交換請求不存在")
    if ex.from_user_id != user_id and ex.to_user_id != user_id:
        raise HTTPException(403, "無權操作")
    if ex.status != "cancel_requested":
        raise HTTPException(400, "沒有待處理的取消申請")
    if ex.cancel_requested_by == user_id:
        raise HTTPException(400, "不能同意自己提出的取消申請")

    ex.status = "cancelled"

    # Restore stock
    to_item = await db.get(Item, ex.to_item_id)
    _restore_stock(to_item)
    if ex.from_item_id:
        from_item = await db.get(Item, ex.from_item_id)
        _restore_stock(from_item)

    other_user_id = ex.cancel_requested_by
    await create_notification(
        db, other_user_id, "exchange_cancelled",
        f"交換 #{ex.id} 已取消，物品庫存已返還", ex.id
    )

    await db.flush()
    await db.refresh(ex)
    return await _format_exchange(db, ex)


async def reject_cancel_exchange(db: AsyncSession, exchange_id: int, user_id: int):
    ex = await db.get(ExchangeRequest, exchange_id)
    if not ex:
        raise HTTPException(404, "交換請求不存在")
    if ex.from_user_id != user_id and ex.to_user_id != user_id:
        raise HTTPException(403, "無權操作")
    if ex.status != "cancel_requested":
        raise HTTPException(400, "沒有待處理的取消申請")
    if ex.cancel_requested_by == user_id:
        raise HTTPException(400, "不能拒絕自己提出的取消申請")

    requester_id = ex.cancel_requested_by

    ex.status = "accepted"
    ex.cancel_reason = None
    ex.cancel_requested_by = None

    await create_notification(
        db, requester_id, "cancel_rejected",
        f"交換 #{ex.id} 的取消申請已被拒絕，交換繼續進行", ex.id
    )

    await db.flush()
    await db.refresh(ex)
    return await _format_exchange(db, ex)
