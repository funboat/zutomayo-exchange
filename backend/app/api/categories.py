from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services import category_service

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("/")
async def list_categories(db: AsyncSession = Depends(get_db)):
    cats = await category_service.list_categories(db)
    return [
        {"key": c.key, "label": c.label, "sort_order": c.sort_order}
        for c in cats
    ]
