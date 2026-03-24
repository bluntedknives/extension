import { spawn } from "node:child_process";

export function executeShell(command) {
  return new Promise((resolve) => {
    const child = spawn(command, {
      shell: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      const output = `${stdout}${stderr ? `\n${stderr}` : ""}`.trim();
      resolve({ code: code ?? 1, output });
    });
  });
}
