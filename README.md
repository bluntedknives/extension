# OSI CLI (JavaScript)

OSI is now a Node.js CLI, so you can install once and run `osi` from any directory without Python virtualenv activation.
The runtime has no third-party package requirements beyond Node.js itself.

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

If global installs are blocked by your environment, use:

```bash
npm install
npm start
```

## Features

- Interactive terminal assistant for coding tasks.
- Compact Codex/Gemini-style UI sized for smaller terminals.
- Providers: `local`, `codex`, `groq`, `gemini`, `v0`.
- Persistent config in `~/.osi/config.json`.
- Prompt customization with `/prompt` and `/prompt set`.
- Rate-limit/quota/auth detection for hosted providers.
- Shell command execution with approval and danger modes.
- Repo summarization context for codebase-aware responses.
- Suggested command preview extracted from assistant responses.
- Image path attachments using `/image <path>` to include visual context.

## Commands

- `/help`
- `/provider <local|codex|groq|gemini|v0>`
- `/model <name>`
- `/endpoint <url>`
- `/prompt`
- `/prompt set <text>`
- `/approve on|off`
- `/danger on|off`
- `/codebase`
- `/history`
- `/paste` (multiline paste mode, end with `.`)
- `/image <path>`
- `/exec <cmd>`
- `/install`
- `/exit`

Also available:

```bash
osi install
```

## Provider keys

- `OPENAI_API_KEY` for `codex`
- `GROQ_API_KEY` for `groq`
- `GEMINI_API_KEY` for `gemini`
- `V0_API_KEY` for `v0`

`local` typically uses Ollama/OpenAI-compatible local endpoints and does not require API keys.

## Keybinds & tips

- `Ctrl+C`: exit OSI
- `Ctrl+Z`: intercepted (shows reminder; use `/exit`)
- `Ctrl+V`: native terminal paste support
