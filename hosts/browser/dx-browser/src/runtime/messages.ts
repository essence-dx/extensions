import type { DxBrowserCommandPlan } from "./commandPlans.ts";

export const dxBrowserCommandMessageType = "dx.browser.command.invoke";

const messageKeys = new Set(["type", "commandId", "approved"]);

export interface DxBrowserCommandMessage {
  type: typeof dxBrowserCommandMessageType;
  commandId: string;
  approved?: true;
}

export function createDxBrowserCommandMessage(
  plan: DxBrowserCommandPlan,
  approved = false
): DxBrowserCommandMessage {
  const message: DxBrowserCommandMessage = {
    type: dxBrowserCommandMessageType,
    commandId: plan.id
  };

  if (approved) {
    message.approved = true;
  }

  return message;
}

export function parseDxBrowserCommandMessage(
  value: unknown
): DxBrowserCommandMessage {
  const message = expectRecord(value);
  rejectUnexpectedKeys(message);

  if (message.type !== dxBrowserCommandMessageType) {
    throw new Error("Unsupported DX browser command message type.");
  }

  if (typeof message.commandId !== "string" || !message.commandId.trim()) {
    throw new Error("A DX browser command id is required.");
  }

  if (message.approved !== undefined && message.approved !== true) {
    throw new Error("DX browser command approval must be explicit.");
  }

  const parsed: DxBrowserCommandMessage = {
    type: dxBrowserCommandMessageType,
    commandId: message.commandId.trim()
  };

  if (message.approved === true) {
    parsed.approved = true;
  }

  return parsed;
}

export function isDxBrowserCommandMessage(
  value: unknown
): value is DxBrowserCommandMessage {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).type === dxBrowserCommandMessageType
  );
}

function expectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("A DX browser command message object is required.");
  }

  return value as Record<string, unknown>;
}

function rejectUnexpectedKeys(value: Record<string, unknown>): void {
  for (const key of Object.keys(value)) {
    if (!messageKeys.has(key)) {
      throw new Error(`Unexpected DX browser command message field: ${key}`);
    }
  }
}
