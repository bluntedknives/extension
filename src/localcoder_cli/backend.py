from __future__ import annotations

from typing import List, Dict

import requests


class LocalModelClient:
    """OpenAI-compatible chat endpoint client (works with Ollama /v1)."""

    def __init__(self, endpoint: str, model: str, timeout: int = 120) -> None:
        self.endpoint = endpoint
        self.model = model
        self.timeout = timeout

    def chat(self, messages: List[Dict[str, str]]) -> str:
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.2,
        }
        resp = requests.post(self.endpoint, json=payload, timeout=self.timeout)
        resp.raise_for_status()
        body = resp.json()
        return body["choices"][0]["message"]["content"]
