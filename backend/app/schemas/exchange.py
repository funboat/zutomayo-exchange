from datetime import datetime
from pydantic import BaseModel


class ExchangeCreate(BaseModel):
    to_item_id: int
    message: str | None = None
    from_item_id: int | None = None


class CancelRequest(BaseModel):
    reason: str


class ExchangeOut(BaseModel):
    id: int
    from_user_id: int
    from_user_nickname: str | None = None
    to_user_id: int
    to_user_nickname: str | None = None
    from_item_id: int | None = None
    from_item_title: str | None = None
    to_item_id: int
    to_item_title: str | None = None
    to_item_images: list = []
    from_item_images: list = []
    from_item_exchange_mode: str | None = None
    to_item_exchange_mode: str | None = None
    status: str
    message: str | None = None
    cancel_reason: str | None = None
    cancel_requested_by: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class ExchangeListResponse(BaseModel):
    items: list[ExchangeOut]
    total: int
    page: int
    page_size: int
    total_pages: int
