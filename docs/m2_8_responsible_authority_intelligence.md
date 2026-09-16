# CVKI Module 2.8 - Responsible Authority Intelligence

## Scope

M2.8 adds an evidence-aware authority-resolution foundation. It keeps road
ownership, maintenance authority, and builder/contractor as separate concepts.
It does not submit complaints, recommend departments, identify contractors from
unverified directories, persist data, or implement later milestones.

**Administrative jurisdiction does not by itself establish responsible road authority.**

## Architecture

```text
Location coordinates + normalized context
                |
                v
Authority router: GET /api/v1/authority/resolve
                |
                v
Authority resolver service
                |
                v
AuthoritySourceProvider interface
                |
                v
Official/authoritative source adapters (future)
```

The resolver is in
[backend/app/services/authority.py](../backend/app/services/authority.py). The
current `NoConfiguredAuthorityProvider` intentionally returns no claim. This
makes the live result safely `not_verified` until a real authoritative dataset
or API is configured and its schema/evidence rules are implemented.

## API

```text
GET /api/v1/authority/resolve?latitude={lat}&longitude={lon}
```

Optional normalized context parameters are accepted: `road`, `area`, `city`,
`district`, `state`, and `country`. The response shape is:

```json
{
  "location": {
    "latitude": 12.9716,
    "longitude": 77.5946,
    "road": "Vittal Mallya Road",
    "city": "Bengaluru"
  },
  "authority": {
    "authority_status": "not_verified",
    "road_owner": null,
    "maintenance_authority": null,
    "builder_or_contractor": null,
    "evidence": [],
    "limitations": [
      "Administrative jurisdiction does not by itself establish responsible road authority. No authoritative road ownership or maintenance source verified this location."
    ]
  }
}
```

## Authority model

Each role is independent:

- `road_owner`: ownership claim only
- `maintenance_authority`: current maintenance claim only
- `builder_or_contractor`: project/concession/maintenance role only

A role contains `name`, `type`, `source`, and optional contact fields. Contact
values are never generated; they can only be supplied by a future authoritative
provider with a source. No current response includes fabricated contacts.

`authority_status` is one of:

- `verified`: road owner and maintenance authority claims are both backed by
  evidence
- `partially_verified`: at least one role is backed by evidence, but the complete
  responsibility picture is not established
- `not_verified`: no evidence-backed authority result is available

## Evidence and source quality

Every claim must carry `AuthorityEvidence` with:

- `source_name`
- `source_type`
- optional stable `reference`
- `claim`

Preferred future source categories are official government, official municipal
or development authority, official project/tender document, and official
road/concession database. OpenStreetMap/Nominatim is used for geographic
context only and must not automatically be treated as proof of road maintenance
responsibility.

## Frontend behavior

The existing location panel calls the authority endpoint only after location
reverse-geocoding succeeds. The authority panel displays the status, distinct
roles when present, evidence, and limitations. With the current safe default it
shows:

`Responsible road authority could not be verified from available authoritative data.`

Detection, GPS, road identification, and authority resolution remain separate
flows. Authority resolution is not required before image analysis.

## Error handling

Latitude and longitude are validated by FastAPI query constraints. Provider
timeout and upstream failures are translated into safe 504/502 responses. No
raw provider errors, stack traces, paths, or guessed authority information are
returned.

## Tests

Automated authority tests mock the provider and cover:

- default `not_verified` result
- verified owner and maintenance roles with multiple evidence sources
- partially verified owner-only result
- builder/contractor present and absent
- missing evidence cannot verify a claim
- invalid and missing coordinates
- provider timeout and provider unavailable errors
- no fabricated contacts

The complete backend suite passed: **34 tests** across M2.1-M2.8.
Frontend `npm run build` and `npm run lint` passed.

## Live verification

Verified with the project `.venv` and Vite frontend:

- `GET /api/health`: HTTP 200
- `GET /api/v1/model/status`: HTTP 200
- `POST /api/v1/detection/predict`: HTTP 200; real manhole image returned 3
  detections and an annotated image
- `GET /api/v1/location/reverse-geocode`: HTTP 200; Nominatim returned real
  road and administrative context
- `GET /api/v1/authority/resolve`: HTTP 200; returned `not_verified`, null
  authority roles, empty evidence, and the explicit limitation above

The browser displayed the normalized location context and `NOT VERIFIED` status
without console errors. It also continued to display the real annotated
manhole detection result. No positive authority claim was made.

## Integrity and limitations

The current module does not establish road ownership or maintenance authority
for general coordinates because no authoritative authority source is configured.
That safe limitation is intentional. A future provider must be authoritative,
source-backed, and separately evaluated for owner, maintainer, and builder roles.

`best.pt`, M1 datasets, training artifacts, YOLO behavior, and prior M2.1-M2.7
semantics were not changed. No complaint, NLP, database, authentication,
escalation, or M2.9 work was started.
