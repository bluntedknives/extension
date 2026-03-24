from __future__ import annotations

import subprocess


def execute_shell(cmd: str) -> tuple[int, str]:
    proc = subprocess.run(cmd, shell=True, text=True, capture_output=True)
    out = (proc.stdout or "") + ("\n" + proc.stderr if proc.stderr else "")
    return proc.returncode, out.strip()
