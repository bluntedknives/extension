from __future__ import annotations

from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.prompt import Confirm

from .backend import LocalModelClient
from .codebase import summarize_repo
from .config import Settings, load_settings, save_settings
from .shell_tools import execute_shell

console = Console()

BANNER = r"""
 _                    _  _____          _
| |    ___   ___ __ _| |/ ____|___   __| | ___ _ __
| |   / _ \ / __/ _` | | |   / _ \ / _` |/ _ \ '__|
| |__| (_) | (_| (_| | | |__| (_) | (_| |  __/ |
|_____\___/ \___\__,_|_|\_____\___/ \__,_|\___|_|

        LocalCoder CLI - local coding assistant
"""


def print_help() -> None:
    console.print(
        Panel.fit(
            "\n".join(
                [
                    "/help                    Show this help",
                    "/model <name>            Change local model",
                    "/prompt                  Show persistent prompt",
                    "/prompt set <text>       Set persistent prompt",
                    "/approve on|off          Toggle command approvals",
                    "/danger on|off           Toggle unrestricted command execution",
                    "/codebase                Summarize repository",
                    "/exec <cmd>              Execute shell command",
                    "/exit                    Quit",
                ]
            ),
            title="Commands",
        )
    )


def ask_llm(settings: Settings, user_text: str, repo_summary: str) -> str:
    client = LocalModelClient(endpoint=settings.endpoint, model=settings.model)
    messages = [
        {"role": "system", "content": settings.persistent_prompt},
        {
            "role": "system",
            "content": (
                "You are connected to a local coding CLI. "
                "When useful, suggest shell commands and file edits.\n\n"
                f"Current repo context:\n{repo_summary}"
            ),
        },
        {"role": "user", "content": user_text},
    ]
    return client.chat(messages)


def handle_exec(settings: Settings, cmd: str) -> None:
    if not settings.danger_mode and settings.approval_required:
        ok = Confirm.ask(f"Execute command? [bold]{cmd}[/bold]", default=False)
        if not ok:
            console.print("[yellow]Cancelled.[/yellow]")
            return

    rc, output = execute_shell(cmd)
    style = "green" if rc == 0 else "red"
    console.print(f"[bold {style}]exit={rc}[/bold {style}]")
    if output:
        console.print(Panel(output, title="Shell output"))


def run() -> None:
    settings = load_settings()
    repo_root = Path.cwd()
    repo_summary = summarize_repo(repo_root)

    console.print(f"[cyan]{BANNER}[/cyan]")
    console.print(
        Panel.fit(
            f"Model: {settings.model}\nEndpoint: {settings.endpoint}\n"
            f"Approvals: {'on' if settings.approval_required else 'off'}\n"
            f"Danger mode: {'on' if settings.danger_mode else 'off'}",
            title="Session",
        )
    )
    print_help()

    while True:
        text = console.input("\n[bold blue]you> [/bold blue]").strip()
        if not text:
            continue

        if text == "/exit":
            break
        if text == "/help":
            print_help()
            continue
        if text.startswith("/model "):
            settings.model = text.split(" ", 1)[1].strip()
            save_settings(settings)
            console.print(f"[green]Model set to {settings.model}[/green]")
            continue
        if text == "/prompt":
            console.print(Panel(settings.persistent_prompt, title="Persistent prompt"))
            continue
        if text.startswith("/prompt set "):
            settings.persistent_prompt = text.split("/prompt set ", 1)[1].strip()
            save_settings(settings)
            console.print("[green]Prompt updated.[/green]")
            continue
        if text.startswith("/approve "):
            arg = text.split(" ", 1)[1].strip().lower()
            settings.approval_required = arg == "on"
            save_settings(settings)
            console.print(f"[green]Approval mode: {arg}[/green]")
            continue
        if text.startswith("/danger "):
            arg = text.split(" ", 1)[1].strip().lower()
            settings.danger_mode = arg == "on"
            save_settings(settings)
            console.print(f"[yellow]Danger mode: {arg}[/yellow]")
            continue
        if text == "/codebase":
            repo_summary = summarize_repo(repo_root)
            console.print(Panel(repo_summary, title="Codebase summary"))
            continue
        if text.startswith("/exec "):
            cmd = text.split("/exec ", 1)[1].strip()
            handle_exec(settings, cmd)
            continue

        try:
            answer = ask_llm(settings, text, repo_summary)
            console.print(Panel(answer, title="assistant", border_style="magenta"))
        except Exception as exc:
            console.print(f"[red]LLM request failed:[/red] {exc}")


if __name__ == "__main__":
    run()
