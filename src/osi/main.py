from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.prompt import Confirm
from rich.table import Table

from .backend import PROVIDERS, LocalModelClient, ModelAPIError
from .codebase import summarize_repo
from .config import Settings, load_settings, save_settings
from .shell_tools import execute_shell

console = Console()

BANNER = r"""
   ____   _____   _____
  / __ \ / ____| |_   _|
 | |  | | (___     | |    OSI CLI
 | |  | |\___ \    | |    Operator Shell Intelligence
 | |__| |____) |  _| |_   Code. Build. Automate.
  \____/|_____/  |_____|
"""


def render_session(settings: Settings) -> None:
    panel_text = (
        f"[bold cyan]Provider[/bold cyan]: {settings.provider}\n"
        f"[bold cyan]Model[/bold cyan]: {settings.model}\n"
        f"[bold cyan]Endpoint[/bold cyan]: {settings.endpoint}\n"
        f"[bold cyan]Approvals[/bold cyan]: {'on' if settings.approval_required else 'off'}\n"
        f"[bold cyan]Danger mode[/bold cyan]: {'on' if settings.danger_mode else 'off'}"
    )
    console.print(Panel.fit(panel_text, border_style="bright_magenta", title="Session"))


def print_help() -> None:
    table = Table(title="OSI Commands", header_style="bold magenta")
    table.add_column("Command", style="cyan")
    table.add_column("Description", style="white")
    table.add_row("/help", "Show command list")
    table.add_row("/provider <local|codex|groq|gemini|v0>", "Switch AI provider")
    table.add_row("/model <name>", "Change model name")
    table.add_row("/endpoint <url>", "Override chat endpoint")
    table.add_row("/prompt", "Show persistent main prompt")
    table.add_row("/prompt set <text>", "Replace persistent main prompt")
    table.add_row("/approve on|off", "Toggle command approvals")
    table.add_row("/danger on|off", "Toggle unrestricted command execution")
    table.add_row("/codebase", "Summarize current repo")
    table.add_row("/exec <cmd>", "Execute shell command")
    table.add_row("/install", "Show install command")
    table.add_row("/exit", "Quit")
    console.print(table)


def with_spinner(message: str, func):
    with console.status(f"[bold magenta]{message}[/bold magenta]", spinner="dots12"):
        return func()


def ask_llm(settings: Settings, user_text: str, repo_summary: str) -> str:
    client = LocalModelClient.from_settings(
        provider=settings.provider,
        endpoint=settings.endpoint,
        model=settings.model,
    )
    messages = [
        {"role": "system", "content": settings.persistent_prompt},
        {
            "role": "system",
            "content": (
                "You are connected to OSI CLI. "
                "When useful, suggest shell commands and precise file edits.\n\n"
                f"Current repo context:\n{repo_summary}"
            ),
        },
        {"role": "user", "content": user_text},
    ]
    return with_spinner("Thinking...", lambda: client.chat(messages))


def handle_exec(settings: Settings, cmd: str) -> None:
    if not settings.danger_mode and settings.approval_required:
        ok = Confirm.ask(f"Execute command? [bold]{cmd}[/bold]", default=False)
        if not ok:
            console.print("[yellow]Cancelled.[/yellow]")
            return

    rc, output = with_spinner("Running shell command...", lambda: execute_shell(cmd))
    style = "green" if rc == 0 else "red"
    console.print(f"[bold {style}]exit={rc}[/bold {style}]")
    if output:
        console.print(Panel(output, title="Shell output", border_style="cyan"))


def show_install_command() -> None:
    install_text = (
        "[bold]Install OSI:[/bold]\n"
        "bash install_osi.sh\n\n"
        "[bold]or manually:[/bold]\n"
        "python -m venv .venv && source .venv/bin/activate && pip install -e ."
    )
    console.print(Panel(install_text, title="Install", border_style="green"))


def set_provider(settings: Settings, provider: str) -> None:
    if provider not in PROVIDERS:
        console.print(f"[red]Unknown provider:[/red] {provider}")
        return
    provider_cfg = PROVIDERS[provider]
    settings.provider = provider
    settings.endpoint = provider_cfg.endpoint
    save_settings(settings)
    console.print(
        f"[green]Provider set to {provider}. "
        f"Endpoint reset to {provider_cfg.endpoint}[/green]"
    )


def run_chat() -> None:
    settings = load_settings()
    repo_root = Path.cwd()
    repo_summary = summarize_repo(repo_root)

    console.print(f"[bold magenta]{BANNER}[/bold magenta]")
    render_session(settings)
    print_help()

    while True:
        text = console.input("\n[bold cyan]osi> [/bold cyan]").strip()
        if not text:
            continue
        if text == "/exit":
            break
        if text == "/help":
            print_help()
            continue
        if text.startswith("/provider "):
            set_provider(settings, text.split(" ", 1)[1].strip().lower())
            continue
        if text.startswith("/model "):
            settings.model = text.split(" ", 1)[1].strip()
            save_settings(settings)
            console.print(f"[green]Model set to {settings.model}[/green]")
            continue
        if text.startswith("/endpoint "):
            settings.endpoint = text.split(" ", 1)[1].strip()
            save_settings(settings)
            console.print(f"[green]Endpoint set to {settings.endpoint}[/green]")
            continue
        if text == "/prompt":
            console.print(Panel(settings.persistent_prompt, title="Main prompt"))
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
            repo_summary = with_spinner("Scanning codebase...", lambda: summarize_repo(repo_root))
            console.print(Panel(repo_summary, title="Codebase summary", border_style="blue"))
            continue
        if text.startswith("/exec "):
            handle_exec(settings, text.split("/exec ", 1)[1].strip())
            continue
        if text == "/install":
            show_install_command()
            continue

        try:
            answer = ask_llm(settings, text, repo_summary)
            console.print(Panel(answer, title="assistant", border_style="magenta"))
        except ModelAPIError as exc:
            console.print(f"[red]API error:[/red] {exc}")
            if settings.provider != "local":
                console.print(
                    "[yellow]Tip:[/yellow] if this keeps happening, switch to "
                    "`/provider local` or check your key/quota."
                )
        except Exception as exc:
            console.print(f"[red]LLM request failed:[/red] {exc}")


def run() -> None:
    parser = argparse.ArgumentParser(prog="osi", description="OSI coding assistant CLI")
    parser.add_argument("command", nargs="?", default="chat", choices=["chat", "install"])
    args = parser.parse_args()

    if args.command == "install":
        show_install_command()
        return
    run_chat()


if __name__ == "__main__":
    run()
