# CVKI Module 2.6 - GPS + Location Intelligence Foundation

## Scope

M2.6 adds an opt-in browser GPS flow and a backend reverse-geocoding foundation.
Coordinates are held in frontend memory only. This module does not identify
authorities, persist complaints, use NLP, write to MongoDB, authenticate users,
or submit anything to an external civic system.

## Browser GPS flow

The location service is [frontend/src/services/locationApi.js](../frontend/src/services/locationApi.js).
The inspection UI in [frontend/src/App.jsx](../frontend/src/App.jsx) requests
location only after the user clicks **Use My Current Location**. It does not
request GPS on page load and does not log coordinates.

The browser position is normalized to:

```json
{
  "latitude": 12.9716,
  "longitude": 77.5946,
  "accuracy_meters": 25
}
```

The values above are an example of the structure, not hard-coded application
coordinates. The frontend uses the actual `GeolocationPosition` values and
shows coordinates rounded to five decimals for the citizen-facing display.
Accuracy is shown in meters.

Handled browser states:

- permission denied: `Location permission was not granted.`
- unavailable position: `Your location is currently unavailable.`
- timeout: `Location request timed out. Try again.`
- unsupported browser: `This browser does not support device location.`
- provider/reverse-geocoding failure: coordinates remain available with a
  message that road information could not be resolved

## Backend endpoint

```text
GET /api/v1/location/reverse-geocode?latitude={latitude}&longitude={longitude}
```

The endpoint validates latitude in `[-90, 90]` and longitude in `[-180, 180]`
with FastAPI/Pydantic query validation. It returns only normalized fields that
the provider supplied:

```json
{
  "latitude": 12.9716,
  "longitude": 77.5946,
  "display_name": "...",
  "road": "...",
  "area": "...",
  "city": "...",
  "state": "...",
  "country": "..."
}
```

Missing address components remain `null`; road names are never guessed.
Detection does not depend on location. The user can analyze an image, resolve
location, or do both independently.

## Provider abstraction

[backend/app/services/location.py](../backend/app/services/location.py) contains
the replaceable provider boundary and normalized result type. The current
adapter uses OpenStreetMap Nominatim through Python's standard-library HTTP
client. It sends the configured identifying User-Agent and uses a five-second
configured timeout. No API key or secret is required.

Configuration is in `backend/app/core/config.py`:

- `REVERSE_GEOCODER_URL`
- `REVERSE_GEOCODER_USER_AGENT`
- `REVERSE_GEOCODER_TIMEOUT_SECONDS`

The provider is not called by automated tests. Tests inject mocked provider
results and failures. Provider timeout, rate limit, and upstream failure are
returned as safe 504, 429, and 502 responses without stack traces.

## Privacy and resource handling

Precise coordinates are not persisted, written to files, or logged by this
module. They remain in React state for the current inspection session only. The
UI tells the user that location is requested only when they choose it. The
reverse-geocoding request sends the coordinates to the configured provider,
which is a necessary consequence of resolving a human-readable address.

## Tests and verification

Executed with the project `.venv`:

```powershell
$env:PYTHONPATH="$PWD\backend"
.venv\Scripts\python.exe -m unittest backend.tests.test_model_integration backend.tests.test_detection_api backend.tests.test_location_api -v
```

Result: **22 tests passed**.

Frontend checks:

```powershell
cd frontend
npm run build
npm run lint
```

Both passed.

Backend live checks:

- `GET /api/health`: HTTP 200
- `GET /api/v1/model/status`: HTTP 200, ready, M1.13-yolov8n
- `POST /api/v1/detection/predict`: existing endpoint remained operational
- `GET /api/v1/location/reverse-geocode`: HTTP 200 from live Nominatim

For the live provider check, Nominatim returned these actual fields for the
request used in verification: road `1st Cross Road`, area `Ashokanagar`, city
`Bengaluru`, state `Karnataka`, country `India`.

Browser verification used Vite and FastAPI. A browser-side geolocation test
hook supplied a known test position because this environment does not expose a
physical GPS device through the browser automation protocol. The backend then
performed real reverse geocoding for that test position, and the UI displayed
coordinates, ±25 m accuracy, and the provider-returned address. A separate
permission-denied simulation displayed the required denial message and retry
control. This simulated browser position is not presented as the user's actual
location.

The existing detection flow was not changed and remains covered by the full
backend regression suite. `best.pt`, M1 datasets, and training artifacts were
not modified.
