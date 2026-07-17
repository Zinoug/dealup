from fastapi import APIRouter, Depends

from app.api.dependencies import CurrentUser, DbSession, piloterr_dependency
from app.integrations import PiloterrClient
from app.schemas.api import ListingIdentificationResponse, ListingIdentifyRequest
from app.services import ListingService, UsageService

router = APIRouter(prefix="/v1/listings", tags=["listings"])


@router.post("/identify", response_model=ListingIdentificationResponse)
def identify_listing(
    body: ListingIdentifyRequest,
    user: CurrentUser,
    session: DbSession,
    piloterr: PiloterrClient = Depends(piloterr_dependency),
) -> ListingIdentificationResponse:
    usage = UsageService(session).snapshot(user)
    return ListingService(session, piloterr).identify(
        user, str(body.url), usage.entitlement == "active"
    )


@router.get("/{identification_id}", response_model=ListingIdentificationResponse)
def get_identification(
    identification_id: str,
    user: CurrentUser,
    session: DbSession,
    piloterr: PiloterrClient = Depends(piloterr_dependency),
) -> ListingIdentificationResponse:
    usage = UsageService(session).snapshot(user)
    can_start = usage.entitlement == "active"
    return ListingService(session, piloterr).get(user, identification_id, can_start)
