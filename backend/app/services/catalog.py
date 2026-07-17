from app.domain import get_analysis_contract
from app.schemas.api import CompatibleDevicesResponse


class CatalogService:
    def compatible_devices(self) -> CompatibleDevicesResponse:
        catalog = get_analysis_contract().device_catalog
        return CompatibleDevicesResponse.model_validate(catalog)
