import process from "node:process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import chalk from "chalk";
import ora from "ora";
import { ModelAPIError, ModelClient, PROVIDERS } from "./backend.js";
import { summarizeRepo } from "./codebase.js";
import { loadSettings, saveSettings } from "./config.js";
import { executeShell } from "./shell-tools.js";

const BANNER = `
   ____   _____   _____
  / __ \\ / ____| |_   _|
 | |  | | (___     | |    OSI CLI
 | |  | |\\___ \\    | |    Operator Shell Intelligence
 | |__| |____) |  _| |_   Code. Build. Automate.
  \\____/|_____/  |_____|
`;

function printSession(settings) {
  console.log(chalk.magenta(BANNER));
  console.log(chalk.cyan("Session"));
  console.log(`  Provider: ${chalk.white(settings.provider)}`);
  console.log(`  Model:    ${chalk.white(settings.model)}`);
  console.log(`  Endpoint: ${chalk.white(settings.endpoint)}`);
  console.log(`  Approvals:${chalk.white(settings.approvalRequired ? "on" : "off")}`);
  console.log(`  Danger:   ${chalk.white(settings.dangerMode ? "on" : "off")}`);
}

function printHelp() {
  console.log(chalk.magenta("\nOSI Commands"));
  console.log("  /help");
  console.log("  /provider <local|codex|groq|gemini|v0>");
  console.log("  /model <name>");
  console.log("  /endpoint <url>");
  console.log("  /prompt");
  console.log("  /prompt set <text>");
  console.log("  /approve on|off");
  console.log("  /danger on|off");
  console.log("  /codebase");
  console.log("  /exec <cmd>");
  console.log("  /install");
  console.log("  /exit");
}

function showInstall() {
  console.log(chalk.green("\nInstall OSI"));
  console.log("  npm install -g osi-cli");
  console.log("  osi");
}

async function confirmPrompt(reader, promptText) {
  const answer = (await reader.question(`${promptText} [y/N] `)).trim().toLowerCase();
  return answer === "y" || answer === "yes";
}

async function askModel(settings, userText, repoSummary) {
  const spinner = ora("Thinking...").start();
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

async function handleExec(reader, settings, command) {
  if (!settings.dangerMode && settings.approvalRequired) {
    const ok = await confirmPrompt(reader, `Execute command? ${command}`);
    if (!ok) {
      console.log(chalk.yellow("Cancelled."));
      return;
    }
  }
  const spinner = ora("Running shell command...").start();
  const result = await executeShell(command);
  spinner.stop();
  if (result.code === 0) {
    console.log(chalk.green(`exit=${result.code}`));
  } else {
    console.log(chalk.red(`exit=${result.code}`));
  }
  if (result.output) {
    console.log(result.output);
  }
}

async function runChat() {
  const reader = readline.createInterface({ input, output });
  const settings = loadSettings();
  let repoSummary = summarizeRepo(process.cwd());

  printSession(settings);
  printHelp();

  while (true) {
    const text = (await reader.question(chalk.cyan("\nosi> "))).trim();
    if (!text) {
      continue;
    }
    if (text === "/exit") {
      break;
    }
    if (text === "/help") {
      printHelp();
      continue;
    }
    if (text.startsWith("/provider ")) {
      const provider = text.split(" ", 2)[1]?.trim().toLowerCase();
      if (!PROVIDERS[provider]) {
        console.log(chalk.red(`Unknown provider: ${provider}`));
        continue;
      }
      settings.provider = provider;
      settings.endpoint = PROVIDERS[provider].endpoint;
      saveSettings(settings);
      console.log(chalk.green(`Provider set to ${provider}. Endpoint reset.`));
      continue;
    }
    if (text.startsWith("/model ")) {
      settings.model = text.split(" ", 2)[1]?.trim();
      saveSettings(settings);
      console.log(chalk.green(`Model set to ${settings.model}`));
      continue;
    }
    if (text.startsWith("/endpoint ")) {
      settings.endpoint = text.split(" ", 2)[1]?.trim();
      saveSettings(settings);
      console.log(chalk.green(`Endpoint set to ${settings.endpoint}`));
      continue;
    }
    if (text === "/prompt") {
      console.log(settings.persistentPrompt);
      continue;
    }
    if (text.startsWith("/prompt set ")) {
      settings.persistentPrompt = text.replace("/prompt set ", "").trim();
      saveSettings(settings);
      console.log(chalk.green("Prompt updated."));
      continue;
    }
    if (text.startsWith("/approve ")) {
      const value = text.split(" ", 2)[1]?.trim().toLowerCase();
      settings.approvalRequired = value === "on";
      saveSettings(settings);
      console.log(chalk.green(`Approval mode: ${value}`));
      continue;
    }
    if (text.startsWith("/danger ")) {
      const value = text.split(" ", 2)[1]?.trim().toLowerCase();
      settings.dangerMode = value === "on";
      saveSettings(settings);
      console.log(chalk.yellow(`Danger mode: ${value}`));
      continue;
    }
    if (text === "/codebase") {
      const spinner = ora("Scanning codebase...").start();
      repoSummary = summarizeRepo(process.cwd());
      spinner.succeed("Done");
      console.log(repoSummary);
      continue;
    }
    if (text.startsWith("/exec ")) {
      await handleExec(reader, settings, text.replace("/exec ", "").trim());
      continue;
    }
    if (text === "/install") {
      showInstall();
      continue;
    }

    try {
      const answer = await askModel(settings, text, repoSummary);
      console.log(chalk.magenta("\nassistant"));
      console.log(answer);
    } catch (error) {
      if (error instanceof ModelAPIError) {
        console.log(chalk.red(`API error: ${error.message}`));
        if (settings.provider !== "local") {
          console.log(chalk.yellow("Tip: try `/provider local` or check key/quota."));
        }
      } else {
        console.log(chalk.red(`LLM request failed: ${error.message}`));
      }
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
