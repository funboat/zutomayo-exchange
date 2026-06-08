from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.api.deps import require_user
from app.utils.image_hosting import save_avatar
from app.models.user import User

router = APIRouter(prefix="/upload", tags=["upload"])


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    user=Depends(require_user),
):
    url = await save_image(file)
    return {"url": url}


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    url = await save_avatar(file)
    user.avatar = url
    await db.flush()
    await db.refresh(user)
    return {"url": url, "nickname": user.nickname, "avatar": user.avatar}
