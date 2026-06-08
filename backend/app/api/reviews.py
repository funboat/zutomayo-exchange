from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.database import get_db
from app.api.deps import require_user
from app.models.review import Review
from app.models.exchange_request import ExchangeRequest
from app.models.user import User
from app.services.notification_service import create_notification

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.post("/")
async def create_review(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    exchange_id = data.get("exchange_request_id")
    rating = data.get("rating", 5)
    comment = data.get("comment", "")

    ex = await db.get(ExchangeRequest, exchange_id)
    if not ex:
        raise HTTPException(404, "交換請求不存在")
    if ex.from_user_id != user.id and ex.to_user_id != user.id:
        raise HTTPException(403, "無權評價")
    if ex.status != "completed":
        raise HTTPException(400, "只能評價已完成的交換")

    reviewed_user_id = ex.to_user_id if user.id == ex.from_user_id else ex.from_user_id

    existing = await db.execute(
        select(Review).where(Review.exchange_request_id == exchange_id, Review.reviewer_id == user.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "你已經評價過此交換")

    if rating < 1 or rating > 5:
        raise HTTPException(400, "評分須為 1-5")

    review = Review(
        exchange_request_id=exchange_id,
        reviewer_id=user.id,
        reviewed_user_id=reviewed_user_id,
        rating=rating,
        comment=comment,
    )
    db.add(review)

    await create_notification(
        db, reviewed_user_id, "new_review",
        f"{user.nickname} 給了你 {rating} 星評價", exchange_id
    )
    await db.flush()

    return {
        "id": review.id,
        "exchange_request_id": review.exchange_request_id,
        "reviewer_id": review.reviewer_id,
        "reviewed_user_id": review.reviewed_user_id,
        "rating": review.rating,
        "comment": review.comment,
        "created_at": review.created_at,
    }


@router.get("/exchanges/{exchange_id}")
async def get_reviews(
    exchange_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    ex = await db.get(ExchangeRequest, exchange_id)
    if not ex:
        raise HTTPException(404, "交換請求不存在")
    if ex.from_user_id != user.id and ex.to_user_id != user.id:
        raise HTTPException(403, "無權查看")

    result = await db.execute(
        select(Review).where(Review.exchange_request_id == exchange_id)
    )
    reviews = result.scalars().all()
    items = []
    for r in reviews:
        reviewer = await db.get(User, r.reviewer_id)
        items.append({
            "id": r.id,
            "reviewer_nickname": reviewer.nickname if reviewer else None,
            "rating": r.rating,
            "comment": r.comment,
            "created_at": r.created_at,
        })
    return items
