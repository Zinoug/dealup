"""Small backend-owned analysis metadata and public device catalog.

Git versions the implementation. These values are persisted only to identify the
engine configuration that produced an analysis; they do not select files at
runtime.
"""

from dataclasses import dataclass
from functools import lru_cache
from typing import Any


ENGINE_CONFIG = {
    "engine_revision": "2026-07-19",
    "schema_version": "2.0",
    "device_catalog_version": "1.0",
}

DEVICE_CATALOG: dict[str, Any] = {
    "version": ENGINE_CONFIG["device_catalog_version"],
    "categories": [
        {
            "code": "IPHONE",
            "label": "iPhone",
            "supported_range": "iPhone 11 et plus récents, iPhone SE 2 et SE 3",
            "asset_key": None,
            "models": [
                "iPhone 11 et générations suivantes",
                "iPhone SE (2e génération)",
                "iPhone SE (3e génération)",
            ],
        },
        {
            "code": "MACBOOK",
            "label": "MacBook",
            "supported_range": (
                "MacBook Air et MacBook Pro avec puce Apple M1 ou plus récente"
            ),
            "asset_key": None,
            "models": [
                "MacBook Air Apple Silicon M1+",
                "MacBook Pro Apple Silicon M1+",
            ],
        },
    ],
    "coming_later": ["iPad", "Apple Watch", "Téléphones Android", "MacBook Intel"],
}


@dataclass(frozen=True)
class AnalysisContract:
    manifest: dict[str, str]
    device_catalog: dict[str, Any]

    @property
    def engine_revision(self) -> str:
        return self.manifest["engine_revision"]


@lru_cache
def get_analysis_contract() -> AnalysisContract:
    return AnalysisContract(
        manifest=dict(ENGINE_CONFIG),
        device_catalog=DEVICE_CATALOG,
    )
