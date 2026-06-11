from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_optional_user
from app.core.rate_limit import limiter
from app.models.user import User
from app.models.prompt import Prompt
from app.schemas.prompt import UpgradeRequest, UpgradeResponse
from app.services import prompt_engine

router = APIRouter()


@router.post("/upgrade", response_model=UpgradeResponse)
@limiter.limit("10/minute")
async def upgrade(
    request: Request,
    body: UpgradeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    try:
        result = await prompt_engine.upgrade_prompt(body.raw_prompt)

        prompt_obj = Prompt(
            user_id=current_user.id if current_user else None,
            mode="upgrade",
            input_data={"raw_prompt": body.raw_prompt},
            generated_prompt=result.prompt,
            scores=result.scores.model_dump(),
            composite_score=result.composite_score,
            techniques=result.techniques,
            tips=result.tips,
            raw_prompt=body.raw_prompt,
            before_scores=result.before_scores.model_dump(),
        )
        db.add(prompt_obj)
        await db.flush()
        await db.commit()
        result.prompt_id = str(prompt_obj.id)

        return result
    except RuntimeError:
        raise HTTPException(status_code=503, detail="AI service temporarily unavailable")
