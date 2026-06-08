from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base


class ExchangeRequest(Base):
    __tablename__ = "exchange_requests"

    id = Column(Integer, primary_key=True, index=True)
    from_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    to_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    from_item_id = Column(Integer, ForeignKey("items.id"), nullable=True)
    to_item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    status = Column(String(50), default="pending", index=True)
    message = Column(Text, nullable=True)
    cancel_reason = Column(Text, nullable=True)
    cancel_requested_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    from_user = relationship("User", foreign_keys=[from_user_id], overlaps="sent_exchanges")
    to_user = relationship("User", foreign_keys=[to_user_id], overlaps="received_exchanges")
    from_item = relationship("Item", foreign_keys=[from_item_id])
    to_item = relationship("Item", foreign_keys=[to_item_id], overlaps="exchange_requests")
    messages = relationship("Message", back_populates="exchange_request", lazy="dynamic")
    reviews = relationship("Review", back_populates="exchange_request", lazy="dynamic")
