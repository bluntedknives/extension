import process from "node:process";

export class ModelAPIError extends Error {}

export const PROVIDERS = {
  local: {
    name: "local",
    endpoint: "http://127.0.0.1:11434/v1/chat/completions",
    apiKeyEnv: null
  },
  codex: {
    name: "codex",
    endpoint: "https://api.openai.com/v1/chat/completions",
    apiKeyEnv: "OPENAI_API_KEY"
  },
  groq: {
    name: "groq",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    apiKeyEnv: "GROQ_API_KEY"
  },
  gemini: {
    name: "gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    apiKeyEnv: "GEMINI_API_KEY"
  },
  v0: {
    name: "v0",
    endpoint: "https://api.v0.dev/v1/chat/completions",
    apiKeyEnv: "V0_API_KEY"
  }
};

export class ModelClient {
  constructor({ provider, endpoint, model, timeout = 120000, apiKey = null }) {
    this.provider = provider;
    this.endpoint = endpoint;
    this.model = model;
    this.timeout = timeout;
    this.apiKey = apiKey;
  }

  static fromSettings({ provider, endpoint, model }) {
    const providerConfig = PROVIDERS[provider] || PROVIDERS.local;
    const apiKey = providerConfig.apiKeyEnv ? process.env[providerConfig.apiKeyEnv] : null;
    return new ModelClient({ provider, endpoint, model, apiKey });
  }

  async chat(messages) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    const headers = { "Content-Type": "application/json" };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.2
        }),
        signal: controller.signal
      });
      if (!response.ok) {
        const bodyText = await response.text();
        throw new ModelAPIError(this.friendlyHttpError(response.status, bodyText));
      }
      const body = await response.json();
      const content = body?.choices?.[0]?.message?.content;
      if (!content) {
        throw new ModelAPIError("Provider response format was unexpected.");
      }
      return content;
    } catch (error) {
      if (error instanceof ModelAPIError) {
        throw error;
      }
      throw new ModelAPIError(`Network/API request failed: ${error.message}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  friendlyHttpError(status, bodyText = "") {
    const lower = bodyText.toLowerCase();
    if (this.provider !== "local") {
      if (status === 429 || lower.includes("rate limit") || lower.includes("too many requests")) {
        return `${this.provider} API reports rate limiting (HTTP ${status}). You might be rate-limited right now; wait and retry.`;
      }
      if (lower.includes("insufficient_quota") || lower.includes("quota")) {
        return `${this.provider} API reports quota/credits issue (HTTP ${status}). Your API key may be out of credits.`;
      }
      if (status === 401 || status === 403) {
        return `${this.provider} API rejected credentials (HTTP ${status}). Check API key and provider permissions.`;
      }
    }
    return `${this.provider} API request failed with HTTP ${status}: ${bodyText.slice(0, 240)}`;
  }
}
