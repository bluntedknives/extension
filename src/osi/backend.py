from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Dict, List

import requests


@dataclass
class ProviderConfig:
    name: str
    endpoint: str
    api_key_env: str | None


class ModelAPIError(Exception):
    pass


PROVIDERS: dict[str, ProviderConfig] = {
    "local": ProviderConfig("local", "http://127.0.0.1:11434/v1/chat/completions", None),
    "codex": ProviderConfig("codex", "https://api.openai.com/v1/chat/completions", "OPENAI_API_KEY"),
    "groq": ProviderConfig("groq", "https://api.groq.com/openai/v1/chat/completions", "GROQ_API_KEY"),
    "gemini": ProviderConfig(
        "gemini",
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        "GEMINI_API_KEY",
    ),
    "v0": ProviderConfig("v0", "https://api.v0.dev/v1/chat/completions", "V0_API_KEY"),
}


class LocalModelClient:
    """OpenAI-compatible chat endpoint client (local or hosted providers)."""

    def __init__(
        self,
        provider: str,
        endpoint: str,
        model: str,
        timeout: int = 120,
        api_key: str | None = None,
    ) -> None:
        self.provider = provider
        self.endpoint = endpoint
        self.model = model
        self.timeout = timeout
        self.api_key = api_key

    @classmethod
    def from_settings(cls, provider: str, endpoint: str, model: str) -> "LocalModelClient":
        provider_cfg = PROVIDERS.get(provider, PROVIDERS["local"])
        key = os.environ.get(provider_cfg.api_key_env, "") if provider_cfg.api_key_env else ""
        return cls(provider=provider, endpoint=endpoint, model=model, api_key=key or None)

    def chat(self, messages: List[Dict[str, str]]) -> str:
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.2,
        }
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        try:
            resp = requests.post(self.endpoint, json=payload, headers=headers, timeout=self.timeout)
            resp.raise_for_status()
            body = resp.json()
            return body["choices"][0]["message"]["content"]
        except requests.HTTPError as exc:
            raise ModelAPIError(self._friendly_http_error(resp)) from exc
        except requests.RequestException as exc:
            raise ModelAPIError(f"Network/API request failed: {exc}") from exc
        except (KeyError, IndexError, TypeError) as exc:
            raise ModelAPIError("Provider response format was unexpected.") from exc

    def _friendly_http_error(self, response: requests.Response) -> str:
        status = response.status_code
        body_text = response.text or ""
        body_lower = body_text.lower()

        if self.provider != "local":
            if status == 429 or "rate limit" in body_lower or "too many requests" in body_lower:
                return (
                    f"{self.provider} API reports rate limiting (HTTP {status}). "
                    "You might be rate-limited right now; wait and retry."
                )
            if "insufficient_quota" in body_lower or "quota" in body_lower:
                return (
                    f"{self.provider} API reports quota/credits issue (HTTP {status}). "
                    "Your API key may be out of credits."
                )
            if status in (401, 403):
                return (
                    f"{self.provider} API rejected credentials (HTTP {status}). "
                    "Check API key and provider permissions."
                )

        return f"{self.provider} API request failed with HTTP {status}: {body_text[:240]}"
