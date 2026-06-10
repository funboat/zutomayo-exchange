from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
from sqlalchemy.orm import selectinload

from app.models.message import Message
from app.models.exchange_request import ExchangeRequest
from app.models.user import User


async def get_messages(db: AsyncSession, exchange_id: int, user_id: int):
    ex = await db.get(ExchangeRequest, exchange_id)
    if not ex:
        raise HTTPException(404, "交換請求不存在")
    if ex.from_user_id != user_id and ex.to_user_id != user_id:
        raise HTTPException(403, "無權查看")

    q = (
        select(Message)
        .where(Message.exchange_request_id == exchange_id)
        .order_by(Message.created_at.asc())
    )
    result = await db.execute(q)
    messages = result.scalars().all()

    # Mark as read
    for msg in messages:
        if msg.receiver_id == user_id and not msg.is_read:
            msg.is_read = True

    await db.flush()

    items = []
    for msg in messages:
        sender = await db.get(User, msg.sender_id)
        items.append({
            "id": msg.id,
            "sender_id": msg.sender_id,
            "sender_nickname": sender.nickname if sender else None,
            "receiver_id": msg.receiver_id,
            "content": msg.content,
            "is_read": msg.is_read,
            "created_at": msg.created_at,
        })
    return items


async def send_message(db: AsyncSession, exchange_id: int, sender_id: int, content: str):
    ex = await db.get(ExchangeRequest, exchange_id)
    if not ex:
        raise HTTPException(404, "交換請求不存在")
    if ex.from_user_id != sender_id and ex.to_user_id != sender_id:
        raise HTTPException(403, "無權發送訊息")

    receiver_id = ex.to_user_id if sender_id == ex.from_user_id else ex.from_user_id

    msg = Message(
        sender_id=sender_id,
        receiver_id=receiver_id,
        exchange_request_id=exchange_id,
        content=content,
    )
    db.add(msg)
    await db.flush()

    sender = await db.get(User, sender_id)

    return {
        "id": msg.id,
        "sender_id": msg.sender_id,
        "sender_nickname": sender.nickname if sender else None,
        "receiver_id": msg.receiver_id,
        "content": msg.content,
        "is_read": msg.is_read,
        "created_at": msg.created_at,
    }


async def get_unread_count(db: AsyncSession, user_id: int):
    q = select(func.count()).select_from(Message).where(
        Message.receiver_id == user_id,
        Message.is_read == False
    )
    count = (await db.execute(q)).scalar()
    return {"count": count}
