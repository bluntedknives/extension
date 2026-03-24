import process from "node:process";
import fs from "node:fs";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { ModelAPIError, ModelClient, PROVIDERS } from "./backend.js";
import { summarizeRepo } from "./codebase.js";
import { loadSettings, saveSettings } from "./config.js";
import { executeShell } from "./shell-tools.js";

const BANNER = `
  ▄▄▄   ▄▄▄ ▄
█   █ ▀▄▄  ▄
▀▄▄▄▀ ▄▄▄▀ █
          █
`;

const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  white: "\x1b[37m"
};

function color(text, colorName) {
  return `${colors[colorName]}${text}${colors.reset}`;
}

function gradientLine(text) {
  const palette = ["magenta", "magenta", "white", "white"];
  return text
    .split("")
    .map((char, index) => color(char, palette[index % palette.length]))
    .join("");
}

function startSpinner(label) {
  const frames = ["-", "\\", "|", "/"];
  let index = 0;
  const timer = setInterval(() => {
    process.stdout.write(`\r${frames[index % frames.length]} ${label}`);
    index += 1;
  }, 90);
  return {
    succeed(doneLabel = "Done") {
      clearInterval(timer);
      process.stdout.write(`\r${color(`✓ ${doneLabel}`, "green")}\n`);
    },
    fail(doneLabel = "Failed") {
      clearInterval(timer);
      process.stdout.write(`\r${color(`✗ ${doneLabel}`, "red")}\n`);
    },
    stop() {
      clearInterval(timer);
      process.stdout.write("\r");
    }
  };
}

function printSession(settings) {
  console.log(gradientLine(BANNER));
  console.log(color("osi cli • compact mode", "cyan"));
  console.log(
    `${color("provider", "magenta")}:${settings.provider}  ` +
      `${color("model", "magenta")}:${settings.model}  ` +
      `${color("approvals", "magenta")}:${settings.approvalRequired ? "on" : "off"}  ` +
      `${color("danger", "magenta")}:${settings.dangerMode ? "on" : "off"}`
  );
}

function printHelp() {
  console.log(color("\nOSI Commands", "magenta"));
  console.log("  /help");
  console.log("  /provider <local|codex|groq|gemini|v0>");
  console.log("  /model <name>");
  console.log("  /endpoint <url>");
  console.log("  /prompt");
  console.log("  /prompt set <text>");
  console.log("  /approve on|off");
  console.log("  /danger on|off");
  console.log("  /codebase");
  console.log("  /history");
  console.log("  /paste");
  console.log("  /image <path>");
  console.log("  /exec <cmd>");
  console.log("  /install");
  console.log("  /exit");
}

function showInstall() {
  console.log(color("\nInstall OSI", "green"));
  console.log("  npm install -g .");
  console.log("  osi");
}

async function confirmPrompt(reader, promptText) {
  const answer = (await reader.question(`${promptText} [y/N] `)).trim().toLowerCase();
  return answer === "y" || answer === "yes";
}

async function askModel(settings, userText, repoSummary) {
  const spinner = startSpinner("Thinking...");
  try {
    const client = ModelClient.fromSettings(settings);
    const answer = await client.chat([
      { role: "system", content: settings.persistentPrompt },
      {
        role: "system",
        content:
          "You are connected to OSI CLI. When useful, suggest shell commands and precise file edits.\n\n" +
          `Current repo context:\n${repoSummary}`
      },
      { role: "user", content: userText }
    ]);
    spinner.succeed("Done");
    return answer;
  } catch (error) {
    spinner.fail("Request failed");
    throw error;
  }
}

function renderTips() {
  const tips =
    `${color("tips", "magenta")}  ` +
    "Ctrl+C exit  •  Ctrl+Z blocked  •  native Ctrl+V paste  •  /paste multiline  •  /image path";
  console.log(color("─".repeat(Math.min(process.stdout.columns || 80, 80)), "white"));
  console.log(color(tips, "cyan"));
}

function extractSuggestedCommands(text) {
  const matches = text.match(/```(?:bash|sh)?\n([\s\S]*?)```/g) || [];
  return matches
    .map((block) => block.replace(/```(?:bash|sh)?\n?/g, "").replace(/```/g, "").trim())
    .filter(Boolean)
    .flatMap((chunk) => chunk.split("\n").map((line) => line.trim()).filter(Boolean))
    .slice(0, 5);
}

async function captureMultiline(reader) {
  console.log(color("Paste mode: end with a single '.' line", "yellow"));
  const lines = [];
  while (true) {
    const line = await reader.question("");
    if (line.trim() === ".") {
      break;
    }
    lines.push(line);
  }
  return lines.join("\n");
}

async function handleExec(reader, settings, command) {
  if (!settings.dangerMode && settings.approvalRequired) {
    const ok = await confirmPrompt(reader, `Execute command? ${command}`);
    if (!ok) {
      console.log(color("Cancelled.", "yellow"));
      return;
    }
  }
  const spinner = startSpinner("Running shell command...");
  const result = await executeShell(command);
  spinner.stop();
  if (result.code === 0) {
    console.log(color(`exit=${result.code}`, "green"));
  } else {
    console.log(color(`exit=${result.code}`, "red"));
  }
  if (result.output) {
    console.log(result.output);
  }
}

async function runChat() {
  const reader = readline.createInterface({ input, output });
  const settings = loadSettings();
  let repoSummary = summarizeRepo(process.cwd());
  const history = [];
  const imagePaths = [];

  process.on("SIGTSTP", () => {
    console.log(color("\nCtrl+Z intercepted. Use /exit to quit OSI.", "yellow"));
    renderTips();
  });

  printSession(settings);
  printHelp();
  renderTips();

  while (true) {
    const text = (await reader.question(color("\nosi> ", "cyan"))).trim();
    if (!text) {
      continue;
    }
    if (text === "/exit") {
      break;
    }
    if (text === "/help") {
      printHelp();
      renderTips();
      continue;
    }
    if (text === "/history") {
      const recent = history.slice(-12);
      if (recent.length === 0) {
        console.log(color("No history yet.", "yellow"));
      } else {
        for (const entry of recent) {
          console.log(`${color(`[${entry.role}]`, "magenta")} ${entry.text}`);
        }
      }
      renderTips();
      continue;
    }
    if (text === "/paste") {
      const pasted = await captureMultiline(reader);
      if (!pasted) {
        console.log(color("No pasted content captured.", "yellow"));
        renderTips();
        continue;
      }
      history.push({ role: "user", text: pasted.slice(0, 240) });
      const answer = await askModel(settings, pasted, repoSummary);
      history.push({ role: "assistant", text: answer.slice(0, 240) });
      console.log(color("\nassistant", "magenta"));
      console.log(answer);
      renderTips();
      continue;
    }
    if (text.startsWith("/image ")) {
      const imagePath = text.replace("/image ", "").trim();
      if (!fs.existsSync(imagePath)) {
        console.log(color(`Image path not found: ${imagePath}`, "red"));
      } else {
        imagePaths.push(imagePath);
        console.log(color(`Attached image path: ${imagePath}`, "green"));
      }
      renderTips();
      continue;
    }
    if (text.startsWith("/provider ")) {
      const provider = text.split(" ", 2)[1]?.trim().toLowerCase();
      if (!PROVIDERS[provider]) {
        console.log(color(`Unknown provider: ${provider}`, "red"));
        continue;
      }
      settings.provider = provider;
      settings.endpoint = PROVIDERS[provider].endpoint;
      saveSettings(settings);
      console.log(color(`Provider set to ${provider}. Endpoint reset.`, "green"));
      renderTips();
      continue;
    }
    if (text.startsWith("/model ")) {
      settings.model = text.split(" ", 2)[1]?.trim();
      saveSettings(settings);
      console.log(color(`Model set to ${settings.model}`, "green"));
      renderTips();
      continue;
    }
    if (text.startsWith("/endpoint ")) {
      settings.endpoint = text.split(" ", 2)[1]?.trim();
      saveSettings(settings);
      console.log(color(`Endpoint set to ${settings.endpoint}`, "green"));
      renderTips();
      continue;
    }
    if (text === "/prompt") {
      console.log(settings.persistentPrompt);
      renderTips();
      continue;
    }
    if (text.startsWith("/prompt set ")) {
      settings.persistentPrompt = text.replace("/prompt set ", "").trim();
      saveSettings(settings);
      console.log(color("Prompt updated.", "green"));
      renderTips();
      continue;
    }
    if (text.startsWith("/approve ")) {
      const value = text.split(" ", 2)[1]?.trim().toLowerCase();
      settings.approvalRequired = value === "on";
      saveSettings(settings);
      console.log(color(`Approval mode: ${value}`, "green"));
      renderTips();
      continue;
    }
    if (text.startsWith("/danger ")) {
      const value = text.split(" ", 2)[1]?.trim().toLowerCase();
      settings.dangerMode = value === "on";
      saveSettings(settings);
      console.log(color(`Danger mode: ${value}`, "yellow"));
      renderTips();
      continue;
    }
    if (text === "/codebase") {
      const spinner = startSpinner("Scanning codebase...");
      repoSummary = summarizeRepo(process.cwd());
      spinner.succeed("Done");
      console.log(repoSummary);
      renderTips();
      continue;
    }
    if (text.startsWith("/exec ")) {
      await handleExec(reader, settings, text.replace("/exec ", "").trim());
      renderTips();
      continue;
    }
    if (text === "/install") {
      showInstall();
      renderTips();
      continue;
    }

    try {
      const imageContext =
        imagePaths.length > 0
          ? `\n\nAttached image paths:\n${imagePaths.map((path) => `- ${path}`).join("\n")}`
          : "";
      history.push({ role: "user", text: text.slice(0, 240) });
      const answer = await askModel(settings, `${text}${imageContext}`, repoSummary);
      history.push({ role: "assistant", text: answer.slice(0, 240) });
      console.log(color("\nassistant", "magenta"));
      const suggested = extractSuggestedCommands(answer);
      if (suggested.length > 0) {
        console.log(color("planned/suggested commands:", "yellow"));
        for (const command of suggested) {
          console.log(`  ${color("›", "magenta")} ${command}`);
        }
      }
      console.log(answer);
      renderTips();
    } catch (error) {
      if (error instanceof ModelAPIError) {
        console.log(color(`API error: ${error.message}`, "red"));
        if (settings.provider !== "local") {
          console.log(color("Tip: try `/provider local` or check key/quota.", "yellow"));
        }
      } else {
        console.log(color(`LLM request failed: ${error.message}`, "red"));
      }
      renderTips();
    }
  }

  reader.close();
}

export async function run() {
  const firstArg = process.argv[2] || "chat";
  if (firstArg === "install") {
    showInstall();
    return;
  }
  await runChat();
}
