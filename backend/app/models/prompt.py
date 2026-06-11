import uuid
from datetime import datetime
from sqlalchemy import JSON, String, Float, DateTime, Text, ForeignKey, Uuid, func
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

# Uuid/JSON .with_variant(...) keeps Postgres DDL identical while allowing
# SQLite (aiosqlite) to compile — used by the test suite's in-memory DB.
# ARRAY(Text) has no portable SQLite equivalent; tests that need list columns
# assert list values via JSON round-trip rather than native ARRAY semantics.


class Prompt(Base):
    __tablename__ = "prompts"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid().with_variant(UUID(as_uuid=True), "postgresql"),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid().with_variant(UUID(as_uuid=True), "postgresql"),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    mode: Mapped[str] = mapped_column(String(20), nullable=False)
    input_data: Mapped[dict] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"), nullable=False
    )
    generated_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    scores: Mapped[dict] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"), nullable=False
    )
    composite_score: Mapped[float] = mapped_column(Float, nullable=False)
    techniques: Mapped[list] = mapped_column(
        JSON().with_variant(ARRAY(Text), "postgresql"), nullable=True
    )
    tips: Mapped[list] = mapped_column(
        JSON().with_variant(ARRAY(Text), "postgresql"), nullable=True
    )
    raw_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    before_scores: Mapped[dict | None] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
