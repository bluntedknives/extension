# OSI CLI (JavaScript)

OSI is now a Node.js CLI, so you can install once and run `osi` from any directory without Python virtualenv activation.

## Install

### One command (recommended)

```bash
bash install_osi.sh
```

### Manual global install

```bash
npm install -g .
```

Then run from anywhere:

```bash
osi
```

## Features

- Interactive terminal assistant for coding tasks.
- Providers: `local`, `codex`, `groq`, `gemini`, `v0`.
- Persistent config in `~/.osi/config.json`.
- Prompt customization with `/prompt` and `/prompt set`.
- Rate-limit/quota/auth detection for hosted providers.
- Shell command execution with approval and danger modes.
- Repo summarization context for codebase-aware responses.

## Commands
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

## Provider keys
## Provider Keys

Set these when using hosted providers:

- `OPENAI_API_KEY` for `codex`
- `GROQ_API_KEY` for `groq`
- `GEMINI_API_KEY` for `gemini`
- `V0_API_KEY` for `v0`

`local` typically uses Ollama/OpenAI-compatible local endpoints and does not require API keys.
`local` does not require an API key.

## Default Main Prompt

The default persistent prompt is set to your requested OSI-style system prompt and can be changed with:

```bash
/prompt set <new prompt text>
```

## Config File

Saved at:

- `~/.osi/config.json`

It stores provider, endpoint, model, permissions, and prompt.
