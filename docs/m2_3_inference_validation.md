# CVKI Module 2.3 - Inference API Validation

## Scope and test strategy

M2.3 validates the existing M2.2 API with the frozen M1.13 YOLOv8n checkpoint.
Tests exercise the HTTP contract through FastAPI `TestClient`, plus a live
Uvicorn smoke check. The dataset files are read in place and are not copied or
modified.

This validation distinguishes:

- **API correctness:** status codes, JSON/schema types, safe errors, and bounds.
- **Actual model predictions:** detections returned by M1.13 for selected images.
- **ML accuracy/benchmarks:** not measured by these tests; no accuracy claim is
  made here.

## Real images used

| Role | Source image | Actual result at threshold 0.25 |
|---|---|---|
| Manhole | `ai/computer_vision/dataset/images/test/manhole_img-14.jpg` | 3 detections, all `open_damaged_manhole` (class 0) |
| Road sign | `ai/computer_vision/dataset/images/test/roadsign_IMG_8666_jpg.rf.e79ba09cf8bbb4ca1d2e1e223e5244be.jpg` | 1 detection, `damaged_missing_road_sign` (class 1) |
| Waterlogging | `ai/computer_vision/dataset/images/test/waterlogging_waterloggingt-103-_jpg.rf.10009ec111cdef89d0e5a8fae80e493c.jpg` | 5 detections, all `road_waterlogging` (class 2) |
| Negative candidate | `ai/computer_vision/dataset/images/test/roadsign_IMG_8100_jpg.rf.efaa0d300ce6c59199fb9f6203b98715.jpg` | 0 detections |

The live predictions above are observations from the model, not hard-coded test
fixtures. The negative candidate has an empty test label file and produced the
successful no-detection response `detections: []`.

## Validation coverage

For each real image, tests verify HTTP 200, `success`, model version, detection
count, class mapping, confidence range, JSON serialization, and bounding boxes.
For every returned box, the checks enforce:

- `0 <= x1 < x2 <= image width`
- `0 <= y1 < y2 <= image height`

Input validation covers non-image bytes, malformed image bytes, empty uploads,
GIF uploads, and an upload larger than the configured 10 MiB limit. Error
responses are checked for suitable status codes and absence of paths or
tracebacks.

## Confidence threshold

The configured default is `0.25`. On the real manhole image, threshold `0.25`
returned 3 detections with confidences `0.830706`, `0.718154`, and `0.655639`.
At threshold `0.75`, the API returned 1 detection with confidence `0.830706`.
The service explicitly filters returned confidences so reused predictor state
cannot expose values below the configured threshold.

This is threshold behavior validation only, not an accuracy or quality
measurement.

## Test execution

```powershell
$env:PYTHONPATH="$PWD\backend"
.venv\Scripts\python.exe -m unittest backend.tests.test_model_integration backend.tests.test_detection_api -v
```

The complete suite passed: **16 tests, 16 passed**.

## Live Uvicorn verification

```powershell
$env:PYTHONPATH="$PWD\backend"
.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Verified against the running server:

- `GET /api/health`: HTTP 200
- `GET /api/v1/model/status`: HTTP 200, model ready, three expected classes
- `POST /api/v1/detection/predict`: HTTP 200 with real image inference

The server was stopped cleanly after verification. The frozen `best.pt` file and
M1 datasets/training artifacts were not modified.

## Known limitations

These tests validate API behavior and observed inference outputs only. They do
not establish precision, recall, mAP, calibration, latency targets, concurrent
load behavior, or generalization beyond the selected project images.