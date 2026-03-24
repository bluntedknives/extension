# OSI CLI

OSI (Operator Shell Intelligence) is a coding assistant CLI with a clean terminal UI, shell execution controls, repository awareness, and support for both local and hosted AI providers.

## Highlights

- `osi` command with interactive coding chat loop.
- “Sexy/clean” terminal design using Rich tables, panels, colors, and spinner animations.
- Providers:
  - `local` (Ollama/OpenAI-compatible local endpoint)
  - `codex` (OpenAI endpoint)
  - `groq`
  - `gemini` (OpenAI-compatible Gemini endpoint)
  - `v0`
- Persistent “main prompt” you can fully customize.
- Shell execution with approval mode and optional danger mode.
- Codebase summarization so the model can reason about your repo.

## Install

### One command

```bash
bash install_osi.sh
```

### Manual

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
```

Run:

```bash
osi
```

## CLI Commands

- `/help`
- `/provider <local|codex|groq|gemini|v0>`
- `/model <name>`
- `/endpoint <url>`
- `/prompt`
- `/prompt set <text>`
- `/approve on|off`
- `/danger on|off`
- `/codebase`
- `/exec <cmd>`
- `/install`
- `/exit`

Also available:

```bash
osi install
```

## Provider Keys

Set these when using hosted providers:

- `OPENAI_API_KEY` for `codex`
- `GROQ_API_KEY` for `groq`
- `GEMINI_API_KEY` for `gemini`
- `V0_API_KEY` for `v0`

`local` does not require an API key.

## Default Main Prompt

The default persistent prompt is set to your requested Codex-style system prompt and can be changed with:

```bash
/prompt set <new prompt text>
```

## Config File

Saved at:

- `~/.osi/config.json`

It stores provider, endpoint, model, permissions, and prompt.
