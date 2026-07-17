from fastapi import APIRouter

from app.schemas.api import CompatibleDevicesResponse
from app.services.catalog import CatalogService


router = APIRouter(prefix="/v1/catalog", tags=["catalog"])


@router.get("/compatible-devices", response_model=CompatibleDevicesResponse)
def compatible_devices() -> CompatibleDevicesResponse:
    return CatalogService().compatible_devices()
