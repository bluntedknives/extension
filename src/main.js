import process from "node:process";
import fs from "node:fs";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { ModelAPIError, ModelClient, PROVIDERS } from "./backend.js";
import { summarizeRepo } from "./codebase.js";
import { loadSettings, saveSettings } from "./config.js";
import { executeShell } from "./shell-tools.js";

const LOGO = `
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
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m"
};

const menuItems = [
  "/help",
  "/provider",
  "/set-api-key",
  "/model",
  "/endpoint",
  "/codebase",
  "/history",
  "/paste",
  "/image",
  "/exec",
  "/toggle-approvals",
  "/toggle-danger",
  "/clear",
  "/exit"
];

function color(text, tone) {
  return `${colors[tone]}${text}${colors.reset}`;
}

function printHeader(settings) {
  console.clear();
  const safeLogo = typeof LOGO === "string" && LOGO.length > 0 ? LOGO : "> OSI";
  console.log(color(safeLogo, "magenta"));
  console.log(
    `${color("provider", "blue")}:${settings.provider} ` +
      `${color("model", "blue")}:${settings.model} ` +
      `${color("approvals", "blue")}:${settings.approvalRequired ? "on" : "off"} ` +
      `${color("danger", "blue")}:${settings.dangerMode ? "on" : "off"}`
  );
  console.log(color("Tips: /menu opens command dropdown • /provider opens provider dropdown", "cyan"));
  console.log(color("Keybind style: Ctrl+C exit, Ctrl+V native paste, Ctrl+Z stop current request", "cyan"));
  console.log(color("─".repeat(Math.min(process.stdout.columns || 80, 96)), "white"));
}

function providerKeyName(provider) {
  if (provider === "codex") return "OPENAI_API_KEY";
  if (provider === "groq") return "GROQ_API_KEY";
  if (provider === "gemini") return "GEMINI_API_KEY";
  if (provider === "v0") return "V0_API_KEY";
  return "";
}

async function chooseFromList(reader, title, options) {
  console.log(color(`\n${title}`, "magenta"));
  options.forEach((option, index) => console.log(`  ${index + 1}. ${option}`));
  const raw = (await reader.question(color("select number> ", "blue"))).trim();
  const index = Number(raw) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= options.length) {
    return "";
  }
  return options[index];
}

async function ensureApiKey(reader, settings) {
  if (settings.provider === "local") return true;
  if (settings.apiKeys[settings.provider]) return true;
  const envName = providerKeyName(settings.provider);
  const value = (
    await reader.question(color(`Missing ${envName}. Paste key now (or blank to cancel)> `, "yellow"))
  ).trim();
  if (!value) {
    console.log(color("No API key set.", "red"));
    return false;
  }
  settings.apiKeys[settings.provider] = value;
  saveSettings(settings);
  console.log(color(`Saved key for ${settings.provider}.`, "green"));
  return true;
}

function extractSuggestedCommands(text) {
  const blocks = text.match(/```(?:bash|sh)?\n([\s\S]*?)```/g) || [];
  return blocks
    .map((block) => block.replace(/```(?:bash|sh)?\n?/g, "").replace(/```/g, "").trim())
    .filter(Boolean)
    .flatMap((chunk) => chunk.split("\n").map((line) => line.trim()).filter(Boolean))
    .slice(0, 6);
}

async function runModelQuery(settings, userText, repoSummary, imagePaths) {
  const client = ModelClient.fromSettings(settings);
  const imageContext =
    imagePaths.length > 0 ? `\n\nAttached image paths:\n${imagePaths.map((item) => `- ${item}`).join("\n")}` : "";
  const answer = await client.chat([
    { role: "system", content: settings.persistentPrompt },
    {
      role: "system",
      content:
        "You are connected to OSI CLI. Keep output concise, safe, and command-aware.\n\n" +
        `Repo context:\n${repoSummary}`
    },
    { role: "user", content: `${userText}${imageContext}` }
  ]);
  return answer;
}

export async function run() {
  const mode = process.argv[2] || "chat";
  if (mode === "install") {
    console.log("Install OSI:\n  npm install -g .\n  osi");
    return;
  }

  const reader = readline.createInterface({ input, output });
  let shouldExit = false;
  const settings = loadSettings();
  const history = [];
  const imagePaths = [];
  let repoSummary = summarizeRepo(process.cwd());
  let abortRequested = false;

  process.on("SIGTSTP", () => {
    abortRequested = true;
    console.log(color("\nAbort requested. Request will be skipped before send.", "yellow"));
  });
  reader.on("SIGINT", () => {
    shouldExit = true;
    console.log(color("\nExiting OSI...", "yellow"));
    reader.close();
  });

  printHeader(settings);

  while (true) {
    if (shouldExit) break;
    let text = "";
    try {
      text = (await reader.question(color("\nosi> ", "blue"))).trim();
    } catch (error) {
      if (error?.name === "AbortError") {
        shouldExit = true;
        break;
      }
      throw error;
    }
    try {
      if (!text) continue;

    if (text === "/exit") break;
    if (text === "/clear") {
      printHeader(settings);
      continue;
    }
    if (text === "/help") {
      console.log(`Commands: ${menuItems.join(", ")}`);
      continue;
    }
    if (text === "/menu") {
      const picked = await chooseFromList(reader, "Command menu", menuItems);
      if (!picked) continue;
      if (picked === "/exit") break;
      if (picked === "/clear") {
        printHeader(settings);
        continue;
      }
      if (picked === "/provider") {
        const providers = Object.keys(PROVIDERS);
        const choice = await chooseFromList(reader, "Provider dropdown", providers);
        if (!choice) continue;
        settings.provider = choice;
        settings.endpoint = PROVIDERS[choice].endpoint;
        saveSettings(settings);
        await ensureApiKey(reader, settings);
        console.log(color(`Provider switched to ${choice}.`, "green"));
        printHeader(settings);
        continue;
      }
      if (picked === "/set-api-key") {
        await ensureApiKey(reader, settings);
        continue;
      }
      if (picked === "/toggle-approvals") {
        settings.approvalRequired = !settings.approvalRequired;
        saveSettings(settings);
        printHeader(settings);
        continue;
      }
      if (picked === "/toggle-danger") {
        settings.dangerMode = !settings.dangerMode;
        saveSettings(settings);
        printHeader(settings);
        continue;
      }
      if (picked === "/codebase") {
        repoSummary = summarizeRepo(process.cwd());
        console.log(repoSummary);
        continue;
      }
      if (picked === "/history") {
        for (const item of history.slice(-12)) {
          console.log(`${color(`[${item.role}]`, "magenta")} ${item.text}`);
        }
        continue;
      }
      if (picked === "/paste") {
        const pasted = (await reader.question(color("Paste text> ", "blue"))).trim();
        if (!pasted) continue;
        history.push({ role: "user", text: pasted.slice(0, 300) });
        try {
          if (!(await ensureApiKey(reader, settings))) continue;
          const answer = await runModelQuery(settings, pasted, repoSummary, imagePaths);
          history.push({ role: "assistant", text: answer.slice(0, 300) });
          console.log(color("assistant:", "cyan"), answer);
        } catch (error) {
          console.log(color(error.message, "red"));
        }
        continue;
      }
      if (picked === "/image") {
        const path = (await reader.question(color("Image path> ", "blue"))).trim();
        if (path && fs.existsSync(path)) {
          imagePaths.push(path);
          console.log(color(`Attached: ${path}`, "green"));
        } else {
          console.log(color("Image not found.", "red"));
        }
        continue;
      }
      if (picked === "/exec") {
        const cmd = (await reader.question(color("Command> ", "blue"))).trim();
        if (!cmd) continue;
        if (!settings.dangerMode && settings.approvalRequired) {
          const allow = (await reader.question(color(`Run "${cmd}"? type yes> `, "yellow"))).trim();
          if (allow.toLowerCase() !== "yes") {
            console.log(color("Cancelled.", "yellow"));
            continue;
          }
        }
        console.log(color(`running: ${cmd}`, "yellow"));
        const result = await executeShell(cmd);
        console.log(result.code === 0 ? color(`exit=${result.code}`, "green") : color(`exit=${result.code}`, "red"));
        if (result.output) console.log(result.output);
        continue;
      }
      continue;
    }
    if (text === "/provider") {
      const provider = await chooseFromList(reader, "Provider dropdown", Object.keys(PROVIDERS));
      if (!provider) continue;
      settings.provider = provider;
      settings.endpoint = PROVIDERS[provider].endpoint;
      saveSettings(settings);
      await ensureApiKey(reader, settings);
      printHeader(settings);
      continue;
    }
    if (text === "/set-api-key") {
      await ensureApiKey(reader, settings);
      continue;
    }
    if (text.startsWith("/model ")) {
      settings.model = text.replace("/model ", "").trim();
      saveSettings(settings);
      printHeader(settings);
      continue;
    }
    if (text.startsWith("/endpoint ")) {
      settings.endpoint = text.replace("/endpoint ", "").trim();
      saveSettings(settings);
      printHeader(settings);
      continue;
    }
    if (text === "/codebase") {
      repoSummary = summarizeRepo(process.cwd());
      console.log(repoSummary);
      continue;
    }
    if (text === "/history") {
      for (const item of history.slice(-12)) {
        console.log(`${color(`[${item.role}]`, "magenta")} ${item.text}`);
      }
      continue;
    }
    if (text.startsWith("/image ")) {
      const path = text.replace("/image ", "").trim();
      if (path && fs.existsSync(path)) {
        imagePaths.push(path);
        console.log(color(`Attached: ${path}`, "green"));
      } else {
        console.log(color("Image not found.", "red"));
      }
      continue;
    }
    if (text.startsWith("/exec ")) {
      const cmd = text.replace("/exec ", "").trim();
      if (!cmd) continue;
      if (!settings.dangerMode && settings.approvalRequired) {
        const allow = (await reader.question(color(`Run "${cmd}"? type yes> `, "yellow"))).trim();
        if (allow.toLowerCase() !== "yes") {
          console.log(color("Cancelled.", "yellow"));
          continue;
        }
      }
      console.log(color(`running: ${cmd}`, "yellow"));
      const result = await executeShell(cmd);
      console.log(result.code === 0 ? color(`exit=${result.code}`, "green") : color(`exit=${result.code}`, "red"));
      if (result.output) console.log(result.output);
      continue;
    }
    if (text === "/toggle-approvals") {
      settings.approvalRequired = !settings.approvalRequired;
      saveSettings(settings);
      printHeader(settings);
      continue;
    }
    if (text === "/toggle-danger") {
      settings.dangerMode = !settings.dangerMode;
      saveSettings(settings);
      printHeader(settings);
      continue;
    }

      history.push({ role: "user", text: text.slice(0, 300) });
      console.log(color("thinking...", "magenta"));

      abortRequested = false;
      if (!(await ensureApiKey(reader, settings))) continue;
      if (abortRequested) {
        console.log(color("Request cancelled.", "yellow"));
        continue;
      }

      try {
        const answer = await runModelQuery(settings, text, repoSummary, imagePaths);
        history.push({ role: "assistant", text: answer.slice(0, 300) });
        const commands = extractSuggestedCommands(answer);
        if (commands.length > 0) {
          console.log(color("planned commands:", "yellow"));
          for (const command of commands) {
            console.log(`  ${color("›", "magenta")} ${command}`);
          }
        }
        console.log(color("assistant:", "cyan"), answer);
      } catch (error) {
        if (error instanceof ModelAPIError) {
          console.log(color(`API error: ${error.message}`, "red"));
        } else {
          console.log(color(`error: ${error.message}`, "red"));
        }
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        shouldExit = true;
        break;
      }
      throw error;
    }
  }

  reader.close();
}
