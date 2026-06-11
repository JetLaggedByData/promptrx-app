from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.prompt import Prompt

router = APIRouter()


@router.get("/history")
async def get_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
):
    offset = (page - 1) * limit
    result = await db.execute(
        select(Prompt)
        .where(Prompt.user_id == current_user.id)
        .order_by(desc(Prompt.created_at))
        .offset(offset)
        .limit(limit)
    )
    prompts = result.scalars().all()
    return {
        "items": [
            {
                "id": str(p.id),
                "mode": p.mode,
                "prompt_preview": (p.generated_prompt or "")[:120] + "...",
                "composite_score": p.composite_score,
                "created_at": p.created_at.isoformat(),
            }
            for p in prompts
        ],
        "page": page,
    }
