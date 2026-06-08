from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base


class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    images = Column(JSONB, default=list)
    category = Column(String(50), nullable=False, index=True)

    status = Column(String(50), default="available", index=True)
    exchange_mode = Column(String(50), default="swap", nullable=False)  # reach_out | swap
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    wanted_items = Column(Text, nullable=True)
    stock = Column(Integer, nullable=True, default=1)  # null=无限库存
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    owner = relationship("User", back_populates="items")
    exchange_requests = relationship("ExchangeRequest", foreign_keys="ExchangeRequest.to_item_id", lazy="dynamic")
