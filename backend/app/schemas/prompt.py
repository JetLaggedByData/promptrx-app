from pydantic import BaseModel, Field, model_validator
from typing import Optional, Literal
import re

INJECTION_PATTERNS = [
    r"ignore (all )?(previous|prior|above) instructions",
    r"<\|im_start\|>", r"<\|im_end\|>", r"\[INST\]",
    # Anchored to line start: a bare "system\s*:" rejected legitimate prose
    # like "document the system: architecture and design".
    r"you are now", r"disregard", r"(?m)^\s*system\s*:",
]


def sanitize(text: str) -> str:
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            raise ValueError(f"Input contains disallowed content")
    return text.strip()


class UserProfile(BaseModel):
    role: str = Field(..., min_length=2, max_length=200)
    domain: str = Field(..., min_length=2, max_length=200)
    experience: str = Field(..., min_length=2, max_length=100)
    task: str = Field(..., min_length=10, max_length=2000)
    constraints: Optional[str] = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def sanitize_inputs(self):
        self.role = sanitize(self.role)
        self.domain = sanitize(self.domain)
        self.task = sanitize(self.task)
        self.experience = sanitize(self.experience)
        if self.constraints:
            self.constraints = sanitize(self.constraints)
        return self


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=4000)

    @model_validator(mode="after")
    def sanitize_content(self):
        # Assistant turns are echoed back by the client, not generated
        # server-side — they are exactly as attacker-controlled as user turns,
        # so every role gets sanitized before it can reach Claude.
        self.content = sanitize(self.content)
        return self


class GenerateRequest(BaseModel):
    mode: Literal["wizard", "chat"]
    profile: Optional[UserProfile] = None
    messages: Optional[list[ChatMessage]] = Field(default=None, max_length=20)

    @model_validator(mode="after")
    def validate_mode_inputs(self):
        if self.mode == "wizard" and not self.profile:
            raise ValueError("profile required for wizard mode")
        if self.mode == "chat" and not self.messages:
            raise ValueError("messages required for chat mode")
        return self


class ScoreSchema(BaseModel):
    role_clarity: int = Field(..., ge=0, le=100)
    context_richness: int = Field(..., ge=0, le=100)
    task_specificity: int = Field(..., ge=0, le=100)
    output_definition: int = Field(..., ge=0, le=100)
    model_alignment: int = Field(..., ge=0, le=100)


class GenerateResponse(BaseModel):
    prompt: str
    scores: ScoreSchema
    composite_score: float
    techniques: list[str]
    tips: list[str]
    prompt_id: Optional[str] = None


class UpgradeRequest(BaseModel):
    raw_prompt: str = Field(..., min_length=5, max_length=3000)

    @model_validator(mode="after")
    def sanitize_raw(self):
        self.raw_prompt = sanitize(self.raw_prompt)
        return self


class UpgradeResponse(BaseModel):
    prompt: str
    scores: ScoreSchema
    composite_score: float
    before_scores: ScoreSchema
    before_composite: float
    improvements: list[str]
    techniques: list[str]
    tips: list[str]
    prompt_id: Optional[str] = None
