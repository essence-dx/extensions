import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

export type DxCommandId = "status" | "doctor";

export interface DxCommandResult {
  commandId: DxCommandId;
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
}

const DX_EXECUTABLE = "dx";
const DEFAULT_RUN_OPTIONS = {
  timeoutMs: 90000
} as const;

export const DX_RECEIPTS_PATH = join(homedir(), ".dx", "receipts");

export const DX_COMMANDS: Record<DxCommandId, readonly string[]> = {
  status: ["status"],
  doctor: ["doctor"]
} as const;

export function runApprovedDxCommand(
  commandId: DxCommandId,
  options: { timeoutMs?: number } = {}
): Promise<DxCommandResult> {
  const args = DX_COMMANDS[commandId];
  const timeoutMs = options.timeoutMs ?? DEFAULT_RUN_OPTIONS.timeoutMs;

  return new Promise((resolve, reject) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const child = spawn(DX_EXECUTABLE, args, {
      shell: false,
      stdio: "ignore",
      windowsHide: true
    });

    const finish = (result: DxCommandResult) => {
      if (settled) {
        return;
      }

      settled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      resolve(result);
    };

    timeout = setTimeout(() => {
      child.kill();
      finish({
        commandId,
        exitCode: null,
        signal: "timeout",
        timedOut: true
      });
    }, timeoutMs);

    child.once("error", (error) => {
      if (settled) {
        return;
      }

      settled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      reject(error);
    });

    child.once("close", (exitCode, signal) => {
      finish({
        commandId,
        exitCode,
        signal,
        timedOut: false
      });
    });
  });
}

export function describeDxResult(result: DxCommandResult): string {
  if (result.timedOut) {
    return "DX command timed out.";
  }

  if (result.exitCode === 0) {
    return "DX command completed.";
  }

  return "DX command failed.";
}
