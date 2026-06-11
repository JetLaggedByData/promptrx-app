from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_optional_user
from app.core.rate_limit import limiter
from app.models.user import User
from app.models.prompt import Prompt
from app.schemas.prompt import GenerateRequest, GenerateResponse
from app.services import prompt_engine

router = APIRouter()


@router.post("/generate")
@limiter.limit("10/minute")
async def generate(
    request: Request,
    body: GenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    try:
        if body.mode == "wizard":
            result = await prompt_engine.generate_wizard(body.profile)
        else:
            result = await prompt_engine.generate_chat(body.messages)
            if isinstance(result, str):
                return JSONResponse(content={"message": result})

        if isinstance(result, GenerateResponse):
            prompt_obj = Prompt(
                user_id=current_user.id if current_user else None,
                mode=body.mode,
                input_data=body.model_dump(),
                generated_prompt=result.prompt,
                scores=result.scores.model_dump(),
                composite_score=result.composite_score,
                techniques=result.techniques,
                tips=result.tips,
            )
            db.add(prompt_obj)
            await db.flush()
            await db.commit()
            result.prompt_id = str(prompt_obj.id)

        return result
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail="AI service temporarily unavailable")
