import json

from fastapi import APIRouter, Depends, Header, Request

from app.api.dependencies import (
    CurrentUser,
    DbSession,
    revenuecat_dependency,
    settings_dependency,
)
from app.core.config import Settings
from app.core.errors import DealUpError
from app.integrations import RevenueCatClient
from app.schemas.api import BillingSyncResponse, MessageResponse
from app.services import BillingService

router = APIRouter(prefix="/v1", tags=["billing"])


@router.post("/billing/sync", response_model=BillingSyncResponse)
def sync_billing(
    user: CurrentUser,
    session: DbSession,
    revenuecat: RevenueCatClient = Depends(revenuecat_dependency),
    settings: Settings = Depends(settings_dependency),
) -> BillingSyncResponse:
    return BillingService(session, settings, revenuecat).sync(user)


@router.post("/webhooks/revenuecat", response_model=MessageResponse)
async def revenuecat_webhook(
    request: Request,
    session: DbSession,
    authorization: str | None = Header(default=None),
    x_revenuecat_webhook_signature: str | None = Header(default=None),
    settings: Settings = Depends(settings_dependency),
) -> MessageResponse:
    raw_body = await request.body()
    service = BillingService(session, settings, RevenueCatClient(settings))
    service.verify_webhook(raw_body, authorization, x_revenuecat_webhook_signature)
    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError as exc:
        raise DealUpError("INVALID_WEBHOOK", "JSON invalide.", 422) from exc
    if not isinstance(payload, dict):
        raise DealUpError("INVALID_WEBHOOK", "Événement invalide.", 422)
    service.process_webhook(payload)
    return MessageResponse(message="ok")
