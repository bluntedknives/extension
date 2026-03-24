#!/usr/bin/env bash
set -euo pipefail

echo "==> Installing OSI globally with npm"
npm install -g .

echo "==> Optional: pull a local coding model if Ollama exists"
if command -v ollama >/dev/null 2>&1; then
  ollama pull qwen2.5-coder:7b || true
else
  echo "Ollama not found, skipping local model pull."
fi

echo "==> Done. You can now run from any directory:"
echo "osi"
