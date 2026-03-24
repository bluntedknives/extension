import { execSync } from "node:child_process";
import path from "node:path";

function safeExec(command, cwd) {
  try {
    return execSync(command, { cwd, stdio: ["ignore", "pipe", "ignore"], encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

export function summarizeRepo(rootDir) {
  const filesRaw = safeExec("git ls-files", rootDir);
  const files = filesRaw ? filesRaw.split("\n").filter(Boolean) : [];
  if (files.length === 0) {
    return "No git-tracked files found.";
  }

  const extensionCounts = {};
  for (const file of files) {
    const ext = path.extname(file).toLowerCase() || "[no_ext]";
    extensionCounts[ext] = (extensionCounts[ext] || 0) + 1;
  }

  const topExtensions = Object.entries(extensionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ext, count]) => `${ext}:${count}`)
    .join(", ");

  const sampleFiles = files.slice(0, 40).map((entry) => `- ${entry}`).join("\n");
  return `Repository root: ${rootDir}
Tracked files: ${files.length}
Top extensions: ${topExtensions}
Sample files:
${sampleFiles}`;
}
