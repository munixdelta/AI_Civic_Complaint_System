# CVKI Module 2.2 - YOLOv8 Real Inference API

## Endpoint

`POST /api/v1/detection/predict`

Send one image as `multipart/form-data` using the `file` field. JPG/JPEG, PNG,
and WEBP images are accepted. The server verifies the image bytes, not only the
filename or declared MIME type. Uploads are limited to 10 MiB.

The confidence threshold is configured by `YOLO_CONFIDENCE_THRESHOLD` and
defaults to `0.25`. The model is the M1.13 checkpoint loaded once by the FastAPI
lifespan and shared by requests.

## Bounding boxes

Coordinates use the original uploaded image pixel coordinate system:

- `x1`, `y1`: top-left corner
- `x2`, `y2`: bottom-right corner

Coordinates are returned as JSON integers and are clipped to the original image
dimensions.

## Response

Successful responses have this structure. Values are produced by the model and
are not fixed response values:

```json
{
  "success": true,
  "model_version": "M1.13-yolov8n",
  "total_detections": 0,
  "detections": []
}
```

Each detection contains `class_id`, `class_name`, `confidence`, and `bbox`.
The M1.13 class mapping is:

```text
0: open_damaged_manhole
1: damaged_missing_road_sign
2: road_waterlogging
```

No detections are a successful response with an empty `detections` array.

## Errors

- `400`: empty or unreadable image
- `413`: image exceeds 10 MiB
- `415`: unsupported image format
- `503`: model unavailable
- `500`: inference failure

Error responses contain a safe `detail` message and do not expose paths,
tracebacks, or model internals.

## Example request

```bash
curl -X POST http://127.0.0.1:8000/api/v1/detection/predict \
  -F "file=@path/to/image.jpg"
```

## Verification

```bash
python -m unittest backend.tests.test_model_integration backend.tests.test_detection_api -v
```