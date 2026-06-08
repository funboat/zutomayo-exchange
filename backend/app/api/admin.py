from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import require_admin
from app.models.user import User
from app.models.invitation_code import InvitationCode
from app.models.item import Item
from app.models.exchange_request import ExchangeRequest
from app.models.report import Report
from app.services.auth_service import create_invite_codes
from app.services import category_service
from app.schemas.user import UserOut
from app.schemas.category import CategoryCreate, CategoryUpdate

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/invite-codes")
async def generate_codes(
    count: int = Query(default=5, le=50),
    prefix: str = Query(default="ZTMY"),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    codes = await create_invite_codes(db, admin.id, count, prefix)
    return {"codes": codes}


@router.get("/invite-codes")
async def list_invite_codes(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, le=100),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    q = select(InvitationCode).order_by(InvitationCode.created_at.desc())
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    result = await db.execute(q.offset((page - 1) * page_size).limit(page_size))
    codes = result.scalars().all()
    return {
        "items": [{"id": c.id, "code": c.code, "created_by": c.created_by, "used_by": c.used_by, "is_used": c.is_used, "created_at": c.created_at} for c in codes],
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.get("/users")
async def list_users(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, le=100),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    q = select(User).order_by(User.created_at.desc())
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    result = await db.execute(q.offset((page - 1) * page_size).limit(page_size))
    users = result.scalars().all()
    return {
        "items": [UserOut.model_validate(u) for u in users],
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.put("/users/{user_id}/ban")
async def ban_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return {"detail": "用戶不存在"}
    user.is_banned = not user.is_banned
    await db.flush()
    return {"detail": "已更新", "is_banned": user.is_banned}


@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    users = (await db.execute(select(func.count(User.id)))).scalar()
    items = (await db.execute(select(func.count(Item.id)))).scalar()
    exchanges = (await db.execute(select(func.count(ExchangeRequest.id)))).scalar()
    pending_reports = (await db.execute(select(func.count(Report.id)).where(Report.status == "pending"))).scalar()
    return {
        "total_users": users,
        "total_items": items,
        "total_exchanges": exchanges,
        "pending_reports": pending_reports
    }


# ─── Category Management ──────────────────────────────────────────

@router.get("/categories")
async def list_categories(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    cats = await category_service.list_categories(db, include_inactive=True)
    return [
        {"id": c.id, "key": c.key, "label": c.label,
         "sort_order": c.sort_order, "is_active": c.is_active}
        for c in cats
    ]


@router.post("/categories")
async def create_category(
    data: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    cat = await category_service.create_category(db, data)
    return {"id": cat.id, "key": cat.key, "label": cat.label}


@router.put("/categories/{cat_id}")
async def update_category(
    cat_id: int,
    data: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    cat = await category_service.update_category(db, cat_id, data)
    return {"id": cat.id, "key": cat.key, "label": cat.label, "is_active": cat.is_active}


@router.delete("/categories/{cat_id}")
async def delete_category(
    cat_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return await category_service.delete_category(db, cat_id)
