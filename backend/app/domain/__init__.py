"""Pure DealUp domain rules shared by backend use cases."""

from app.domain.contracts import AnalysisContract, get_analysis_contract
from app.domain.devices import DeviceCompatibility, classify_listing, normalize_listing
from app.domain.legacy import adapt_legacy_result

__all__ = [
    "AnalysisContract",
    "DeviceCompatibility",
    "classify_listing",
    "get_analysis_contract",
    "normalize_listing",
    "adapt_legacy_result",
]
