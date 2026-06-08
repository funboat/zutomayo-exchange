"""
Initialize the database with a default admin user and invitation codes.

Usage:
    cd backend
    source venv/bin/activate
    python seed.py --email admin@example.com --password yourpassword --nickname 管理員

This will:
  1. Create tables (if not already created)
  2. Create an admin user (or promote existing user to admin)
  3. Generate 10 invitation codes
"""
import asyncio
import argparse
import secrets
from sqlalchemy import select

from app.database import engine, async_session
from app.models.base import Base
from app.models.user import User
from app.models.invitation_code import InvitationCode
from app.utils.security import hash_password


async def seed(email: str, password: str, nickname: str, codes_count: int = 10):
    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        # Create or promote admin user
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if user:
            user.is_admin = True
            user.password_hash = hash_password(password)
            print(f"[OK] Existing user '{email}' promoted to admin, password updated.")
        else:
            user = User(
                email=email,
                password_hash=hash_password(password),
                nickname=nickname,
                is_admin=True,
            )
            db.add(user)
            await db.flush()
            print(f"[OK] Admin user created: {email} ({nickname})")

        # Generate invitation codes
        codes = [f"ZTMY-{secrets.token_urlsafe(6)}" for _ in range(codes_count)]
        for code_str in codes:
            code = InvitationCode(code=code_str, created_by=user.id)
            db.add(code)

        await db.commit()

        print(f"[OK] {codes_count} invitation codes generated:")
        for c in codes:
            print(f"      {c}")

    await engine.dispose()
    print("\nReady! Start the backend with: uvicorn app.main:app --reload")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed the ZUTOMAYO Exchange database")
    parser.add_argument("--email", default="admin@zutomayo.dev", help="Admin email")
    parser.add_argument("--password", default="zutomayo2024", help="Admin password")
    parser.add_argument("--nickname", default="管理員", help="Admin nickname")
    parser.add_argument("--codes", type=int, default=10, help="Number of invite codes")
    args = parser.parse_args()

    if len(args.password) < 8:
        print("Error: Password must be at least 8 characters.")
        exit(1)

    asyncio.run(seed(args.email, args.password, args.nickname, args.codes))
