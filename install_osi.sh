#!/usr/bin/env bash
set -euo pipefail

echo "==> Creating virtual environment (.venv)"
python -m venv .venv

echo "==> Activating environment"
source .venv/bin/activate

echo "==> Installing OSI CLI"
pip install --upgrade pip
pip install -e .

echo "==> Optional: pull default local model (requires Ollama)"
if command -v ollama >/dev/null 2>&1; then
  ollama pull qwen2.5-coder:7b || true
else
  echo "Ollama not found, skipping model pull."
fi

echo "==> Done. Start with:"
echo "source .venv/bin/activate && osi"
