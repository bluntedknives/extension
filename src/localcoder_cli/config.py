from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path

CONFIG_DIR = Path.home() / ".localcoder"
CONFIG_PATH = CONFIG_DIR / "config.json"


@dataclass
class Settings:
    endpoint: str = "http://127.0.0.1:11434/v1/chat/completions"
    model: str = "qwen2.5-coder:7b"
    approval_required: bool = True
    danger_mode: bool = False
    persistent_prompt: str = (
        "You are a local coding assistant. Prefer safe, explicit, stepwise changes. "
        "Explain plans briefly, then execute."
    )


def load_settings() -> Settings:
    if not CONFIG_PATH.exists():
        return Settings()
    raw = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    return Settings(**raw)


def save_settings(settings: Settings) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(asdict(settings), indent=2), encoding="utf-8")
