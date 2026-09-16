# CVKI Module 2.10 - Complaint Workflow & Tracking Foundation

## Scope

M2.10 converts an approved editable complaint draft into an internal, stateless
CVKI case. **CVKI Reference ID is an internal application reference and is not a
government complaint number.** **M2.10 does not submit complaints to external
government systems.**

No government portal, external complaint ID, authentication, notification,
escalation, payment, or production database is implemented.

## Case model

A case contains:

- `reference_id`: backend-generated `CVKI-YYYYMMDD-XXXXXX` identifier
- `status`: starts as `submitted_to_cvki`
- `created_at`: UTC timestamp
- issue class, label, severity, and model confidence
- normalized location context
- preserved authority result and verification status
- exact final citizen complaint title and description
- evidence metadata
- follow-up guidance
- `external_submission_status: not_submitted`

`submitted_to_cvki` means only that the complaint was created inside the CVKI
application. It does not mean a government authority received it.

## Repository and APIs

The repository interface and development implementation are in
[backend/app/services/complaint_case.py](../backend/app/services/complaint_case.py).
The current `InMemoryComplaintCaseRepository` is intentionally temporary:
all cases are lost when the backend restarts. No original image is stored;
only supplied evidence metadata is retained.

Endpoints:

```text
POST /api/v1/complaint/cases
GET  /api/v1/complaint/cases/{reference_id}
GET  /api/v1/complaint/cases/{reference_id}/status
```

Unknown references return HTTP 404. Invalid or unsupported cases return HTTP
422. Status responses separately expose the internal CVKI status and the fixed
external status `not_submitted`.

## Edited text preservation

The frontend sends the current editable title and description directly when the
user clicks **Create CVKI Case**. The backend does not regenerate the draft.
Language, evidence, location, and authority status are preserved from the
current inspection context.

## Authority and follow-up safety

Verified, partially verified, and not verified authority states are preserved.
No authority is inferred from city, road, or administrative context. Missing
authority remains null and produces guidance requiring verification before any
future external submission.

Example guidance:

`Your complaint has been created inside the CVKI application and saved as a CVKI case. No external government complaint has been submitted yet. Responsible road authority could not be verified from available authoritative data. Please verify the appropriate authority before external submission.`

No contacts, departments, URLs, contractors, or government statuses are
fabricated.

## Frontend workflow

The complaint panel now provides:

1. editable complaint title and description
2. **Create CVKI Case**
3. internal CVKI Reference ID display
4. `Submitted to CVKI` status display
5. `External Government Submission: Not Submitted`
6. follow-up guidance
7. **View Case Status**

A no-detection response does not show the complaint workflow. Detection,
location, authority, draft generation, and case creation remain separate steps.

## Tests

The case suite covers:

- case creation and unique references
- case detail and missing-case 404
- status endpoint and initial lifecycle state
- external status remaining `not_submitted`
- exact edited text preservation
- English, Hindi, and Hinglish
- verified, partially verified, and not verified authority
- missing location
- unsupported issue and invalid request
- no fabricated contacts
- follow-up guidance
- in-memory repository save/get behavior

Complete backend regression: **54 tests passed** across M2.1-M2.10.
Frontend build and lint passed.

## Live verification

Verified with FastAPI and Vite:

- `/api/health`: HTTP 200
- `/api/v1/model/status`: HTTP 200
- `/api/v1/detection/predict`: HTTP 200 with real M1.13 inference
- `/api/v1/location/reverse-geocode`: HTTP 200
- `/api/v1/authority/resolve`: HTTP 200, safely `not_verified`
- `/api/v1/complaint/draft`: HTTP 200
- `/api/v1/complaint/cases`: HTTP 200
- `/api/v1/complaint/cases/{reference_id}`: HTTP 200
- `/api/v1/complaint/cases/{reference_id}/status`: HTTP 200

Browser verification used the real manhole image. The user edited the title to
`Citizen edited manhole title` and the description to
`Citizen edited final complaint description.` The created case displayed a
real backend reference ID, `Submitted to CVKI`, `Not Submitted`, and status
lookup returned the same reference and internal status. No complaint was sent
to a government system.

## Limitations

The repository is in-memory and not suitable for production persistence. There
is no external submission or tracking integration, no authentication, and no
notification system. M3 and later work remains intentionally unimplemented.
