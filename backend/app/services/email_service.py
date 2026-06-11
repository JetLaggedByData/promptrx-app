import smtplib
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import structlog
from app.config import settings

log = structlog.get_logger()


def _send_sync(to: str, subject: str, body: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["From"] = settings.smtp_user
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))
    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)


async def send_email(to: str, subject: str, body: str) -> None:
    if not settings.smtp_user or not settings.smtp_password:
        log.info("email_skipped", reason="smtp_not_configured", subject=subject)
        return
    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(None, _send_sync, to, subject, body)
        log.info("email_sent", to=to, subject=subject)
    except Exception as e:
        log.warning("email_failed", error=str(e), to=to)
