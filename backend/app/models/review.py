from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    exchange_request_id = Column(Integer, ForeignKey("exchange_requests.id"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reviewed_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    exchange_request = relationship("ExchangeRequest", back_populates="reviews")
    reviewer = relationship("User", foreign_keys=[reviewer_id], overlaps="reviews_given")
    reviewed_user = relationship("User", foreign_keys=[reviewed_user_id], overlaps="reviews_received")

    __table_args__ = (
        UniqueConstraint("exchange_request_id", "reviewer_id", name="uq_review_per_party"),
    )
