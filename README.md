# OSI CLI (TUI)

OSI now uses a compact terminal UI with dropdown-style selectors inspired by modern coding CLIs.

## Install

```bash
bash install_osi.sh
```

or:

```bash
npm install -g .
```

Run from any folder:

```bash
osi
```

## UI features

- Compact branded header and focused prompt line.
- Dropdown-style command menu via `/menu`.
- Dropdown-style provider selector via `/provider`.
- Status/tips header with active provider/model/modes.
- Planned command preview when assistant responds with shell code blocks.

## Provider key setup

When you switch to a hosted provider (`codex`, `groq`, `gemini`, `v0`), OSI prompts for the API key and stores it in:

- `~/.osi/config.json`

You can also run:

- `/set-api-key`

## Commands

- `/help`
- `/provider`
- `/set-api-key`
- `/codebase`
- `/history`
- `/paste`
- `/image <path>`
- `/exec <cmd>`
- `/clear`
- `/exit`

## Keybinds

- `Ctrl+C` exit
- `Ctrl+V` native paste support
- `Ctrl+Z` request cancel
