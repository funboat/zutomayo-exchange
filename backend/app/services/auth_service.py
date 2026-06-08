import secrets
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.models.user import User
from app.models.invitation_code import InvitationCode
from app.utils.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token


async def register_user(db: AsyncSession, email: str, password: str, nickname: str, invite_code: str):
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "此電郵已被註冊")

    code = await db.execute(
        select(InvitationCode).where(InvitationCode.code == invite_code, InvitationCode.is_used == False)
    )
    code = code.scalar_one_or_none()
    if not code:
        raise HTTPException(400, "邀請碼無效或已被使用")

    if len(password) < 8:
        raise HTTPException(400, "密碼至少 8 個字元")

    if len(nickname) < 2 or len(nickname) > 50:
        raise HTTPException(400, "暱稱須為 2-50 字元")

    user = User(
        email=email,
        password_hash=hash_password(password),
        nickname=nickname,
        invite_code_used=invite_code
    )
    db.add(user)
    await db.flush()

    code.is_used = True
    code.used_by = user.id

    access = create_access_token(user.id)
    refresh = create_refresh_token(user.id)
    return {"access_token": access, "refresh_token": refresh, "user": user}


async def login_user(db: AsyncSession, email: str, password: str):
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(401, "電郵或密碼錯誤")

    if user.is_banned:
        raise HTTPException(403, "此帳號已被停用")

    access = create_access_token(user.id)
    refresh = create_refresh_token(user.id)
    return {"access_token": access, "refresh_token": refresh, "user": user}


async def refresh_access_token(db: AsyncSession, refresh_token: str):
    try:
        payload = decode_token(refresh_token)
    except Exception:
        raise HTTPException(401, "無效的 refresh token")

    if payload.get("type") != "refresh":
        raise HTTPException(401, "token 類型錯誤")

    user_id = int(payload.get("sub"))
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or user.is_banned:
        raise HTTPException(401, "用戶不存在或已被停用")

    access = create_access_token(user.id)
    refresh = create_refresh_token(user.id)
    return {"access_token": access, "refresh_token": refresh, "user": user}


def generate_invite_codes(count: int, prefix: str = "ZTMY") -> list[str]:
    return [f"{prefix}-{secrets.token_urlsafe(6)}" for _ in range(count)]


async def create_invite_codes(db: AsyncSession, created_by: int, count: int, prefix: str = "ZTMY"):
    codes = generate_invite_codes(count, prefix)
    for code_str in codes:
        code = InvitationCode(code=code_str, created_by=created_by)
        db.add(code)
    await db.flush()
    return codes
