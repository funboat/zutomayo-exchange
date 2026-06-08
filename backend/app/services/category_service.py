from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryUpdate


async def list_categories(db: AsyncSession, include_inactive: bool = False):
    q = select(Category).order_by(Category.sort_order.asc(), Category.id.asc())
    if not include_inactive:
        q = q.where(Category.is_active == True)
    result = await db.execute(q)
    return result.scalars().all()


async def create_category(db: AsyncSession, data: CategoryCreate):
    existing = await db.execute(select(Category).where(Category.key == data.key))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "類別 key 已存在")
    cat = Category(key=data.key, label=data.label, sort_order=data.sort_order)
    db.add(cat)
    await db.flush()
    await db.refresh(cat)
    return cat


async def update_category(db: AsyncSession, cat_id: int, data: CategoryUpdate):
    cat = await db.get(Category, cat_id)
    if not cat:
        raise HTTPException(404, "類別不存在")
    update_data = data.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(cat, k, v)
    await db.flush()
    await db.refresh(cat)
    return cat


async def delete_category(db: AsyncSession, cat_id: int):
    cat = await db.get(Category, cat_id)
    if not cat:
        raise HTTPException(404, "類別不存在")
    await db.delete(cat)
    await db.flush()
    return {"detail": "已刪除"}


async def get_valid_keys(db: AsyncSession) -> set[str]:
    """Return the set of active category keys for validation."""
    cats = await list_categories(db, include_inactive=False)
    return {c.key for c in cats}
