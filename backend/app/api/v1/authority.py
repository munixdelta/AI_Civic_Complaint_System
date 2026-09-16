from fastapi import APIRouter, HTTPException, Query, status

from app.schemas.authority import AuthorityLocation, AuthorityResolutionResponse
from app.services.authority import AuthorityProviderError, AuthorityProviderTimeout, resolve_authority

router = APIRouter()


@router.get("/resolve", response_model=AuthorityResolutionResponse, summary="Resolve evidence-backed authority context")
def resolve_authority_endpoint(
    latitude: float = Query(..., ge=-90.0, le=90.0),
    longitude: float = Query(..., ge=-180.0, le=180.0),
    road: str | None = None,
    area: str | None = None,
    city: str | None = None,
    district: str | None = None,
    state: str | None = None,
    country: str | None = None,
) -> AuthorityResolutionResponse:
    context = {
        "road": road,
        "area": area,
        "city": city,
        "district": district,
        "state": state,
        "country": country,
    }
    try:
        authority = resolve_authority(
            latitude=latitude,
            longitude=longitude,
            context=context,
        )
    except AuthorityProviderTimeout:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="Authority source timed out.")
    except AuthorityProviderError:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Authority information is temporarily unavailable.")

    return AuthorityResolutionResponse(
        location=AuthorityLocation(
            latitude=latitude,
            longitude=longitude,
            **context,
        ),
        authority=authority,
    )
