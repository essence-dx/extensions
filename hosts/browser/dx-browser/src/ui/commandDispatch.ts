import { resolveDxBrowserCommandPlan } from "../runtime/commandPlans.ts";
import { createDxBrowserCommandMessage } from "../runtime/messages.ts";
import {
  createCancelledCommandStatus,
  createDispatchErrorCommandStatus,
  createPendingCommandStatus,
  createRuntimeCommandStatus
} from "./commandStatus.ts";
import type { DxBrowserCommandPlan } from "../runtime/commandPlans.ts";
import type { DxBrowserCommandStatus } from "./commandStatus.ts";

export interface DxBrowserUiRuntime {
  sendMessage(message: unknown): Promise<unknown> | unknown;
}

export interface DxBrowserCommandDispatchOptions {
  runtime: DxBrowserUiRuntime;
  confirmCommand?: (plan: DxBrowserCommandPlan) => Promise<boolean> | boolean;
  reportError?: (error: unknown) => void;
  reportStatus?: (status: DxBrowserCommandStatus) => void;
}

type CommandClickTarget = EventTarget & {
  closest?: (selector: string) => { dataset?: { command?: string } } | null;
};

export async function handleCommandCenterClick(
  event: Event,
  options: DxBrowserCommandDispatchOptions
): Promise<void> {
  const target = event.target as CommandClickTarget | null;
  const commandElement = target?.closest?.("[data-command]");
  const commandId = commandElement?.dataset?.command;

  if (!commandId) {
    return;
  }

  const plan = resolveDxBrowserCommandPlan(commandId);
  const approved = await confirmIfNeeded(plan, options.confirmCommand);

  if (plan.requiresUserApproval && !approved) {
    options.reportStatus?.(createCancelledCommandStatus(plan));
    return;
  }

  options.reportStatus?.(createPendingCommandStatus(plan));

  try {
    const response = await options.runtime.sendMessage(
      createDxBrowserCommandMessage(plan, approved)
    );
    options.reportStatus?.(createRuntimeCommandStatus(plan, response));
  } catch (error) {
    options.reportStatus?.(createDispatchErrorCommandStatus(error));
    throw error;
  }
}

export function bindCommandCenterActions(
  root: HTMLElement,
  options: DxBrowserCommandDispatchOptions
): void {
  root.addEventListener("click", (event) => {
    void handleCommandCenterClick(event, options).catch((error) => {
      options.reportError?.(error);
    });
  });
}

async function confirmIfNeeded(
  plan: DxBrowserCommandPlan,
  confirmCommand: DxBrowserCommandDispatchOptions["confirmCommand"]
): Promise<boolean> {
  if (!plan.requiresUserApproval) {
    return false;
  }

  if (!confirmCommand) {
    return false;
  }

  return Boolean(await confirmCommand(plan));
}
