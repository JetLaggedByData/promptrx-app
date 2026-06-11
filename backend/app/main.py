import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.core.rate_limit import limiter, redis_status
from app.db.session import engine
from app.models.base import Base
from app.api.v1.routes import generate, upgrade, auth, history, feedback, contact

log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("startup", environment=settings.environment)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    log.info("shutdown")
    await engine.dispose()


app = FastAPI(
    title="PromptRx API",
    description="Context-first AI prompt engineering",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.environment != "production" else None,
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
allowed_origins = [o.strip() for o in settings.frontend_url.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Security headers
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    # HTTPS-only (browsers ignore this over plain HTTP, so it's safe in dev).
    response.headers["Strict-Transport-Security"] = (
        "max-age=63072000; includeSubDomains"
    )
    # Lock down this JSON API. Skipped in non-production so the Swagger UI
    # at /docs (which loads inline assets) still works in dev.
    if settings.environment == "production":
        response.headers["Content-Security-Policy"] = (
            "default-src 'none'; frame-ancestors 'none'"
        )
    return response


# Sentry (production only)
if settings.sentry_dsn and settings.environment == "production":
    import sentry_sdk

    sentry_sdk.init(dsn=settings.sentry_dsn, traces_sample_rate=0.1)


# Routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(generate.router, prefix="/api/v1", tags=["generate"])
app.include_router(upgrade.router, prefix="/api/v1", tags=["upgrade"])
app.include_router(history.router, prefix="/api/v1", tags=["history"])
app.include_router(feedback.router, prefix="/api/v1", tags=["feedback"])
app.include_router(contact.router, prefix="/api/v1", tags=["contact"])


@app.get("/health")
async def health():
    return {"status": "ok", "environment": settings.environment}


# Separate from /health (which Render polls every few seconds) so we only ping
# Redis on demand — a per-poll ping would burn the Upstash free-tier quota.
# Hit this manually to confirm REDIS_URL is wired: redis_connected=false means
# the limiter is running on its in-memory fallback (limits reset on restart).
@app.get("/health/redis")
@limiter.limit("6/minute")
async def health_redis(request: Request):
    reachable = redis_status()["redis_reachable"]
    # The endpoint is public, and "Redis is down" doubles as "rate limiting is
    # degraded" — an open invitation to time a brute-force run. In production
    # the truthful answer goes to the logs (Render dashboard) only.
    log.info("redis_health_checked", redis_reachable=reachable)
    if settings.environment == "production":
        return {"status": "ok"}
    return {
        "redis_connected": reachable,
        "detail": (
            "Rate limits are persisting to Redis."
            if reachable
            else "Redis unreachable — limiter on in-memory fallback (set REDIS_URL)."
        ),
    }
