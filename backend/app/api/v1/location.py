from fastapi import APIRouter, HTTPException, Query, status

from app.schemas.location import LocationResponse
from app.services.location import (
    LocationProviderError,
    LocationProviderRateLimited,
    LocationProviderTimeout,
    ReverseGeocodingResult,
    reverse_geocode,
)

router = APIRouter()


@router.get("/reverse-geocode", response_model=LocationResponse, summary="Reverse geocode GPS coordinates")
def reverse_geocode_location(
    latitude: float = Query(..., ge=-90.0, le=90.0),
    longitude: float = Query(..., ge=-180.0, le=180.0),
) -> LocationResponse:
    try:
        result: ReverseGeocodingResult = reverse_geocode(latitude, longitude)
    except LocationProviderRateLimited:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Location provider rate limit reached.")
    except LocationProviderTimeout:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="Location provider timed out.")
    except LocationProviderError:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Location information is temporarily unavailable.")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    return LocationResponse(latitude=latitude, longitude=longitude, **result.__dict__)