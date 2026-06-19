import type { DxBrowserCommandPlan } from "./commandPlans.ts";
import {
  DxBrowserHostContext,
  DxBrowserNativeHostResponse,
  createNativeHostRequest,
  parseNativeHostResponse
} from "./protocol.ts";

export const dxBrowserNativeHostName = "dev.dx.browser";

export interface DxNativeMessagingRuntime {
  sendNativeMessage(hostName: string, message: unknown): Promise<unknown> | unknown;
}

export interface SendNativeHostCommandInput {
  runtime: DxNativeMessagingRuntime;
  plan: DxBrowserCommandPlan;
  context: DxBrowserHostContext;
  createRequestId?: () => string;
}

export async function sendNativeHostCommand(
  input: SendNativeHostCommandInput
): Promise<DxBrowserNativeHostResponse> {
  const request = createNativeHostRequest({
    requestId: createRequestId(input.createRequestId),
    plan: input.plan,
    context: input.context
  });

  const response = await input.runtime.sendNativeMessage(
    dxBrowserNativeHostName,
    request
  );
  const parsedResponse = parseNativeHostResponse(response);

  if (parsedResponse.requestId !== request.requestId) {
    throw new Error("DX browser native-host response request id mismatch.");
  }

  return parsedResponse;
}

function createRequestId(createCustomRequestId?: () => string): string {
  if (createCustomRequestId) {
    return createCustomRequestId();
  }

  const randomId = globalThis.crypto?.randomUUID?.();
  if (randomId) {
    return randomId;
  }

  return `dx-${Date.now().toString(36)}`;
}
