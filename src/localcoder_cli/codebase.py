from __future__ import annotations

import subprocess
from pathlib import Path


def _run(cmd: list[str], cwd: Path) -> str:
    try:
        out = subprocess.check_output(cmd, cwd=cwd, text=True, stderr=subprocess.STDOUT)
        return out.strip()
    except Exception:
        return ""


def summarize_repo(root: Path) -> str:
    files = _run(["git", "ls-files"], root).splitlines()
    if not files:
        return "No git-tracked files found."

    top = files[:40]
    languages = {}
    for f in files:
        suffix = Path(f).suffix.lower() or "[no_ext]"
        languages[suffix] = languages.get(suffix, 0) + 1

    lang_summary = ", ".join(
        f"{k}:{v}" for k, v in sorted(languages.items(), key=lambda x: x[1], reverse=True)[:10]
    )

    return (
        f"Repository root: {root}\n"
        f"Tracked files: {len(files)}\n"
        f"Top extensions: {lang_summary}\n"
        "Sample files:\n"
        + "\n".join(f"- {x}" for x in top)
    )
