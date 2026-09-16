# CVKI Module 2.9 - Civic Complaint Draft Generation

## Scope

M2.9 converts verified inspection context into an editable citizen-facing
complaint draft. **M2.9 generates an editable complaint draft only. It does not
submit complaints to external government systems.**

There is no database persistence, authentication, notification, external portal
submission, tracking, escalation, external LLM, or complaint reference ID.

## Architecture

```text
Detection result + location context + authority result
                         |
                         v
POST /api/v1/complaint/draft
                         |
                         v
Rule-based complaint service
                         |
                         v
Structured editable draft response
```

The implementation is stateless and uses the existing detection, location, and
authority schemas. No duplicate inference, location, or authority logic is
introduced.

## Request and response

Endpoint:

```text
POST /api/v1/complaint/draft
```

The request accepts a detection class/confidence, optional normalized location,
optional M2.8 authority result, language (`en`, `hi`, or `hinglish`), and an
`image_attached` flag. The response contains:

- issue category and citizen-friendly label
- factual title and description
- language
- rule-based severity and reason
- location structure
- authority status
- verified suggested authority only when authority status is `verified`
- evidence and limitations
- editable `draft_text`

## Issue normalization and severity

Only the existing M1.13 classes are accepted:

- `open_damaged_manhole` -> `Open/Damaged Manhole`, high priority
- `damaged_missing_road_sign` -> `Damaged/Missing Road Sign`, medium priority
- `road_waterlogging` -> `Road Waterlogging`, medium priority

Severity is transparent and rule-based. It does not depend on confidence score
and makes no medical, legal, injury, accident, or financial-loss claims.

## Language support

English, Hindi, and Hinglish use local deterministic templates. Changing language
changes wording only; issue class, confidence, severity, location, and authority
status remain factual and unchanged. No translation API or LLM is used.

## Location and authority handling

Available road, area, city, district, and state fields are included. A missing
road is explicitly stated as unavailable; it is never invented. Coordinates are
retained in the structured response but are not printed in the normal complaint
text at excessive precision.

If authority is absent or `not_verified`, the draft says:

`Responsible road authority could not be verified from available authoritative data.`

Partially verified authority is labeled as such and is not promoted to a
confirmed responsible authority. A verified maintenance authority may be
returned as `suggested_authority` with its supplied source. Builder/contractor
information is separate and remains null unless supplied with evidence.

## Evidence and safety

Draft evidence includes the detected issue, model confidence, and photo
attachment state. Authority evidence is copied only from the supplied M2.8
result. The service never fabricates contacts, departments, URLs, durations,
injuries, affected populations, or authority ownership.

## Frontend

The existing inspection UI now shows a **Citizen draft** panel after real
 detections are returned. It provides:

- Generate Complaint
- English/Hindi/Hinglish selector
- severity and authority status metadata
- editable textarea
- Copy Complaint
- Regenerate
- explicit Draft only labeling

The UI never submits the draft anywhere. No-detection responses do not show the
complaint generator because there is no issue to draft from.

## Tests

The complaint suite covers:

- manhole, road-sign, and waterlogging classes
- English, Hindi, and Hinglish
- verified, partially verified, and not verified authority
- missing road and detection-only input
- rule-based severity
- model confidence and attachment evidence
- no fabricated authority/contact information
- invalid request and unsupported issue class

The complete backend suite passed: **43 tests** across M2.1-M2.9.
Frontend build and lint passed.

## Live verification

Verified with the project `.venv`, FastAPI, and Vite:

- `GET /api/health`: HTTP 200
- `GET /api/v1/model/status`: HTTP 200
- `POST /api/v1/detection/predict`: HTTP 200 with real M1.13 inference and
  annotated output
- `GET /api/v1/location/reverse-geocode`: HTTP 200
- `GET /api/v1/authority/resolve`: HTTP 200, `not_verified` with no fabricated
  authority
- `POST /api/v1/complaint/draft`: HTTP 200

The browser flow used a real manhole image, produced three real detections,
resolved location, generated a complaint draft, displayed the unverified
authority limitation, changed language, and kept the draft editable. Copy was
available through the browser clipboard action. No complaint was submitted.

## Limitations

The current authority result is intentionally not verified because no
authoritative government road-owner or maintenance source is configured. Drafts
are deterministic templates rather than ML-generated text. They are citizen
editable and require user review before any future workflow.

M1.13 `best.pt`, M1 datasets, training artifacts, detection behavior, GPS flow,
road identification, and authority semantics remain unchanged. No M2.10 work
was started.
