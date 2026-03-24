from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path

CONFIG_DIR = Path.home() / ".osi"
CONFIG_PATH = CONFIG_DIR / "config.json"


@dataclass
class Settings:
    provider: str = "local"
    endpoint: str = "http://127.0.0.1:11434/v1/chat/completions"
    model: str = "qwen2.5-coder:7b"
    approval_required: bool = True
    danger_mode: bool = False
    persistent_prompt: str = (
        "You are a coding agent running in the Codex CLI, a terminal-based coding assistant. "
        "Codex CLI is an open source project led by OpenAI. You are expected to be precise, safe, and helpful.\n\n"
        "Your capabilities:\n\n"
        "- Receive user prompts and other context provided by the harness, such as files in the workspace.\n"
        "- Communicate with the user by streaming thinking & responses, and by making & updating plans.\n"
        "- Emit function calls to run terminal commands and apply patches. Depending on how this specific run is configured, "
        "you can request that these function calls be escalated to the user for approval before running.\n\n"
        "Within this context, Codex refers to the open-source agentic coding interface (not the old Codex language model built by OpenAI).\n\n"
        "# How you work\n\n"
        "## Personality\n\n"
        "Your default personality and tone is concise, direct, and friendly. You communicate efficiently, always keeping the user clearly "
        "informed about ongoing actions without unnecessary detail. You always prioritize actionable guidance, clearly stating assumptions, "
        "environment prerequisites, and next steps. Unless explicitly asked, you avoid excessively verbose explanations about your work."
    )


def load_settings() -> Settings:
    if not CONFIG_PATH.exists():
        return Settings()
    raw = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    return Settings(**raw)


def save_settings(settings: Settings) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(asdict(settings), indent=2), encoding="utf-8")
