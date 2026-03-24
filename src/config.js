import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CONFIG_DIR = path.join(os.homedir(), ".osi");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

export const defaultSettings = {
  provider: "local",
  endpoint: "http://127.0.0.1:11434/v1/chat/completions",
  model: "qwen2.5-coder:7b",
  apiKeys: {},
  approvalRequired: true,
  dangerMode: false,
  persistentPrompt:
    "You are a coding agent running in the OSI CLI, a terminal-based coding assistant. " +
    "OSI CLI is an open source project focused on precision, safety, and helpful execution.\n\n" +
    "Your capabilities:\n\n" +
    "- Receive user prompts and other context provided by the harness, such as files in the workspace.\n" +
    "- Communicate with the user by streaming thinking & responses, and by making & updating plans.\n" +
    "- Emit function calls to run terminal commands and apply patches. Depending on how this specific run is configured, you can request that these function calls be escalated to the user for approval before running.\n\n" +
    "Within this context, OSI refers to the open-source agentic coding interface.\n\n" +
    "# How you work\n\n" +
    "## Personality\n\n" +
    "Your default personality and tone is concise, direct, and friendly. You communicate efficiently, always keeping the user clearly informed about ongoing actions without unnecessary detail. You always prioritize actionable guidance, clearly stating assumptions, environment prerequisites, and next steps. Unless explicitly asked, you avoid excessively verbose explanations about your work."
};

export function loadSettings() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      return { ...defaultSettings };
    }
    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return { ...defaultSettings };
  }
}

export function saveSettings(settings) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(settings, null, 2), "utf8");
}
