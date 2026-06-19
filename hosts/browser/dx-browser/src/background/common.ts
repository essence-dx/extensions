import { resolveDxBrowserCommandPlan } from "../runtime/commandPlans.ts";
import { sendNativeHostCommand } from "../runtime/nativeHostTransport.ts";
import { isTrustedBrowserMessageSender } from "./messageSender.ts";
import {
  isDxBrowserCommandMessage,
  parseDxBrowserCommandMessage
} from "../runtime/messages.ts";
import type { DxBrowserCommandPlan } from "../runtime/commandPlans.ts";
import type { DxNativeMessagingRuntime } from "../runtime/nativeHostTransport.ts";
import type { DxBrowserHostContext } from "../runtime/protocol.ts";
import type { DxBrowserCommandMessage } from "../runtime/messages.ts";

export interface DxBrowserHostUi {
  openReceipts(): Promise<void> | void;
}

export interface DxBrowserBackgroundDependencies {
  nativeRuntime: DxNativeMessagingRuntime;
  hostUi: DxBrowserHostUi;
  readActiveTabContext(): Promise<DxBrowserHostContext> | DxBrowserHostContext;
  createRequestId?: () => string;
  extensionOrigin?: string;
}

export interface DxBrowserCommandDispatchResult {
  commandId: string;
  handledBy: DxBrowserCommandPlan["transport"];
  receiptPath?: string;
}

export type DxBrowserRuntimeMessageResponse =
  | {
      ok: true;
      result: DxBrowserCommandDispatchResult;
    }
  | {
      ok: false;
      error: string;
    };

export type DxBrowserRuntimeSendResponse = (
  response: DxBrowserRuntimeMessageResponse
) => void;

export type DxBrowserRuntimeMessageListener = (
  message: unknown,
  sender?: unknown,
  sendResponse?: DxBrowserRuntimeSendResponse
) => Promise<DxBrowserCommandDispatchResult> | true | undefined;

export async function dispatchDxBrowserCommandMessage(
  value: unknown,
  dependencies: DxBrowserBackgroundDependencies
): Promise<DxBrowserCommandDispatchResult> {
  const message = parseDxBrowserCommandMessage(value);
  const plan = resolveDxBrowserCommandPlan(message.commandId);

  enforceApproval(plan, message);

  if (plan.transport === "host-ui") {
    await dispatchHostUiCommand(plan, dependencies.hostUi);
    return {
      commandId: plan.id,
      handledBy: plan.transport
    };
  }

  const context = await dependencies.readActiveTabContext();
  const nativeResponse = await sendNativeHostCommand({
    runtime: dependencies.nativeRuntime,
    plan,
    context,
    createRequestId: dependencies.createRequestId
  });

  return {
    commandId: plan.id,
    handledBy: plan.transport,
    receiptPath: nativeResponse.receiptPath
  };
}

export function createDxBrowserRuntimeMessageListener(
  dependencies: DxBrowserBackgroundDependencies
): DxBrowserRuntimeMessageListener {
  return (
    message: unknown,
    sender?: unknown,
    sendResponse?: DxBrowserRuntimeSendResponse
  ) => {
    if (!isDxBrowserCommandMessage(message)) {
      return undefined;
    }

    const dispatchResult = isTrustedBrowserMessageSender(sender, dependencies.extensionOrigin)
      ? dispatchDxBrowserCommandMessage(message, dependencies)
      : Promise.reject(new Error("DX browser command sender is not trusted."));

    if (!sendResponse) {
      return dispatchResult;
    }

    void dispatchResult.then(
      (result) => {
        sendResponse({
          ok: true,
          result
        });
      },
      (error) => {
        sendResponse({
          ok: false,
          error: formatRuntimeError(error)
        });
      }
    );

    return true;
  };
}

function enforceApproval(
  plan: DxBrowserCommandPlan,
  message: DxBrowserCommandMessage
): void {
  if (plan.requiresUserApproval && message.approved !== true) {
    throw new Error("DX browser command requires user approval.");
  }
}

function formatRuntimeError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "DX browser command dispatch failed.";
}

async function dispatchHostUiCommand(
  plan: DxBrowserCommandPlan,
  hostUi: DxBrowserHostUi
): Promise<void> {
  if (plan.id === "openReceipts") {
    await hostUi.openReceipts();
    return;
  }

  throw new Error(`Unsupported DX browser host UI command: ${plan.id}`);
}
