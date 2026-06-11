import uuid
from datetime import datetime
from sqlalchemy import Integer, Text, DateTime, ForeignKey, Uuid, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

# Uuid().with_variant(...) keeps Postgres DDL identical while allowing SQLite
# (aiosqlite) to compile the column — used by the test suite's in-memory DB.


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid().with_variant(UUID(as_uuid=True), "postgresql"),
        primary_key=True,
        default=uuid.uuid4,
    )
    prompt_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid().with_variant(UUID(as_uuid=True), "postgresql"),
        ForeignKey("prompts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
