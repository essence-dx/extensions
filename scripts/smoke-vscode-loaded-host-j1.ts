import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

import { verifyPackageOutputReceipt } from "./lib/package-output-proof.ts";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = resolve(dirname(scriptPath), "..");
const vscodeExtensionRoot = join(repositoryRoot, "hosts", "vscode", "dx-vscode");
const loadedHostSmokeSourcePath = join(
  vscodeExtensionRoot,
  "tests",
  "loadedHostSmoke.ts"
);
const receiptPath = join(
  repositoryRoot,
  ".dx",
  "receipts",
  "extensions",
  "dx.vscode.command-center",
  "vscode-loaded-host-latest.json"
);
const packageOutputReceiptPath = join(
  repositoryRoot,
  ".dx",
  "receipts",
  "extensions",
  "dx.vscode.command-center",
  "package-output-latest.json"
);

interface CommandContribution {
  command: string;
}

interface VsCodePackageManifest {
  name: string;
  publisher: string;
  contributes?: {
    commands?: CommandContribution[];
  };
}

export interface ExtensionIdentity {
  extensionId: string;
  commandIds: string[];
}

export interface LaunchPaths {
  extensionRoot: string;
  compiledTestPath: string;
  workspacePath: string;
  userDataPath: string;
  extensionsPath: string;
}

export interface VsCodePackageOutputLink {
  receiptPath: string;
  receiptSha256: string;
  packageSha256: string;
  vsixSha256: string;
}

export interface VsCodeLoadedHostReceipt {
  schema_version: "dx.extension.vscode_loaded_host_smoke.v1";
  adapterId: "dx.vscode.command-center";
  extension_id: string;
  command_count: number;
  commandIds: string[];
  packageOutput: VsCodePackageOutputLink;
  workspace_kind: "temporary";
  workspace_path: string;
  loaded_host: "vscode";
  status: "passed";
  stores_process_output: false;
  releaseClaims: {
    loadedExtensionHostVerified: true;
    packageOutputVerified: true;
    localServiceVerified: false;
    signingVerified: false;
    releaseChecksumVerified: false;
    marketplaceReviewVerified: false;
    distributionVerified: false;
  };
}

interface ProcessSummary {
  name: string;
  processId: number;
  commandLine: string;
}

interface WindowsProcessSummary {
  Name: string;
  ProcessId: number;
  CommandLine?: string;
}

export function resolveVsCodeCommand(
  env: Record<string, string | undefined> = process.env
): string {
  if (env.DX_VSCODE_BIN?.trim()) {
    return env.DX_VSCODE_BIN;
  }

  const command = process.platform === "win32" ? "where.exe" : "which";
  const output = execFileSync(command, ["code"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    windowsHide: true
  });
  const candidate = selectVsCodeCommandCandidate(output.split(/\r?\n/), process.platform);

  if (!candidate) {
    throw new Error("VS Code CLI was not found. Set DX_VSCODE_BIN to code.cmd.");
  }

  return candidate;
}

export function selectVsCodeCommandCandidate(
  candidates: string[],
  platform: NodeJS.Platform
): string | undefined {
  const launchCandidates = candidates.map((line) => line.trim()).filter(Boolean);

  if (platform === "win32") {
    return (
      launchCandidates.find((line) => /\\code(?:-insiders)?\.cmd$/i.test(line)) ??
      launchCandidates.find((line) => /\\Code(?: - Insiders)?\.exe$/i.test(line)) ??
      launchCandidates[0]
    );
  }

  return launchCandidates[0];
}

export function createVsCodeSpawnCommand(
  command: string,
  args: string[],
  platform: NodeJS.Platform
): { file: string; args: string[] } {
  if (platform === "win32" && /\.(?:cmd|bat)$/i.test(command)) {
    return {
      file: "cmd.exe",
      args: ["/d", "/s", "/c", "call", command, ...args]
    };
  }

  return {
    file: command,
    args
  };
}

export function formatVsCodeSpawnFailure(result: {
  status: number | null;
  signal: NodeJS.Signals | null;
  error?: Error;
}): string {
  if (result.error) {
    return `VS Code loaded-host smoke failed while launching VS Code: ${result.error.message}.`;
  }

  if (result.signal) {
    return `VS Code loaded-host smoke failed after VS Code exited from signal ${result.signal}.`;
  }

  return `VS Code loaded-host smoke failed with exit code ${result.status ?? "unknown"}.`;
}

export function removeVsCodeSmokeRoot(
  smokeRoot: string,
  removeRoot: (path: string) => void = (path) => rmSync(path, { recursive: true, force: true }),
  warn: (message: string) => void = console.warn
): void {
  try {
    removeRoot(smokeRoot);
  } catch (error) {
    if (isRecoverableSmokeRootCleanupError(error)) {
      warn(`VS Code loaded-host smoke could not remove temporary smoke folder: ${smokeRoot}`);
      return;
    }

    throw error;
  }
}

function isRecoverableSmokeRootCleanupError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "EPERM" || error.code === "EBUSY" || error.code === "ENOTEMPTY")
  );
}

export function readExtensionIdentity(
  manifest: VsCodePackageManifest
): ExtensionIdentity {
  if (!manifest.publisher || !manifest.name) {
    throw new Error("VS Code package manifest must declare publisher and name.");
  }

  const commandIds = (manifest.contributes?.commands ?? []).map(
    (command) => command.command
  );

  if (commandIds.length === 0) {
    throw new Error("VS Code package manifest must contribute commands.");
  }

  return {
    extensionId: `${manifest.publisher}.${manifest.name}`,
    commandIds
  };
}

export function buildLoadedHostEnvironment(
  identity: ExtensionIdentity
): Record<string, string> {
  return {
    DX_VSCODE_SMOKE_EXTENSION_ID: identity.extensionId,
    DX_VSCODE_SMOKE_EXPECTED_COMMANDS: JSON.stringify(identity.commandIds)
  };
}

export function buildVsCodeLaunchArguments(paths: LaunchPaths): string[] {
  return [
    "--user-data-dir",
    paths.userDataPath,
    "--extensions-dir",
    paths.extensionsPath,
    "--disable-extensions",
    "--disable-workspace-trust",
    "--extensionDevelopmentPath",
    paths.extensionRoot,
    "--extensionTestsPath",
    paths.compiledTestPath,
    paths.workspacePath
  ];
}

export function buildVsCodeLoadedHostReceipt(options: {
  identity: ExtensionIdentity;
  packageOutput: VsCodePackageOutputLink;
  workspacePath: string;
}): VsCodeLoadedHostReceipt {
  return {
    schema_version: "dx.extension.vscode_loaded_host_smoke.v1",
    adapterId: "dx.vscode.command-center",
    extension_id: options.identity.extensionId,
    command_count: options.identity.commandIds.length,
    commandIds: [...options.identity.commandIds],
    packageOutput: options.packageOutput,
    workspace_kind: "temporary",
    workspace_path: normalize(options.workspacePath).replaceAll("\\", "/"),
    loaded_host: "vscode",
    status: "passed",
    stores_process_output: false,
    releaseClaims: {
      loadedExtensionHostVerified: true,
      packageOutputVerified: true,
      localServiceVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      marketplaceReviewVerified: false,
      distributionVerified: false
    }
  };
}

export function transpileLoadedHostSmoke(sourcePath: string, outputPath: string): void {
  const source = readFileSync(sourcePath, "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      sourceMap: false,
      strict: true,
      target: ts.ScriptTarget.ES2022
    },
    fileName: sourcePath
  });

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, result.outputText);
}

export function assertNoCompetingHeavyProcess(): void {
  const processes = findWindowsProcesses(["cargo.exe", "rustc.exe", "next.exe", "turbo.exe"]);
  if (processes.length === 0) {
    return;
  }

  throw new Error(
    `Environment blocker: competing heavy process detected: ${summarizeProcesses(processes)}`
  );
}

export function assertNoRunningVsCodeProcess(): void {
  const processes = findWindowsProcesses(["Code.exe"]);
  if (processes.length === 0) {
    return;
  }

  throw new Error(
    `Environment blocker: VS Code is already running: ${summarizeProcesses(processes)}`
  );
}

export function runLoadedHostSmoke(): void {
  assertNoCompetingHeavyProcess();
  assertNoRunningVsCodeProcess();

  const vscodeCommand = resolveVsCodeCommand();
  const packageManifest = JSON.parse(
    readFileSync(join(vscodeExtensionRoot, "package.json"), "utf8")
  ) as VsCodePackageManifest;
  const identity = readExtensionIdentity(packageManifest);
  const packageOutput = readVsCodePackageOutputLink();
  const smokeRoot = mkdtempSync(join(tmpdir(), "dx-vscode-loaded-host-"));

  try {
    const paths: LaunchPaths = {
      extensionRoot: vscodeExtensionRoot,
      compiledTestPath: join(smokeRoot, "tests", "loadedHostSmoke.cjs"),
      workspacePath: join(smokeRoot, "workspace"),
      userDataPath: join(smokeRoot, "user-data"),
      extensionsPath: join(smokeRoot, "extensions")
    };

    mkdirSync(paths.workspacePath, { recursive: true });
    writeFileSync(
      join(paths.workspacePath, "README.md"),
      "# DX VS Code loaded-host smoke workspace\n"
    );

    transpileLoadedHostSmoke(loadedHostSmokeSourcePath, paths.compiledTestPath);

    const launchCommand = createVsCodeSpawnCommand(
      vscodeCommand,
      buildVsCodeLaunchArguments(paths),
      process.platform
    );
    const result = spawnSync(launchCommand.file, launchCommand.args, {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        ...buildLoadedHostEnvironment(identity)
      },
      stdio: "inherit",
      windowsHide: true
    });

    if (result.status !== 0) {
      throw new Error(formatVsCodeSpawnFailure(result));
    }

    writeReceipt(identity, paths.workspacePath, packageOutput);
    console.log("VS Code loaded-host smoke verified");
  } finally {
    removeVsCodeSmokeRoot(smokeRoot);
  }
}

if (isDirectRun()) {
  try {
    runLoadedHostSmoke();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function findWindowsProcesses(names: string[]): ProcessSummary[] {
  if (process.platform !== "win32") {
    return [];
  }

  const quotedNames = names.map((name) => `'${name}'`).join(",");
  const command = [
    `$names = @(${quotedNames});`,
    "$rows = Get-CimInstance Win32_Process |",
    "Where-Object { $names -contains $_.Name } |",
    "Select-Object Name,ProcessId,CommandLine;",
    "$rows | ConvertTo-Json -Compress"
  ].join(" ");

  const output = execFileSync("powershell", ["-NoProfile", "-Command", command], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    windowsHide: true
  }).trim();

  if (!output) {
    return [];
  }

  const parsed = JSON.parse(output) as WindowsProcessSummary | WindowsProcessSummary[];
  return (Array.isArray(parsed) ? parsed : [parsed]).map((process) => ({
    name: process.Name,
    processId: process.ProcessId,
    commandLine: process.CommandLine ?? ""
  }));
}

function summarizeProcesses(processes: ProcessSummary[]): string {
  return processes
    .slice(0, 8)
    .map((process) => `${process.name}:${process.processId}`)
    .join(", ");
}

function readVsCodePackageOutputLink(): VsCodePackageOutputLink {
  const receiptBytes = readFileSync(packageOutputReceiptPath);
  const receipt = JSON.parse(receiptBytes.toString("utf8")) as {
    vsix?: {
      sha256?: unknown;
    };
  };
  const proof = verifyPackageOutputReceipt("dx.vscode.command-center", receipt);

  if (typeof receipt.vsix?.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(receipt.vsix.sha256)) {
    throw new Error("VS Code package-output receipt must include VSIX checksum proof.");
  }

  return {
    receiptPath: packageOutputReceiptPath,
    receiptSha256: createHash("sha256").update(receiptBytes).digest("hex"),
    packageSha256: proof.sha256,
    vsixSha256: receipt.vsix.sha256
  };
}

function writeReceipt(
  identity: ExtensionIdentity,
  workspacePath: string,
  packageOutput: VsCodePackageOutputLink
): void {
  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(
    receiptPath,
    `${JSON.stringify(buildVsCodeLoadedHostReceipt({ identity, packageOutput, workspacePath }), null, 2)}\n`
  );
}

function isDirectRun(): boolean {
  return (
    normalize(resolve(process.argv[1] ?? "")).toLowerCase() ===
    normalize(scriptPath).toLowerCase()
  );
}
