"""
Database configuration and session management for CascadeRecover AI.
Uses SQLite with SQLAlchemy for persistence + in-memory SSE event queue.
"""
import asyncio
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.pool import StaticPool

DATABASE_URL = "sqlite:///./cascade_recover.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


# Global SSE event queue for broadcasting real-time updates
sse_event_queues: list[asyncio.Queue] = []


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from models import Transaction, AuditLog  # noqa: F401
    Base.metadata.create_all(bind=engine)


async def broadcast_sse_event(event_data: dict):
    """Broadcast an event to all connected SSE clients."""
    dead_queues = []
    for q in sse_event_queues:
        try:
            await q.put(event_data)
        except Exception:
            dead_queues.append(q)
    for q in dead_queues:
        if q in sse_event_queues:
            sse_event_queues.remove(q)
