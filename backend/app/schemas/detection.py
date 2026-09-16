from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    """Pixel coordinates in the original uploaded image."""

    x1: int = Field(description="Top-left x coordinate")
    y1: int = Field(description="Top-left y coordinate")
    x2: int = Field(description="Bottom-right x coordinate")
    y2: int = Field(description="Bottom-right y coordinate")


class Detection(BaseModel):
    class_id: int
    class_name: str
    confidence: float = Field(ge=0.0, le=1.0)
    bbox: BoundingBox


class DetectionResponse(BaseModel):
    success: bool
    model_version: str
    total_detections: int = Field(ge=0)
    detections: list[Detection]
    annotated_image: str = Field(description="PNG data URL containing the annotated image")