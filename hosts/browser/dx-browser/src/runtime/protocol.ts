import {
  DxBrowserCommandPlan,
  DxBrowserNativeCommand
} from "./commandPlans";

export const dxBrowserNativeHostProtocol = "dx.browser.native-host";
export const dxBrowserNativeHostProtocolVersion = 1;
export const dxBrowserNativeHostMaxMessageBytes = 1_048_576;

const activeTabTitleLimit = 200;
const activeTabUrlLimit = 2_048;
const responseKeys = new Set([
  "protocol",
  "version",
  "requestId",
  "ok",
  "error",
  "receiptPath"
]);
const receiptPathPrefix = ".dx/receipts/extensions/dx.browser.command-center/";

export interface DxBrowserHostContext {
  activeTabUrl?: string;
  activeTabTitle?: string;
}

export interface DxBrowserNativeHostRequest {
  protocol: typeof dxBrowserNativeHostProtocol;
  version: typeof dxBrowserNativeHostProtocolVersion;
  requestId: string;
  hostActionId: string;
  operation: string;
  command: DxBrowserNativeCommand;
  context: DxBrowserHostContext;
}

export interface DxBrowserNativeHostSuccessResponse {
  protocol: typeof dxBrowserNativeHostProtocol;
  version: typeof dxBrowserNativeHostProtocolVersion;
  requestId: string;
  ok: true;
  receiptPath?: string;
}

export interface DxBrowserNativeHostErrorResponse {
  protocol: typeof dxBrowserNativeHostProtocol;
  version: typeof dxBrowserNativeHostProtocolVersion;
  requestId: string;
  ok: false;
  error: string;
  receiptPath?: string;
}

export type DxBrowserNativeHostResponse =
  | DxBrowserNativeHostSuccessResponse
  | DxBrowserNativeHostErrorResponse;

export interface CreateNativeHostRequestInput {
  requestId: string;
  plan: DxBrowserCommandPlan;
  context: DxBrowserHostContext;
}

export function createNativeHostRequest(
  input: CreateNativeHostRequestInput
): DxBrowserNativeHostRequest {
  if (input.plan.transport !== "native-host") {
    throw new Error(`${input.plan.id} does not use the native host.`);
  }

  if (!input.requestId.trim()) {
    throw new Error("A non-empty native-host request id is required.");
  }

  const request: DxBrowserNativeHostRequest = {
    protocol: dxBrowserNativeHostProtocol,
    version: dxBrowserNativeHostProtocolVersion,
    requestId: input.requestId.trim(),
    hostActionId: input.plan.hostActionId,
    operation: input.plan.operation,
    command: copyNativeCommand(input.plan.nativeCommand),
    context: sanitizeContext(input.context)
  };

  assertMessageFits(request);
  return request;
}

export function parseNativeHostResponse(
  value: unknown
): DxBrowserNativeHostResponse {
  const response = expectRecord(value, "native-host response");
  rejectUnexpectedKeys(response, responseKeys);

  if (response.protocol !== dxBrowserNativeHostProtocol) {
    throw new Error("Unsupported DX browser native-host protocol.");
  }

  if (response.version !== dxBrowserNativeHostProtocolVersion) {
    throw new Error("Unsupported DX browser native-host protocol version.");
  }

  if (typeof response.requestId !== "string" || !response.requestId.trim()) {
    throw new Error("A native-host response request id is required.");
  }

  if (typeof response.ok !== "boolean") {
    throw new Error("A native-host response ok flag is required.");
  }

  const parsed: DxBrowserNativeHostResponse = response.ok
    ? {
        protocol: dxBrowserNativeHostProtocol,
        version: dxBrowserNativeHostProtocolVersion,
        requestId: response.requestId,
        ok: true
      }
    : {
        protocol: dxBrowserNativeHostProtocol,
        version: dxBrowserNativeHostProtocolVersion,
        requestId: response.requestId,
        ok: false,
        error: expectNonEmptyString(response.error, "error message")
      };

  if (response.receiptPath !== undefined) {
    parsed.receiptPath = expectReceiptPath(response.receiptPath);
  }

  return parsed;
}

function copyNativeCommand(command?: DxBrowserNativeCommand): DxBrowserNativeCommand {
  if (!command) {
    throw new Error("A native-host command plan is required.");
  }

  if (command.executable !== "dx") {
    throw new Error("Native-host command executable must be dx.");
  }

  if (!Array.isArray(command.args) || command.args.length === 0) {
    throw new Error("Native-host command args are required.");
  }

  return {
    executable: "dx",
    args: command.args.map(validateNativeCommandArg)
  };
}

function validateNativeCommandArg(value: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Native-host command args must be non-empty strings.");
  }

  if (/[;&|<>`$]/.test(value)) {
    throw new Error("Native-host command args must not contain shell control characters.");
  }

  return value.trim();
}

function sanitizeContext(context: DxBrowserHostContext): DxBrowserHostContext {
  const sanitized: DxBrowserHostContext = {};

  if (context.activeTabUrl !== undefined) {
    sanitized.activeTabUrl = sanitizeUrl(context.activeTabUrl);
  }

  if (context.activeTabTitle !== undefined) {
    sanitized.activeTabTitle = sanitizeText(
      context.activeTabTitle,
      "active tab title",
      activeTabTitleLimit
    );
  }

  return sanitized;
}

function sanitizeUrl(value: unknown): string {
  const text = sanitizeText(value, "active tab URL", activeTabUrlLimit);
  let url: URL;

  try {
    url = new URL(text);
  } catch {
    throw new Error("A valid active tab URL is required.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Unsupported active tab URL scheme.");
  }

  return url.toString();
}

function sanitizeText(value: unknown, label: string, limit: number): string {
  if (typeof value !== "string") {
    throw new Error(`A ${label} must be a string.`);
  }

  const text = value.trim();
  if (text.length > limit) {
    throw new Error(`A ${label} must be ${limit} characters or fewer.`);
  }

  return text;
}

function assertMessageFits(value: DxBrowserNativeHostRequest): void {
  const byteLength = new TextEncoder().encode(JSON.stringify(value)).byteLength;
  if (byteLength > dxBrowserNativeHostMaxMessageBytes) {
    throw new Error("Native-host request exceeds the maximum message size.");
  }
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`A ${label} object is required.`);
  }

  return value as Record<string, unknown>;
}

function rejectUnexpectedKeys(
  value: Record<string, unknown>,
  allowedKeys: Set<string>
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`Unexpected native-host response field: ${key}`);
    }
  }
}

function expectReceiptPath(value: unknown): string {
  const receiptPath = expectNonEmptyString(value, "receipt path");

  if (
    receiptPath.includes("://") ||
    receiptPath.includes("\\") ||
    receiptPath.startsWith("/") ||
    /^[A-Za-z]:\//.test(receiptPath) ||
    receiptPath.split("/").includes("..") ||
    !receiptPath.startsWith(receiptPathPrefix)
  ) {
    throw new Error("A safe metadata-only receipt path is required.");
  }

  return receiptPath;
}

function expectNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`A ${label} is required.`);
  }

  return value;
}
