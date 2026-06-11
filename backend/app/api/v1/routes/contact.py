from fastapi import APIRouter, Request
from app.core.rate_limit import limiter
from app.schemas.feedback import ContactCreate
from app.services.email_service import send_email
from app.config import settings

router = APIRouter()


@router.post("/contact", status_code=200)
@limiter.limit("5/minute")
async def contact(
    request: Request,
    body: ContactCreate,
):
    subject = f"PromptRx Contact: {body.name}"
    email_body = f"From: {body.name} <{body.email}>\n\n{body.message}"
    await send_email(settings.contact_email, subject, email_body)
    return {"ok": True}
