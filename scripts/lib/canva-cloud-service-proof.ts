import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";

export type CanvaCloudServiceResponseStatus = "ok" | "proof-blocked";

export interface CanvaCloudServiceProof {
  loadedHostReceiptPath: string;
  proofFilePath: string;
  cloudServiceVerified: boolean;
  serviceEndpointHost: string;
  serviceTransport: "https";
  requests: CanvaCloudServiceRequest[];
  responses: CanvaCloudServiceResponse[];
  storesDesignPayloads: boolean;
}

export interface CanvaCloudServiceRequest {
  commandId: string;
  operation: string;
  metadataOnly: boolean;
  transport: "cloud-service";
}

export interface CanvaCloudServiceResponse {
  commandId: string;
  status: CanvaCloudServiceResponseStatus;
  payloadKind: "metadata-only-card";
}

const requiredCommandOperations = new Map([
  ["showStatus", "dx.status"],
  ["searchAssets", "dx.assets.search"],
  ["copyReceiptsPath", "receipt.showPath"]
]);
const proofKeys = new Set([
  "loadedHostReceiptPath",
  "proofFilePath",
  "cloudServiceVerified",
  "serviceEndpointHost",
  "serviceTransport",
  "requests",
  "responses",
  "storesDesignPayloads"
]);
const requestKeys = new Set(["commandId", "operation", "metadataOnly", "transport"]);
const responseKeys = new Set(["commandId", "status", "payloadKind"]);
const privateKeys = new Set([
  "account",
  "apiKey",
  "assetId",
  "assetName",
  "brandId",
  "clipboard",
  "contents",
  "designId",
  "designName",
  "designUrl",
  "email",
  "fileContents",
  "oauthToken",
  "password",
  "rawResponse",
  "secret",
  "teamId",
  "tenant",
  "token",
  "url",
  "userEmail",
  "userId"
]);

export function validateCanvaCloudServiceProof(
  proof: CanvaCloudServiceProof
): CanvaCloudServiceProof {
  if (!isRecord(proof)) {
    throw new Error("Canva cloud-service proof must be an object.");
  }

  rejectPrivateKeys(proof);
  rejectUnexpectedProofKeys(proof);
  assertExistingCanvaCloudServiceFile(proof.loadedHostReceiptPath, "loaded-host receipt");
  assertExistingCanvaCloudServiceFile(proof.proofFilePath, "proof file");

  if (proof.cloudServiceVerified !== true) {
    throw new Error("Canva proof must verify a metadata-only Canva cloud service.");
  }

  assertServiceEndpointHost(proof.serviceEndpointHost);

  if (proof.serviceTransport !== "https") {
    throw new Error("Canva cloud-service proof transport must be https.");
  }

  if (proof.storesDesignPayloads !== false) {
    throw new Error("Canva cloud-service proof must not store design payloads.");
  }

  validateRequests(proof.requests);
  validateResponses(proof.responses);

  return proof;
}

export function assertExistingCanvaCloudServiceFile(
  path: unknown,
  label: string
): asserts path is string {
  if (typeof path !== "string" || !isAbsolute(path)) {
    throw new Error(`Canva cloud-service proof ${label} must be an absolute path.`);
  }

  if (!existsSync(path)) {
    throw new Error(`Canva cloud-service proof ${label} does not exist: ${path}`);
  }
}

export function normalizeCanvaCloudServiceRequests(
  requests: CanvaCloudServiceRequest[]
): CanvaCloudServiceRequest[] {
  return [...requests]
    .map((request) => ({
      commandId: request.commandId,
      operation: request.operation,
      metadataOnly: true,
      transport: "cloud-service" as const
    }))
    .sort((left, right) => left.commandId.localeCompare(right.commandId));
}

export function normalizeCanvaCloudServiceResponses(
  responses: CanvaCloudServiceResponse[]
): CanvaCloudServiceResponse[] {
  return [...responses]
    .map((response) => ({
      commandId: response.commandId,
      status: response.status,
      payloadKind: "metadata-only-card" as const
    }))
    .sort((left, right) => left.commandId.localeCompare(right.commandId));
}

function rejectPrivateKeys(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      rejectPrivateKeys(item);
    }

    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (privateKeys.has(key)) {
      throw new Error(`Canva proof contains privacy-sensitive Canva cloud-service proof field: ${key}`);
    }

    rejectPrivateKeys(child);
  }
}

function rejectUnexpectedProofKeys(proof: Record<string, unknown>): void {
  for (const key of Object.keys(proof)) {
    if (!proofKeys.has(key)) {
      throw new Error(`Unexpected Canva cloud-service proof field: ${key}`);
    }
  }
}

function validateRequests(requests: CanvaCloudServiceRequest[]): void {
  if (!Array.isArray(requests)) {
    throw new Error("Canva cloud-service proof requests must be an array.");
  }

  const requestCommands = new Set<string>();

  for (const request of requests) {
    if (!isRecord(request)) {
      throw new Error("Canva cloud-service request must be an object.");
    }

    for (const key of Object.keys(request)) {
      if (!requestKeys.has(key)) {
        throw new Error(`Canva cloud-service request contains an unsupported field: ${key}`);
      }
    }

    const expectedOperation = requiredCommandOperations.get(String(request.commandId));

    if (!expectedOperation) {
      throw new Error(`Canva cloud-service request uses unsupported command: ${request.commandId}`);
    }

    if (request.operation !== expectedOperation) {
      throw new Error(`Canva cloud-service request operation must be ${expectedOperation}.`);
    }

    if (request.metadataOnly !== true) {
      throw new Error("Canva cloud-service requests must be metadata-only.");
    }

    if (request.transport !== "cloud-service") {
      throw new Error("Canva cloud-service request transport must be cloud-service.");
    }

    requestCommands.add(request.commandId);
  }

  for (const commandId of requiredCommandOperations.keys()) {
    if (!requestCommands.has(commandId)) {
      throw new Error(`Canva proof must include cloud-service request metadata for ${commandId}.`);
    }
  }
}

function validateResponses(responses: CanvaCloudServiceResponse[]): void {
  if (!Array.isArray(responses)) {
    throw new Error("Canva cloud-service proof responses must be an array.");
  }

  const responseCommands = new Set<string>();

  for (const response of responses) {
    if (!isRecord(response)) {
      throw new Error("Canva cloud-service response must be an object.");
    }

    for (const key of Object.keys(response)) {
      if (!responseKeys.has(key)) {
        throw new Error(`Canva cloud-service response contains an unsupported field: ${key}`);
      }
    }

    if (!requiredCommandOperations.has(String(response.commandId))) {
      throw new Error(`Canva cloud-service response uses unsupported command: ${response.commandId}`);
    }

    if (response.status === "proof-blocked") {
      throw new Error("Canva cloud-service responses must prove successful cloud-service execution.");
    }

    if (response.status !== "ok") {
      throw new Error(`Unsupported Canva cloud-service response status: ${response.status}`);
    }

    if (response.payloadKind !== "metadata-only-card") {
      throw new Error("Canva cloud-service responses must use metadata-only cards.");
    }

    responseCommands.add(response.commandId);
  }

  for (const commandId of requiredCommandOperations.keys()) {
    if (!responseCommands.has(commandId)) {
      throw new Error(`Canva proof must include cloud-service response metadata for ${commandId}.`);
    }
  }
}

function assertServiceEndpointHost(value: string): void {
  assertNonEmpty(value, "service endpoint host");

  if (value.includes("/") || value.includes("\\") || value.includes("@") || value.includes("?")) {
    throw new Error("Canva cloud-service proof endpoint must store only a host name.");
  }
}

function assertNonEmpty(value: unknown, label: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Canva cloud-service proof ${label} is required.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
