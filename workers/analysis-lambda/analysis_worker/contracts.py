import json
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any


def _root() -> Path:
    configured = os.getenv("DEALUP_CONTRACTS_DIR")
    candidates = [
        Path(configured) if configured else None,
        Path.cwd() / "contracts" / "analysis",
        Path(__file__).resolve().parents[3] / "contracts" / "analysis",
        Path(__file__).resolve().parents[1] / "contracts" / "analysis",
    ]
    for candidate in candidates:
        if candidate and (candidate / "manifest.json").is_file():
            return candidate
    raise RuntimeError("DealUp analysis contracts are missing")


def _json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise RuntimeError(f"Invalid DealUp contract: {path.name}")
    return value


def _versioned(root: Path, stem: str, version: str, suffix: str = "json") -> Path:
    exact = root / f"{stem}.v{version}.{suffix}"
    return (
        exact
        if exact.is_file()
        else root / f"{stem}.v{version.split('.', 1)[0]}.{suffix}"
    )


@dataclass(frozen=True)
class AnalysisContracts:
    root: Path
    manifest: dict[str, str]
    scoring: dict[str, Any]
    checklists: dict[str, Any]

    def taxonomy(self, category: str) -> tuple[dict[str, Any], dict[str, Any]]:
        version = self.manifest["taxonomy_version"]
        return (
            _json(_versioned(self.root, "taxonomy.common", version)),
            _json(_versioned(self.root, f"taxonomy.{category.lower()}", version)),
        )

    def prompt(self, name: str) -> str:
        version = self.manifest["prompt_version"]
        return (
            _versioned(self.root / "prompts", name, version, "txt")
            .read_text(encoding="utf-8")
            .strip()
        )


@lru_cache
def get_contracts() -> AnalysisContracts:
    root = _root()
    manifest = {
        str(key): str(value) for key, value in _json(root / "manifest.json").items()
    }
    scoring_version = manifest["scoring_version"]
    checklist_version = manifest["checklist_version"]
    return AnalysisContracts(
        root=root,
        manifest=manifest,
        scoring=_json(_versioned(root, "scoring", scoring_version)),
        checklists=_json(_versioned(root, "checklists", checklist_version)),
    )
