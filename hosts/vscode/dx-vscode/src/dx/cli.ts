import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, isAbsolute, join, sep } from "node:path";
import * as vscode from "vscode";

import { DxCliCommandPlan } from "./commandPlan";
import { DxConfiguration } from "./configuration";

export interface DxCommandResult {
  exitCode: number;
  stdoutTail: string;
  stderrTail: string;
}

export interface DxRunOptions {
  token: vscode.CancellationToken;
  title: string;
}

export class DxCli {
  constructor(
    private readonly readConfiguration: () => DxConfiguration,
    private readonly output: vscode.OutputChannel
  ) {}

  async run(plan: DxCliCommandPlan, options: DxRunOptions): Promise<DxCommandResult> {
    if (plan.input !== "none") {
      throw new Error("DX command plan requires host input before execution.");
    }

    const configuration = this.readConfiguration();
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    if (plan.requiresWorkspaceTrust && !workspaceFolder) {
      throw new Error("DX command requires an open workspace.");
    }

    const cwd = workspaceFolder?.uri.fsPath;
    const executable = resolveDxExecutable(configuration.cliPath, cwd);

    if (configuration.autoRevealOutput) {
      this.output.show(true);
    }

    this.output.appendLine(`> ${executable} ${plan.args.join(" ")}`);

    return new Promise<DxCommandResult>((resolve) => {
      const child = spawn(executable, [...plan.args], {
        cwd,
        shell: false,
        windowsHide: true,
        env: safeDxEnvironment()
      });

      let stdoutTail = "";
      let stderrTail = "";
      let settled = false;

      const timeout = setTimeout(() => {
        if (!settled) {
          stderrTail = appendBoundedTail(
            stderrTail,
            `${options.title} timed out after ${configuration.commandTimeoutMs}ms\n`
          );
          terminateProcessTree(child.pid);
        }
      }, configuration.commandTimeoutMs);

      const cancellation = options.token.onCancellationRequested(() => {
        if (!settled) {
          stderrTail = appendBoundedTail(stderrTail, `${options.title} was cancelled\n`);
          terminateProcessTree(child.pid);
        }
      });

      child.stdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        stdoutTail = appendBoundedTail(stdoutTail, text);
        this.output.append(text);
      });

      child.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        stderrTail = appendBoundedTail(stderrTail, text);
        this.output.append(text);
      });

      child.on("error", (error) => {
        stderrTail = appendBoundedTail(stderrTail, `${error.message}\n`);
      });

      child.on("close", (exitCode) => {
        settled = true;
        clearTimeout(timeout);
        cancellation.dispose();
        resolve({
          exitCode: exitCode ?? 1,
          stdoutTail,
          stderrTail
        });
      });
    });
  }
}

const retainedOutputLimit = 16 * 1024;

function appendBoundedTail(current: string, next: string): string {
  const combined = `${current}${next}`;
  if (combined.length <= retainedOutputLimit) {
    return combined;
  }

  return combined.slice(combined.length - retainedOutputLimit);
}

function safeDxEnvironment(): NodeJS.ProcessEnv {
  const names = [
    "PATH",
    "PATHEXT",
    "SystemRoot",
    "WINDIR",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "DX_HOME",
    "DX_CONFIG"
  ];
  const env: NodeJS.ProcessEnv = {};

  for (const name of names) {
    const value = process.env[name];
    if (value) {
      env[name] = value;
    }
  }

  env.CARGO_BUILD_JOBS = "1";
  env.MAKEFLAGS = "-j1";
  env.NINJAFLAGS = "-j1";

  return env;
}

function resolveDxExecutable(configuredPath: string, workspacePath?: string): string {
  const trimmed = configuredPath.trim();
  if (!trimmed) {
    throw new Error("Configure dx.cliPath before running DX commands.");
  }

  if (hasPathSeparator(trimmed)) {
    return validateAbsoluteExecutable(trimmed, workspacePath);
  }

  const resolved = findExecutableOnPath(trimmed);
  if (!resolved) {
    throw new Error(`Unable to resolve ${trimmed} from PATH.`);
  }

  return validateAbsoluteExecutable(resolved, workspacePath);
}

function validateAbsoluteExecutable(path: string, workspacePath?: string): string {
  if (!isAbsolute(path)) {
    throw new Error("dx.cliPath must resolve to an absolute executable path.");
  }

  if (workspacePath && isPathInside(path, workspacePath)) {
    throw new Error("dx.cliPath must not point inside the active workspace.");
  }

  if (!existsSync(path)) {
    throw new Error(`DX executable does not exist: ${path}`);
  }

  return path;
}

function findExecutableOnPath(command: string): string | null {
  const pathValue = process.env.PATH ?? "";
  const extensions =
    process.platform === "win32"
      ? (process.env.PATHEXT ?? ".EXE")
          .split(";")
          .filter(Boolean)
          .map((extension) => extension.toLowerCase())
      : [""];

  for (const directory of pathValue.split(delimiter).filter(Boolean)) {
    for (const extension of extensions) {
      const candidate = join(directory, command.endsWith(extension) ? command : `${command}${extension}`);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function hasPathSeparator(path: string): boolean {
  return path.includes("/") || path.includes("\\");
}

function isPathInside(path: string, parent: string): boolean {
  const normalizedPath = normalizeForCompare(path);
  const normalizedParent = normalizeForCompare(parent);
  return (
    normalizedPath === normalizedParent ||
    normalizedPath.startsWith(`${normalizedParent}${sep}`)
  );
}

function normalizeForCompare(path: string): string {
  return process.platform === "win32" ? path.toLowerCase() : path;
}

function terminateProcessTree(pid: number | undefined): void {
  if (!pid) {
    return;
  }

  if (process.platform === "win32") {
    const systemRoot = process.env.SystemRoot ?? "C:\\Windows";
    const taskkill = join(systemRoot, "System32", "taskkill.exe");
    const child = spawn(taskkill, ["/PID", String(pid), "/T", "/F"], {
      shell: false,
      windowsHide: true,
      stdio: "ignore"
    });
    child.on("error", () => undefined);
    return;
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // The process may already have exited.
  }
}
