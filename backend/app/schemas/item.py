from datetime import datetime
from pydantic import BaseModel, Field


class ItemCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    images: list[str] = []
    category: str
    wanted_items: str | None = None
    stock: int | None = 1
    exchange_mode: str = "swap"  # reach_out | swap


class ItemUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    images: list[str] | None = None
    category: str | None = None
    status: str | None = None
    wanted_items: str | None = None
    stock: int | None = None
    exchange_mode: str | None = None  # reach_out | swap


class ItemOut(BaseModel):
    id: int
    title: str
    description: str | None = None
    images: list[str] = []
    category: str
    status: str
    exchange_mode: str | None = None
    owner_id: int
    owner_nickname: str | None = None
    owner_avatar: str | None = None
    wanted_items: str | None = None
    stock: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class ItemListResponse(BaseModel):
    items: list[ItemOut]
    total: int
    page: int
    page_size: int
    total_pages: int
