from fastapi import APIRouter, HTTPException, status

from app.schemas.complaint import ComplaintDraftRequest, ComplaintDraftResponse
from app.schemas.complaint_case import (
    ComplaintCase,
    ComplaintCaseCreateRequest,
    ComplaintCaseStatus,
)
from app.services.complaint_case import (
    ComplaintCaseNotFoundError,
    create_case,
    get_case,
    get_case_status,
)
from app.services.complaint import UnsupportedIssueError, generate_complaint

router = APIRouter()


@router.post("/draft", response_model=ComplaintDraftResponse, summary="Generate an editable civic complaint draft")
def create_complaint_draft(request: ComplaintDraftRequest) -> ComplaintDraftResponse:
    try:
        return generate_complaint(request)
    except UnsupportedIssueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


@router.post("/cases", response_model=ComplaintCase, summary="Create an internal CVKI complaint case")
def create_complaint_case(request: ComplaintCaseCreateRequest) -> ComplaintCase:
    try:
        return create_case(request)
    except (ValueError, UnsupportedIssueError) as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


@router.get("/cases/{reference_id}", response_model=ComplaintCase, summary="Get an internal CVKI complaint case")
def get_complaint_case(reference_id: str) -> ComplaintCase:
    try:
        return get_case(reference_id)
    except ComplaintCaseNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="CVKI case was not found.")


@router.get("/cases/{reference_id}/status", response_model=ComplaintCaseStatus, summary="Get CVKI case status")
def get_complaint_case_status(reference_id: str) -> ComplaintCaseStatus:
    try:
        return get_case_status(reference_id)
    except ComplaintCaseNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="CVKI case was not found.")
