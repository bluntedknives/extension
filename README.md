# LocalCoder CLI

A local-first coding assistant CLI inspired by tools like Codex CLI and Gemini CLI.

## What this project does

- Runs **locally** on your machine.
- Connects to a **local LLM server** (Ollama by default).
- Gives you an interactive CLI with:
  - ASCII splash banner
  - command palette (`/help`, `/model`, `/approve`, `/codebase`, etc.)
  - shell/tool execution with permission gates
  - repository context summaries for coding tasks
- Lets you provide your own **persistent instruction prompt** to "train behavior" (instruction tuning by prompt, not weight training).

> Note: true model training/fine-tuning requires substantial compute and data pipelines. This starter focuses on practical local usage and behavior customization.

---

## Quick start

### 1) Install prerequisites

- Python 3.11+
- [Ollama](https://ollama.com/) (or another OpenAI-compatible local endpoint)

### 2) Pull a local model

```bash
ollama pull qwen2.5-coder:7b
```

### 3) Install this CLI

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
```

### 4) Run

```bash
localcoder
```

---

## Commands

- `/help` – show commands
- `/model <name>` – switch local model
- `/prompt` – view current persistent prompt
- `/prompt set <text>` – replace persistent prompt
- `/approve on|off` – require approval before shell commands
- `/danger on|off` – allow unrestricted shell commands without confirmations
- `/codebase` – summarize key files in current repo
- `/exec <cmd>` – run shell command
- `/exit` – quit

---

## Configuration

The CLI stores config at:

- `~/.localcoder/config.json`

Defaults:

- backend: Ollama-compatible
- endpoint: `http://127.0.0.1:11434/v1/chat/completions`
- model: `qwen2.5-coder:7b`
- approval mode: `on`
- danger mode: `off`

---

## Safety model

- Approval mode (`/approve on`) prompts you before shell execution.
- Danger mode (`/danger on`) skips confirmation and can execute any command.
- Keep danger mode off unless you trust your prompt and environment.

---

## How to “train” behavior locally

You have 3 layers:

1. **Persistent instruction prompt** (`/prompt set ...`)
2. **Project guidance file** (e.g., `AGENTS.md`, `CONTRIBUTING.md`)
3. **Optional fine-tuned model** served locally (outside this repo)

For most use cases, (1) + (2) gives strong control without heavy training infrastructure.

---

## Architecture

- `src/localcoder_cli/main.py`
  - command loop + UX + orchestration
- `src/localcoder_cli/config.py`
  - persisted settings
- `src/localcoder_cli/backend.py`
  - local model client (Ollama/OpenAI-compatible)
- `src/localcoder_cli/codebase.py`
  - lightweight repo context extraction
- `src/localcoder_cli/shell_tools.py`
  - gated shell execution

---

## Disclaimer

This is a starter implementation. For production-grade autonomy, add:

- sandboxing/containers per task
- policy engine for file/network scopes
- audit logs and replay
- model routing and eval harness
- stronger prompt injection defenses
