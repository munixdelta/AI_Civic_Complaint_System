from datetime import datetime, timezone
from secrets import token_hex
from threading import Lock

from app.schemas.authority import AuthorityResult
from app.schemas.complaint import ComplaintLocation
from app.schemas.complaint_case import (
    CaseStatus,
    ComplaintCase,
    ComplaintCaseCreateRequest,
    ComplaintCaseStatus,
    FollowUp,
)
from app.services.complaint import ISSUE_DEFINITIONS, UnsupportedIssueError


STATUS_DESCRIPTIONS = {
    "draft": "The complaint draft exists but has not been created as a CVKI case.",
    "submitted_to_cvki": "The complaint has been created inside the CVKI application.",
    "under_review": "The CVKI case is marked for internal review; no government submission is implied.",
    "resolved": "The CVKI case is marked resolved internally; no government action is implied.",
    "closed": "The CVKI case is closed internally; no government action is implied.",
}


class ComplaintCaseNotFoundError(LookupError):
    """The requested internal CVKI reference does not exist."""


class ComplaintCaseRepository:
    def save(self, case: ComplaintCase) -> ComplaintCase:
        raise NotImplementedError

    def get(self, reference_id: str) -> ComplaintCase:
        raise NotImplementedError


class InMemoryComplaintCaseRepository(ComplaintCaseRepository):
    def __init__(self):
        self._cases: dict[str, ComplaintCase] = {}
        self._lock = Lock()

    def save(self, case: ComplaintCase) -> ComplaintCase:
        with self._lock:
            self._cases[case.reference_id] = case
        return case

    def get(self, reference_id: str) -> ComplaintCase:
        with self._lock:
            case = self._cases.get(reference_id)
        if case is None:
            raise ComplaintCaseNotFoundError(reference_id)
        return case


case_repository: ComplaintCaseRepository = InMemoryComplaintCaseRepository()


def _new_reference_id() -> str:
    return f"CVKI-{datetime.now(timezone.utc):%Y%m%d}-{token_hex(3).upper()}"


def _safe_authority(authority: AuthorityResult | None) -> AuthorityResult:
    if authority is not None:
        return authority
    return AuthorityResult(
        authority_status="not_verified",
        limitations=["Responsible road authority was not supplied with this case."],
    )


def _follow_up(authority: AuthorityResult) -> FollowUp:
    if authority.authority_status == "verified":
        guidance = (
            "Your complaint has been created inside the CVKI application and saved as a CVKI case. "
            "No external government complaint has been submitted yet. "
            "Use the verified authority information and its official complaint channel when available."
        )
    else:
        guidance = (
            "Your complaint has been created inside the CVKI application and saved as a CVKI case. "
            "No external government complaint has been submitted yet. "
            "Responsible road authority could not be verified from available authoritative data. "
            "Please verify the appropriate authority before external submission."
        )
    return FollowUp(guidance=guidance)


def create_case(request: ComplaintCaseCreateRequest) -> ComplaintCase:
    definition = ISSUE_DEFINITIONS.get(request.issue.class_name)
    if definition is None:
        raise UnsupportedIssueError("Unsupported civic issue class.")
    if request.issue.label != definition.label or request.issue.severity != definition.severity:
        raise ValueError("Issue label or severity does not match the supported CVKI issue class.")

    authority = _safe_authority(request.authority)
    case = ComplaintCase(
        reference_id=_new_reference_id(),
        status="submitted_to_cvki",
        created_at=datetime.now(timezone.utc),
        issue=request.issue,
        location=request.location or ComplaintLocation(),
        authority=authority,
        complaint=request.complaint,
        evidence=list(request.evidence),
        follow_up=_follow_up(authority),
    )
    return case_repository.save(case)


def get_case(reference_id: str) -> ComplaintCase:
    return case_repository.get(reference_id)


def get_case_status(reference_id: str) -> ComplaintCaseStatus:
    case = get_case(reference_id)
    return ComplaintCaseStatus(
        reference_id=case.reference_id,
        status=case.status,
        status_description=STATUS_DESCRIPTIONS[case.status],
    )
