# CVKI Module 2.4 - Annotated Detection Image Output

## Scope

M2.4 extends the existing `POST /api/v1/detection/predict` response with an
annotated image generated from the same real M1.13 YOLOv8 inference result.
M2.1, M2.2, and M2.3 behavior remains intact. No uploaded image is persisted.

## Annotation architecture

1. The router validates the upload using the existing M2.2/M2.3 checks.
2. The shared `cv_model_service` performs one inference.
3. The service returns the existing structured detections.
4. The service annotation function draws those returned detections onto an
   in-memory RGB copy of the original image.
5. The router encodes that copy as a PNG data URL in the JSON response.

There is no second model inference and no temporary or permanent image file.
Annotation failures use the existing client-safe inference error behavior.

## API response extension

The existing response fields remain unchanged. A successful response now also
contains:

```json
{
  "annotated_image": "data:image/png;base64,..."
}
```

The value contains only the generated PNG image using the standard
`data:image/png;base64,` prefix. Clients can decode the base64 payload as a PNG.
This avoids filesystem paths and keeps the existing JSON endpoint unchanged for
callers that ignore the additional field.

## Annotation rules

- Coordinates use the original uploaded image dimensions.
- `x1`, `y1` are the top-left corner.
- `x2`, `y2` are the bottom-right corner.
- Coordinates are clipped and invalid boxes are skipped before drawing.
- Labels use the class name already resolved from the M1.13 model mapping.
- Confidence is displayed to two decimal places, for example
  `open_damaged_manhole 0.83`.
- Boxes are drawn in red with a readable white label on a red background.

If there are no detections, the response still contains a valid PNG annotated
image. It has the original pixels and dimensions, with no invented boxes or
labels.

## Real-image live verification

All images were read directly from the project dataset. No source image was
copied or modified.

| Image | HTTP | Detections/classes | Source size | Annotated output |
|---|---:|---|---|---|
| `ai/computer_vision/dataset/images/test/manhole_img-14.jpg` | 200 | 3: `open_damaged_manhole` x3 | 720x720 | PNG, 720x720 |
| `ai/computer_vision/dataset/images/test/roadsign_IMG_8666_jpg.rf.e79ba09cf8bbb4ca1d2e1e223e5244be.jpg` | 200 | 1: `damaged_missing_road_sign` | 640x640 | PNG, 640x640 |
| `ai/computer_vision/dataset/images/test/waterlogging_waterloggingt-103-_jpg.rf.10009ec111cdef89d0e5a8fae80e493c.jpg` | 200 | 5: `road_waterlogging` x5 | 512x384 | PNG, 512x384 |
| `ai/computer_vision/dataset/images/test/roadsign_IMG_8100_jpg.rf.efaa0d300ce6c59199fb9f6203b98715.jpg` | 200 | 0 | 640x640 | PNG, 640x640 |

Each generated image was base64-decoded, fully loaded by Pillow, and checked
for matching dimensions and PNG format. The detected manhole output differed
from the original pixels, confirming drawing occurred. The genuine negative
output remained pixel-equivalent to the original after RGB conversion.

These are observed M1.13 predictions, not fabricated fixtures or ML accuracy
metrics.

## Automated tests

Executed with the project environment:

```powershell
$env:PYTHONPATH="$PWD\backend"
.venv\Scripts\python.exe -m unittest backend.tests.test_model_integration backend.tests.test_detection_api -v
```

Result: **16 tests passed**.

Coverage includes:

- Existing M2.1 health, model status, and model failure tests.
- Existing M2.2/M2.3 request validation and threshold tests.
- Valid annotated response schema and PNG decoding.
- Matching source/output dimensions for representative images.
- Pixel change for an actual detected image.
- Genuine no-detection output with no fake detections and unchanged pixels.
- Malformed, empty, unsupported, non-image, and oversized uploads.
- JSON-safe response values and valid bounding boxes.

## Existing endpoint smoke verification

Using Uvicorn and the project `.venv`:

```powershell
$env:PYTHONPATH="$PWD\backend"
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Verified:

- `GET /api/health`: HTTP 200
- `GET /api/v1/model/status`: HTTP 200, M1.13 ready
- `POST /api/v1/detection/predict`: HTTP 200 with real annotated output

The server was stopped cleanly after verification.

## Integrity and limitations

The frozen `best.pt` checkpoint remained read-only. M1 datasets and training
artifacts were not modified, and no frontend or M2.5 work was started.

This feature verifies image generation and API behavior. It does not measure
visual quality, precision, recall, mAP, latency, concurrency, or ML accuracy.
