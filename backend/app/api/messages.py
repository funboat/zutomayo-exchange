from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import require_user
from app.schemas.message import MessageCreate
from app.services import message_service
from app.models.user import User

router = APIRouter(prefix="/messages", tags=["messages"])


@router.get("/exchanges/{exchange_id}")
async def get_messages(
    exchange_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    return await message_service.get_messages(db, exchange_id, user.id)


@router.post("/exchanges/{exchange_id}")
async def send_message(
    exchange_id: int,
    data: MessageCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    return await message_service.send_message(db, exchange_id, user.id, data.content)


@router.get("/unread-count")
async def unread_count(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    return await message_service.get_unread_count(db, user.id)
