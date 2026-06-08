from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.auth import LoginRequest, RegisterRequest, RefreshRequest
from app.schemas.user import UserOut, UserUpdate
from app.services import auth_service
from app.api.deps import require_user
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register")
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.register_user(db, data.email, data.password, data.nickname, data.invite_code)


@router.post("/login")
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.login_user(db, data.email, data.password)


@router.post("/refresh")
async def refresh(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.refresh_access_token(db, data.refresh_token)


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(require_user)):
    return user


@router.put("/me", response_model=UserOut)
async def update_me(data: UserUpdate, user: User = Depends(require_user), db: AsyncSession = Depends(get_db)):
    if data.nickname is not None:
        user.nickname = data.nickname
    if data.avatar is not None:
        user.avatar = data.avatar
    await db.flush()
    return user
