import math
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import require_user, require_admin
from app.models.report import Report
from app.models.user import User

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("/")
async def create_report(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    report = Report(
        reporter_id=user.id,
        target_type=data.get("target_type", "item"),
        target_id=data.get("target_id"),
        reason=data.get("reason", ""),
    )
    db.add(report)
    await db.flush()
    return {"detail": "已提交舉報", "id": report.id}


@router.get("/")
async def list_reports(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, le=100),
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    q = select(Report).order_by(Report.created_at.desc())
    if status:
        q = q.where(Report.status == status)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    total_pages = max(1, math.ceil(total / page_size))
    result = await db.execute(q.offset((page - 1) * page_size).limit(page_size))
    reports = result.scalars().all()

    items = []
    for r in reports:
        reporter = await db.get(User, r.reporter_id)
        items.append({
            "id": r.id,
            "reporter_nickname": reporter.nickname if reporter else None,
            "target_type": r.target_type,
            "target_id": r.target_id,
            "reason": r.reason,
            "status": r.status,
            "created_at": r.created_at,
        })
    return {"items": items, "total": total, "page": page, "page_size": page_size, "total_pages": total_pages}


@router.put("/{report_id}")
async def update_report(
    report_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    report = await db.get(Report, report_id)
    if not report:
        return {"detail": "舉報不存在"}
    report.status = data.get("status", report.status)
    report.note = data.get("note", report.note)
    report.handled_by = admin.id
    await db.flush()
    return {"detail": "已更新"}
