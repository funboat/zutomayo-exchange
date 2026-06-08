from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import require_user, get_current_user
from app.schemas.item import ItemCreate, ItemUpdate
from app.services import item_service
from app.models.user import User

router = APIRouter(prefix="/items", tags=["items"])


@router.get("/")
async def list_items(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, le=100),
    category: str | None = None,
    status: str = "available",
    search: str | None = None,
    sort_by: str = "newest",
    owner_id: int | None = None,
    exchange_mode: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    return await item_service.list_items(
        db, page=page, page_size=page_size,
        category=category,
        status=status, search=search, sort_by=sort_by,
        owner_id=owner_id, exchange_mode=exchange_mode,
    )


@router.get("/{item_id}")
async def get_item(item_id: int, db: AsyncSession = Depends(get_db)):
    return await item_service.get_item(db, item_id)


@router.post("/")
async def create_item(
    data: ItemCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    return await item_service.create_item(db, user.id, data)


@router.put("/{item_id}")
async def update_item(
    item_id: int,
    data: ItemUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    return await item_service.update_item(db, item_id, user.id, data)


@router.delete("/{item_id}")
async def delete_item(
    item_id: int,
    reason: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    return await item_service.delete_item(db, item_id, user.id, user.is_admin, reason)
