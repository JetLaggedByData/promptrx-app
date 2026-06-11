FROM python:3.12-slim

WORKDIR /app

# Pin uv to a known-good version — `:latest` is a moving tag, so a new uv
# release could silently change `uv sync` behaviour and break a build with no
# repo change (the likely cause of the unexplained deploy failures).
COPY --from=ghcr.io/astral-sh/uv:0.11.7 /uv /usr/local/bin/uv

# Install dependencies first, WITHOUT the project itself, so this layer is
# cached on the lockfile alone and `uv sync` never needs the source tree (this
# is a packaged hatchling project — building the root wheel requires app/).
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

# Now bring in the source and install the project itself against the cached deps.
COPY . .
RUN uv sync --frozen --no-dev

CMD ["/bin/sh", "-c", "uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT"]
