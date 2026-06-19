export type DxOfficeHost = "excel" | "powerpoint" | "word";
export type DxOfficeHostDocumentState = "loaded" | "unavailable";
export type DxOfficeLocalServiceOperation = "dx.status" | "dx.assets.search" | "dx.media.search";
export type DxOfficeCommandOperation = DxOfficeLocalServiceOperation | "receipt.copyPath";
export type DxOfficeCommandTransport = "local-service" | "host-ui";

export interface DxOfficeCommandPlan {
  messageType: string;
  operation: DxOfficeCommandOperation;
  transport: DxOfficeCommandTransport;
  requiresRuntimeProof: boolean;
}

export interface DxOfficeLocalServiceContext {
  hostDocumentState: DxOfficeHostDocumentState;
}

export interface DxOfficeLocalServiceRequest {
  protocol: "dx.office.local-service";
  schemaVersion: 1;
  host: DxOfficeHost;
  command: string;
  operation: DxOfficeLocalServiceOperation;
  query?: string;
  context: DxOfficeLocalServiceContext;
}

export interface CreateDxOfficeLocalServiceRequestInput {
  host: DxOfficeHost;
  command: string;
  plan: DxOfficeCommandPlan;
  query?: string;
  context?: DxOfficeLocalServiceContext;
}

type DxOfficeRuntimeProofPlan = DxOfficeCommandPlan & {
  operation: DxOfficeLocalServiceOperation;
  transport: "local-service";
  requiresRuntimeProof: true;
};

const PROTOCOL = "dx.office.local-service";
const SCHEMA_VERSION = 1;
const MAX_OPTIONAL_TEXT_LENGTH = 240;

const hostLabels: Record<DxOfficeHost, string> = {
  excel: "Excel",
  powerpoint: "PowerPoint",
  word: "Word"
};

export function isDxOfficeLocalServicePlan(
  plan: DxOfficeCommandPlan
): plan is DxOfficeRuntimeProofPlan {
  return (
    plan.transport === "local-service" &&
    plan.requiresRuntimeProof === true &&
    isDxOfficeLocalServiceOperation(plan.operation)
  );
}

export function createDxOfficeLocalServiceRequest(
  input: CreateDxOfficeLocalServiceRequestInput
): DxOfficeLocalServiceRequest {
  if (!isDxOfficeLocalServicePlan(input.plan)) {
    throw new Error("DX Office command requires a local-service command plan.");
  }

  const request: DxOfficeLocalServiceRequest = {
    protocol: PROTOCOL,
    schemaVersion: SCHEMA_VERSION,
    host: input.host,
    command: input.command,
    operation: input.plan.operation,
    context: compactContext(input.context)
  };

  const query = normalizeOptionalText(input.query);
  if (query) {
    request.query = query;
  }

  return request;
}

export function describeDxOfficeServiceConnectionNotice(
  request: DxOfficeLocalServiceRequest
) {
  return `DX service connection is not configured for ${hostLabels[request.host]}. Operation: ${request.operation}.`;
}

function isDxOfficeLocalServiceOperation(
  operation: DxOfficeCommandOperation
): operation is DxOfficeLocalServiceOperation {
  return operation === "dx.status" || operation === "dx.assets.search" || operation === "dx.media.search";
}

function compactContext(context?: Partial<DxOfficeLocalServiceContext>): DxOfficeLocalServiceContext {
  return {
    hostDocumentState: context?.hostDocumentState === "loaded" ? "loaded" : "unavailable"
  };
}

function normalizeOptionalText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, MAX_OPTIONAL_TEXT_LENGTH) : undefined;
}
