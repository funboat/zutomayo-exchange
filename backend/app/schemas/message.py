from datetime import datetime
from pydantic import BaseModel


class MessageCreate(BaseModel):
    content: str


class MessageOut(BaseModel):
    id: int
    sender_id: int
    sender_nickname: str | None = None
    receiver_id: int
    content: str
    is_read: bool = False
    created_at: datetime | None = None

    model_config = {"from_attributes": True}
