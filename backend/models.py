"""
SQLAlchemy ORM models for CascadeRecover AI.
"""
import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import Column, String, Float, Integer, DateTime, Enum, ForeignKey, Text
from database import Base


class TransactionStatus(str, PyEnum):
    FAILED = "FAILED"
    RETRY_SCHEDULED = "RETRY_SCHEDULED"
    LINK_SENT = "LINK_SENT"
    RECOVERED = "RECOVERED"
    PERMANENTLY_FAILED = "PERMANENTLY_FAILED"


class DeclineType(str, PyEnum):
    SOFT_DECLINE = "SOFT_DECLINE"
    HARD_DECLINE = "HARD_DECLINE"


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4())[:8].upper())
    amount = Column(Float, nullable=False)
    currency = Column(String, default="INR")
    customer_name = Column(String, nullable=False)
    customer_email = Column(String, nullable=False)
    customer_phone = Column(String, nullable=True)
    error_code = Column(String, nullable=False)
    error_description = Column(String, nullable=False)
    status = Column(Enum(TransactionStatus), default=TransactionStatus.FAILED)
    attempts_count = Column(Integer, default=0)
    decline_type = Column(String, nullable=True)
    ai_reasoning = Column(Text, nullable=True)
    ai_action = Column(String, nullable=True)
    customer_message = Column(Text, nullable=True)
    payment_link = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    transaction_id = Column(String, ForeignKey("transactions.id"), nullable=False)
    step_name = Column(String, nullable=False)
    reasoning = Column(Text, nullable=True)
    channel_action = Column(String, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
