from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.authority import AuthorityResult
from app.schemas.complaint import ComplaintLocation, Language


CaseStatus = Literal["draft", "submitted_to_cvki", "under_review", "resolved", "closed"]


class CaseIssue(BaseModel):
    class_name: str
    label: str
    severity: Literal["low", "medium", "high"]
    confidence: float = Field(ge=0.0, le=1.0)


class CaseComplaint(BaseModel):
    language: Language
    title: str = Field(min_length=1)
    description: str = Field(min_length=1)


class ComplaintCaseCreateRequest(BaseModel):
    issue: CaseIssue
    location: ComplaintLocation | None = None
    authority: AuthorityResult | None = None
    complaint: CaseComplaint
    evidence: list[str] = Field(default_factory=list)


class FollowUp(BaseModel):
    guidance: str
    external_submission_status: Literal["not_submitted"] = "not_submitted"


class ComplaintCase(BaseModel):
    reference_id: str
    status: CaseStatus
    created_at: datetime
    issue: CaseIssue
    location: ComplaintLocation
    authority: AuthorityResult
    complaint: CaseComplaint
    evidence: list[str] = Field(default_factory=list)
    follow_up: FollowUp


class ComplaintCaseStatus(BaseModel):
    reference_id: str
    status: CaseStatus
    status_description: str
    external_submission_status: Literal["not_submitted"] = "not_submitted"
