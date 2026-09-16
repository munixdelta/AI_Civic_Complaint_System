# CVKI Module 2.5 - React Frontend Integration

## Architecture

The Vite React frontend now uses the existing `/api/v1/detection/predict`
endpoint. The flow is:

1. The user selects a JPG, JPEG, PNG, or WEBP image.
2. The browser validates type, non-empty content, and the 10 MiB client limit.
3. The selected image is previewed locally with an object URL.
4. Clicking Analyze sends one `FormData` request containing `file`.
5. The backend performs real M1.13 inference and returns detections plus the
   `annotated_image` PNG data URL.
6. React displays the backend image directly and renders the returned detection
   classes, confidence percentages, and bounding-box coordinates.

React does not draw boxes, run inference, or create independent ML results.
The backend `class_name` value remains the source of truth; the UI only applies
human-readable title formatting for display.

## API client

The client is [frontend/src/services/detectionApi.js](../frontend/src/services/detectionApi.js).
It uses browser `fetch` and `FormData` without manually setting the multipart
`Content-Type` boundary. The API origin is configurable with
`VITE_API_BASE_URL`; the development example is in
[frontend/.env.example](../frontend/.env.example).

The client validates the response shape, accepts the PNG data URL only, maps
400/413/415/503 and network failures to safe user messages, and rejects an
unexpected response without exposing backend internals.

## UI behavior

The inspection workspace is implemented in [frontend/src/App.jsx](../frontend/src/App.jsx)
and [frontend/src/App.css](../frontend/src/App.css).

- Selecting an image does not upload it automatically.
- Analyze is disabled until a valid image is selected.
- Analyze is disabled during inference and shows a spinner.
- Reset clears the preview, result, and error state.
- No detections display `No civic issue detected in this image.` while still
  showing the returned annotated/original image.
- Error states include backend unavailable, invalid image, oversized image,
  unsupported format, model unavailable, and unexpected response.
- The layout was checked at desktop and 390px mobile widths.

## CORS

The backend CORS configuration was minimally changed from wildcard origins to
these actual Vite development origins:

- `http://localhost:5173`
- `http://127.0.0.1:5173`

No credentials or arbitrary origins are used.

## Live browser verification

FastAPI and Vite were run with the project environment. A real browser flow
selected each image, displayed the preview, clicked Analyze, and rendered the
backend response. The browser page had no horizontal overflow at 390px.

| Image | HTTP | Actual backend result | Frontend result |
|---|---:|---|---|
| `ai/computer_vision/dataset/images/test/manhole_img-14.jpg` | 200 | 3 x `open_damaged_manhole` | Annotated image and 3 detection rows |
| `ai/computer_vision/dataset/images/test/roadsign_IMG_8666_jpg.rf.e79ba09cf8bbb4ca1d2e1e223e5244be.jpg` | 200 | 1 x `damaged_missing_road_sign` | Annotated image and 1 detection row |
| `ai/computer_vision/dataset/images/test/waterlogging_waterloggingt-103-_jpg.rf.10009ec111cdef89d0e5a8fae80e493c.jpg` | 200 | 5 x `road_waterlogging` | Annotated image and 5 detection rows |
| `ai/computer_vision/dataset/images/test/roadsign_IMG_8100_jpg.rf.efaa0d300ce6c59199fb9f6203b98715.jpg` | 200 | 0 detections | Annotated image and no-detection message |

The displayed classes and confidence values came from live M1.13 API responses;
no frontend prediction data was fabricated. A desktop screenshot confirmed the
annotated manhole image and red backend-rendered boxes were visible. The output
image was not redrawn by React.

## Verification commands

Frontend:

```powershell
cd frontend
npm run build
npm run lint
npm run dev -- --host 127.0.0.1
```

Backend:

```powershell
$env:PYTHONPATH="$PWD\backend"
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The existing backend regression suite remained passing during M2.5 validation.
The frontend has no test framework configured, so validation used the production
build, Oxlint, live HTTP calls, and browser automation rather than adding a new
frontend testing stack.

## Scope and limitations

This module only integrates image inspection. It does not add GPS, maps, NLP,
complaints, authentication, database persistence, or later milestone work.
The browser verification confirms API/UI behavior and observed model output; it
is not an ML accuracy or benchmark evaluation.
