import json
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any


def _contracts_dir() -> Path:
    configured = os.getenv("DEALUP_CONTRACTS_DIR")
    candidates = [
        Path(configured) if configured else None,
        Path.cwd() / "contracts" / "analysis",
        Path(__file__).resolve().parents[3] / "contracts" / "analysis",
        Path(__file__).resolve().parents[2] / "contracts" / "analysis",
    ]
    for candidate in candidates:
        if candidate and (candidate / "manifest.json").is_file():
            return candidate
    raise RuntimeError("DealUp analysis contracts are missing")


def _read_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise RuntimeError(f"Invalid DealUp contract: {path.name}")
    return value


def _versioned(root: Path, stem: str, version: str) -> Path:
    exact = root / f"{stem}.v{version}.json"
    return (
        exact if exact.is_file() else root / f"{stem}.v{version.split('.', 1)[0]}.json"
    )


@dataclass(frozen=True)
class AnalysisContract:
    root: Path
    manifest: dict[str, str]
    device_catalog: dict[str, Any]

    def versions(self) -> dict[str, str]:
        return dict(self.manifest)


@lru_cache
def get_analysis_contract() -> AnalysisContract:
    root = _contracts_dir()
    manifest = _read_json(root / "manifest.json")
    catalog_version = manifest["device_catalog_version"]
    return AnalysisContract(
        root=root,
        manifest={str(key): str(value) for key, value in manifest.items()},
        device_catalog=_read_json(_versioned(root, "device-catalog", catalog_version)),
    )
