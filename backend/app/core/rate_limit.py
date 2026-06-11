import redis
import structlog
from fastapi import Request
from limits.errors import ConfigurationError
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

log = structlog.get_logger()


def client_ip(request: Request) -> str:
    # Behind a reverse proxy (Render) request.client.host is the proxy, so
    # every caller would share one rate-limit bucket. Use the RIGHT-most
    # X-Forwarded-For entry: each proxy appends the peer it actually accepted
    # the connection from, so only the last entry is written by our own proxy.
    # Anything further left arrives verbatim from the client — keying on it
    # would let callers dodge every limit by rotating a fake header value.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[-1].strip()
    return get_remote_address(request)


# Counters live in Redis (Upstash free tier in production) so limits survive
# restarts and stay consistent across multiple backend instances — an in-memory
# store would reset on every deploy and let each instance grant its own quota.
# Resilience: if Redis is unreachable, slowapi transparently falls back to an
# in-memory limiter, and swallow_errors keeps a storage hiccup from turning a
# real request into a 500. This also means local dev works with no Redis running.
def _build_limiter() -> Limiter:
    """Build the Redis-backed limiter, degrading to in-memory on a bad URI.

    slowapi's in_memory_fallback only covers a Redis that's *unreachable at
    request time* — it parses storage_uri eagerly in __init__, so a malformed
    REDIS_URL (e.g. a pasted `redis-cli ...` command, or a non-redis scheme)
    raises ConfigurationError and takes the whole app down at import. That
    turns a single mistyped env var into a total outage, which is the opposite
    of the resilience this limiter is supposed to provide. Catch it here and
    fall back to a working in-memory limiter so the service still boots.
    """
    try:
        return Limiter(
            key_func=client_ip,
            storage_uri=settings.redis_url,
            storage_options={"socket_connect_timeout": 5},
            in_memory_fallback_enabled=True,
            swallow_errors=True,
            key_prefix="promptrx",
        )
    except ConfigurationError as exc:
        log.error(
            "rate_limit_storage_misconfigured",
            error=str(exc),
            detail="REDIS_URL is not a valid storage URI; "
            "limiter degraded to in-memory (limits reset on restart). "
            "Expected e.g. rediss://default:<token>@<host>:6379",
        )
        return Limiter(
            key_func=client_ip,
            in_memory_fallback_enabled=True,
            swallow_errors=True,
            key_prefix="promptrx",
        )


limiter = _build_limiter()


def redis_status() -> dict:
    """Ping the configured Redis directly to report real connectivity.

    Deliberately decoupled from slowapi's internals: once Redis drops, slowapi
    swaps its active storage to the in-memory fallback, so inspecting that
    storage would report "memory" (or falsely "reachable") instead of the
    truth. A direct ping answers the only operational question — is Redis at
    REDIS_URL reachable right now? A probe must never raise, so any failure
    degrades to reachable=False.
    """
    try:
        client = redis.from_url(settings.redis_url, socket_connect_timeout=2)
        client.ping()
        return {"redis_reachable": True}
    except Exception as exc:  # noqa: BLE001 — a probe must degrade, never 500
        log.warning("redis_health_check_failed", error=str(exc))
        return {"redis_reachable": False}
