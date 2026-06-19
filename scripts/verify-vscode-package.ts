import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const packagePath = process.argv[2];
if (!packagePath) {
  console.error("usage: node --experimental-strip-types scripts/verify-vscode-package.ts <package.json>");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(packagePath, "utf8"));
const packageRoot = dirname(packagePath);
const failures = [];
const commandIds = new Set((manifest.contributes?.commands ?? []).map((command) => command.command));
const activationEvents = manifest.activationEvents ?? [];
const requiredCommands = [
  "dx.openCommandCenter",
  "dx.copyReceiptsPath",
  "dx.doctor",
  "dx.listForgePackages",
  "dx.openReceipts",
  "dx.searchIcons",
  "dx.showBuildGraph",
  "dx.showCheckEditorState",
  "dx.showLatestCheckReceipt",
  "dx.showStatus"
];
const requiredCommandIds = new Set(requiredCommands);

for (const commandId of commandIds) {
  if (!requiredCommandIds.has(commandId)) {
    failures.push(`unexpected command contribution: ${commandId}`);
  }
}

for (const requiredCommand of requiredCommands) {
  if (!commandIds.has(requiredCommand)) {
    failures.push(`missing command contribution: ${requiredCommand}`);
  }

  if (!activationEvents.includes(`onCommand:${requiredCommand}`)) {
    failures.push(`missing command activation event: ${requiredCommand}`);
  }
}

if (activationEvents.some((event) => event === "onStartupFinished")) {
  failures.push("extension must not activate on startup for the initial command-center bridge");
}

const restricted = manifest.capabilities?.untrustedWorkspaces?.restrictedConfigurations ?? [];
if (!restricted.includes("dx.cliPath")) {
  failures.push("dx.cliPath must be restricted in untrusted workspaces");
}

validatePackageReadme();
validatePackageIgnore();

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log("vscode package metadata verified");

function validatePackageReadme(): void {
  const readmePath = join(packageRoot, "README.md");
  if (!existsSync(readmePath)) {
    failures.push("VS Code extension package must include README.md");
    return;
  }

  const readme = readFileSync(readmePath, "utf8");
  for (const phrase of [
    "DX Command Center",
    "workspace trust",
    "DX CLI",
    "receipts"
  ]) {
    if (!readme.includes(phrase)) {
      failures.push(`VS Code README.md must document ${phrase}`);
    }
  }
}

function validatePackageIgnore(): void {
  const ignorePath = join(packageRoot, ".vscodeignore");
  if (!existsSync(ignorePath)) {
    failures.push("VS Code extension package must include .vscodeignore");
    return;
  }

  const ignoreSource = readFileSync(ignorePath, "utf8");
  for (const pattern of [
    "src/**",
    "tests/**",
    "tsconfig.json",
    "dx.extension.toml",
    "dist/**/*.map",
    "*.vsix"
  ]) {
    if (!hasIgnorePattern(ignoreSource, pattern)) {
      failures.push(`VS Code .vscodeignore must exclude ${pattern}`);
    }
  }
}

function hasIgnorePattern(source: string, pattern: string): boolean {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .includes(pattern);
}
