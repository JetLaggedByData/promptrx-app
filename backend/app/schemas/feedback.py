from pydantic import BaseModel, EmailStr, Field, model_validator
from typing import Optional


def _strip_headers(value: str) -> str:
    # Prevent SMTP header injection via newline characters
    return value.replace("\r", "").replace("\n", " ").strip()


class FeedbackCreate(BaseModel):
    prompt_id: Optional[str] = None
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def sanitize_fields(self):
        if self.comment:
            self.comment = _strip_headers(self.comment)
        return self


class ContactCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    message: str = Field(..., min_length=5, max_length=3000)

    @model_validator(mode="after")
    def sanitize_fields(self):
        self.name = _strip_headers(self.name)
        self.email = _strip_headers(self.email)
        self.message = _strip_headers(self.message)
        return self
