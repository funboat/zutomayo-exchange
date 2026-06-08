from sqlalchemy.ext.asyncio import AsyncSession
from app.models.notification import Notification


async def create_notification(
    db: AsyncSession,
    user_id: int,
    type: str,
    content: str,
    related_id: int | None = None,
):
    notif = Notification(
        user_id=user_id,
        type=type,
        content=content,
        related_id=related_id,
    )
    db.add(notif)
    return notif
