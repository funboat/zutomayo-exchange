from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import require_user
from app.schemas.exchange import ExchangeCreate, CancelRequest
from app.services import exchange_service
from app.models.user import User

router = APIRouter(prefix="/exchanges", tags=["exchanges"])


@router.get("/check/{item_id}")
async def check_exchange(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    return await exchange_service.check_exchange_status(db, user.id, item_id)


@router.post("/")
async def create_exchange(
    data: ExchangeCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    return await exchange_service.create_exchange(db, user.id, data)


@router.get("/")
async def list_exchanges(
    role: str | None = None,
    status: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    return await exchange_service.list_exchanges(db, user.id, role, status, page, page_size)


@router.get("/{exchange_id}")
async def get_exchange(
    exchange_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    return await exchange_service.get_exchange_detail(db, exchange_id, user.id)


@router.put("/{exchange_id}/accept")
async def accept_exchange(
    exchange_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    return await exchange_service.accept_exchange(db, exchange_id, user.id)


@router.put("/{exchange_id}/reject")
async def reject_exchange(
    exchange_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    return await exchange_service.reject_exchange(db, exchange_id, user.id)


@router.put("/{exchange_id}/cancel")
async def cancel_exchange(
    exchange_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    return await exchange_service.cancel_exchange(db, exchange_id, user.id)


@router.put("/{exchange_id}/complete")
async def complete_exchange(
    exchange_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    return await exchange_service.complete_exchange(db, exchange_id, user.id)


@router.put("/{exchange_id}/request-cancel")
async def request_cancel_exchange(
    exchange_id: int,
    data: CancelRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    return await exchange_service.request_cancel_exchange(db, exchange_id, user.id, data)


@router.put("/{exchange_id}/approve-cancel")
async def approve_cancel_exchange(
    exchange_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    return await exchange_service.approve_cancel_exchange(db, exchange_id, user.id)


@router.put("/{exchange_id}/reject-cancel")
async def reject_cancel_exchange(
    exchange_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    return await exchange_service.reject_cancel_exchange(db, exchange_id, user.id)
