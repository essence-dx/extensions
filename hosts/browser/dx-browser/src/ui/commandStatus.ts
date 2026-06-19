import type { DxBrowserCommandPlan } from "../runtime/commandPlans.ts";

export type DxBrowserCommandStatusTone = "pending" | "success" | "error" | "info";

export interface DxBrowserCommandStatus {
  tone: DxBrowserCommandStatusTone;
  message: string;
  receiptPath?: string;
}

export function createCommandStatusRegion(): HTMLDivElement {
  const status = document.createElement("div");
  status.className = "command-status";
  status.dataset.commandStatus = "";
  status.dataset.statusTone = "info";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.textContent = "Ready.";
  return status;
}

export function renderCommandStatus(
  root: HTMLElement,
  status: DxBrowserCommandStatus
): void {
  const statusRegion = root.querySelector<HTMLElement>("[data-command-status]");
  if (!statusRegion) {
    return;
  }

  statusRegion.dataset.statusTone = status.tone;
  statusRegion.textContent = formatCommandStatus(status);
}

export function createPendingCommandStatus(
  plan: DxBrowserCommandPlan
): DxBrowserCommandStatus {
  return {
    tone: "pending",
    message: `${plan.title} is running.`
  };
}

export function createCancelledCommandStatus(
  plan: DxBrowserCommandPlan
): DxBrowserCommandStatus {
  return {
    tone: "info",
    message: `${plan.title} was not run.`
  };
}

export function createRuntimeCommandStatus(
  plan: DxBrowserCommandPlan,
  response: unknown
): DxBrowserCommandStatus {
  const parsedResponse = expectRuntimeResponse(response);

  if (!parsedResponse.ok) {
    return {
      tone: "error",
      message: parsedResponse.error
    };
  }

  return {
    tone: "success",
    message: `${plan.title} completed.`,
    receiptPath: parsedResponse.result.receiptPath
  };
}

export function createDispatchErrorCommandStatus(
  error: unknown
): DxBrowserCommandStatus {
  return {
    tone: "error",
    message: formatRuntimeError(error)
  };
}

function formatCommandStatus(status: DxBrowserCommandStatus): string {
  if (!status.receiptPath) {
    return status.message;
  }

  return `${status.message} Receipt: ${status.receiptPath}`;
}

function expectRuntimeResponse(value: unknown): RuntimeCommandResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("DX browser command did not return a runtime response.");
  }

  const response = value as Record<string, unknown>;
  if (response.ok === false) {
    return {
      ok: false,
      error:
        typeof response.error === "string" && response.error.trim()
          ? response.error
          : "DX browser command failed."
    };
  }

  if (response.ok !== true) {
    throw new Error("DX browser command returned an invalid runtime response.");
  }

  return {
    ok: true,
    result: expectRuntimeResult(response.result)
  };
}

function expectRuntimeResult(value: unknown): RuntimeCommandResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result = value as Record<string, unknown>;
  return {
    receiptPath:
      typeof result.receiptPath === "string" && result.receiptPath.trim()
        ? result.receiptPath
        : undefined
  };
}

function formatRuntimeError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "DX browser command dispatch failed.";
}

type RuntimeCommandResponse =
  | {
      ok: true;
      result: RuntimeCommandResult;
    }
  | {
      ok: false;
      error: string;
    };

interface RuntimeCommandResult {
  receiptPath?: string;
}
