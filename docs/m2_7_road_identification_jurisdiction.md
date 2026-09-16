# CVKI Module 2.7 - Road Identification + Jurisdiction Foundation

## Scope

M2.7 extends the M2.6 reverse-geocoding flow into normalized road and
administrative context. It does not select a responsible authority, identify
contractors, submit complaints, persist coordinates, or implement later
milestones.

**Jurisdiction context is not the same as responsible road authority.**

## Architecture

```text
GET /api/v1/location/reverse-geocode
        |
        v
FastAPI location router
        |
        v
Location service normalization
        |
        v
Nominatim provider adapter
        |
        v
Normalized CVKI road/jurisdiction response
```

The provider adapter remains in
[backend/app/services/location.py](../backend/app/services/location.py). The
router does not parse provider-specific address keys. The existing frontend
location client continues to call the same endpoint.

## Normalized response

The endpoint remains:

```text
GET /api/v1/location/reverse-geocode?latitude={latitude}&longitude={longitude}
```

The response preserves M2.6 fields and adds district, municipality, source,
resolution metadata, and jurisdiction context:

```json
{
  "latitude": 12.9716,
  "longitude": 77.5946,
  "display_name": "...",
  "road": "1st Cross Road",
  "area": "Ashokanagar",
  "city": "Bengaluru",
  "district": "Bengaluru Urban",
  "municipality": "Bengaluru Central City Corporation",
  "state": "Karnataka",
  "country": "India",
  "jurisdiction": {
    "level": "administrative_context",
    "name": "Bengaluru Central City Corporation",
    "source": "OpenStreetMap Nominatim",
    "confidence": null
  },
  "source": "OpenStreetMap Nominatim",
  "resolution_status": "resolved",
  "message": null
}
```

Fields are returned only when the provider supplies them. The service does not
generate road names, authority names, or numerical confidence values.

## Road and administrative extraction

The adapter maps provider fields as follows:

- `road` -> road
- `suburb`, `neighbourhood`, or `village` -> area
- `city`, `town`, or municipality fallback -> city
- `district` or `county` -> district
- `municipality` -> municipality
- `state` -> state
- `country` -> country

The jurisdiction object is a context marker derived from the most specific
available administrative field, in this order: municipality, city, district,
state, country. It is not an authority recommendation. Its `confidence` is
`null` because the provider does not supply an objective CVKI confidence score.

Resolution states:

- `resolved`: road and at least one administrative context field are present
- `partial`: only one of road or administrative context is present
- `unresolved`: neither road nor administrative context is present

When road data is unavailable, `road` is `null` and `message` is:
`Road information could not be resolved for these coordinates.`

## Provider and errors

The current adapter uses OpenStreetMap Nominatim with the configured User-Agent
and timeout. Configuration remains in `backend/app/core/config.py`:

- `REVERSE_GEOCODER_URL`
- `REVERSE_GEOCODER_USER_AGENT`
- `REVERSE_GEOCODER_TIMEOUT_SECONDS`

Provider timeout, upstream failure, rate limit, malformed JSON, and malformed
address payloads are translated into safe API errors. Invalid coordinates are
rejected by Pydantic query constraints before provider access.

## Frontend

The existing location panel now displays road, area, city, district, state,
country, jurisdiction context, provider source, and resolution status. It keeps
GPS and detection independent, requests location only after explicit user
interaction, and retains coordinates only in frontend state.

No raw provider JSON is displayed. Missing fields render as `Unavailable` or
`Unknown`; no authority is inferred from city, district, or state.

## Tests

The focused location suite uses mocked provider responses and covers:

- fully resolved address
- road availability
- missing road
- partial administrative response
- district present and absent
- invalid latitude/longitude
- missing parameters
- provider timeout
- provider error
- provider rate limiting
- normalized jurisdiction structure
- unresolved context

The complete backend regression suite remained passing: **26 tests passed**
(5 M2.1 tests, 16 M2.2-M2.5 detection tests, and 10 location tests are
executed in overlapping test modules; the test runner total is 26 unique test
cases in the current suite).

Frontend build and lint also passed.

## Live verification

Using a real coordinate verification request against the live provider:

- `GET /api/health`: HTTP 200
- `GET /api/v1/model/status`: HTTP 200
- `POST /api/v1/detection/predict`: HTTP 200
- `GET /api/v1/location/reverse-geocode`: HTTP 200

The provider actually returned:

- Road: `1st Cross Road`
- Area: `Ashokanagar`
- City: `Bengaluru`
- State: `Karnataka`
- Country: `India`

No government authority ownership was claimed. The M1.13 checkpoint, datasets,
training artifacts, detection behavior, and frontend detection flow remain
unchanged apart from displaying the extended location context.
