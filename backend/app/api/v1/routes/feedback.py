import uuid
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.rate_limit import limiter
from app.models.feedback import Feedback
from app.schemas.feedback import FeedbackCreate
from app.services.email_service import send_email
from app.config import settings

router = APIRouter()


@router.post("/feedback", status_code=201)
@limiter.limit("10/minute")
async def submit_feedback(
    request: Request,
    body: FeedbackCreate,
    db: AsyncSession = Depends(get_db),
):
    prompt_id = None
    if body.prompt_id:
        try:
            prompt_id = uuid.UUID(body.prompt_id)
        except ValueError:
            pass

    fb = Feedback(prompt_id=prompt_id, rating=body.rating, comment=body.comment)
    db.add(fb)
    await db.flush()
    await db.commit()

    if body.comment:
        subject = f"PromptRx Feedback — {body.rating}/5 stars"
        email_body = (
            f"Rating: {body.rating}/5\n"
            f"Comment: {body.comment}\n"
            f"Prompt ID: {body.prompt_id or 'unknown'}"
        )
        await send_email(settings.contact_email, subject, email_body)

    return {"ok": True}
