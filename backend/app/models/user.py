from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    nickname = Column(String(100), nullable=False)
    avatar = Column(String(500), nullable=True)
    invite_code_used = Column(String(50), nullable=True)
    is_admin = Column(Boolean, default=False)
    is_banned = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    items = relationship("Item", back_populates="owner", lazy="dynamic")
    sent_exchanges = relationship("ExchangeRequest", foreign_keys="ExchangeRequest.from_user_id", lazy="dynamic")
    received_exchanges = relationship("ExchangeRequest", foreign_keys="ExchangeRequest.to_user_id", lazy="dynamic")
    sent_messages = relationship("Message", foreign_keys="Message.sender_id", lazy="dynamic")
    received_messages = relationship("Message", foreign_keys="Message.receiver_id", lazy="dynamic")
    reviews_given = relationship("Review", foreign_keys="Review.reviewer_id", lazy="dynamic")
    reviews_received = relationship("Review", foreign_keys="Review.reviewed_user_id", lazy="dynamic")
    reports = relationship("Report", foreign_keys="Report.reporter_id", lazy="dynamic")
    notifications = relationship("Notification", back_populates="user", lazy="dynamic")
