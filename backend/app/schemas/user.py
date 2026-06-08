from datetime import datetime
from pydantic import BaseModel


class UserOut(BaseModel):
    id: int
    email: str
    nickname: str
    avatar: str | None = None
    is_admin: bool = False
    is_banned: bool = False
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    nickname: str | None = None
    avatar: str | None = None


class UserPublic(BaseModel):
    id: int
    nickname: str
    avatar: str | None = None
    created_at: datetime | None = None
    item_count: int = 0
    avg_rating: float | None = None

    model_config = {"from_attributes": True}
