import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  DxOfficeHost,
  DxOfficeHostDocumentState,
  DxOfficeLocalServiceOperation,
  DxOfficeLocalServiceRequest
} from "../hosts/office/shared/localServiceBoundary.ts";

export type OfficeLocalServiceTransport = "loopback";
export type OfficeLocalServiceResponseStatus = "ok";

export interface OfficeLocalServiceReceiptOptions {
  generatedAt?: Date | string;
  verificationCommand?: string;
  proof: OfficeLocalServiceProof;
}

export interface OfficeLocalServiceProof {
  host: DxOfficeHost;
  officeApplication: "Excel" | "PowerPoint" | "Word";
  officeVersion: string;
  sideloadedHostReceiptPath: string;
  proofFilePath: string;
  localServiceTransport: OfficeLocalServiceTransport;
  localServiceConnected: boolean;
  requests: DxOfficeLocalServiceRequest[];
  responses: OfficeLocalServiceResponse[];
  documentState: DxOfficeHostDocumentState;
}

export interface OfficeLocalServiceResponse {
  command: string;
  status: OfficeLocalServiceResponseStatus;
  payloadKind: "metadata-only";
}

export interface OfficeLocalServiceReceipt {
  receipt: "dx.extension.office_taskpane.local_service";
  adapterId: OfficeAdapterId;
  host: DxOfficeHost;
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  office: {
    application: OfficeLocalServiceProof["officeApplication"];
    version: string;
  };
  sideloadedHost: {
    receiptPath: string;
    receiptSha256: string;
  };
  localService: {
    transport: OfficeLocalServiceTransport;
    connected: true;
    documentState: DxOfficeHostDocumentState;
    requests: DxOfficeLocalServiceRequest[];
    responses: OfficeLocalServiceResponse[];
  };
  manualProof: {
    proofFilePath: string;
    proofFileSha256: string;
  };
  releaseClaims: {
    sideloadedHostVerified: true;
    localServiceVerified: true;
    signingVerified: false;
    releaseChecksumVerified: false;
    appSourceApproved: false;
    distributionVerified: false;
  };
}

type OfficeAdapterId =
  | "dx.excel.command-center"
  | "dx.powerpoint.command-center"
  | "dx.word.command-center";

interface OfficeAdapter {
  adapterId: OfficeAdapterId;
  application: OfficeLocalServiceProof["officeApplication"];
  host: DxOfficeHost;
  localServiceCommands: Record<string, DxOfficeLocalServiceOperation>;
}

interface OfficeSideloadedHostReceipt {
  receipt?: unknown;
  adapterId?: unknown;
  host?: unknown;
  office?: {
    application?: unknown;
    version?: unknown;
  };
  releaseClaims?: {
    sideloadedHostVerified?: unknown;
  };
}

const protocol = "dx.office.local-service";
const schemaVersion = 1;
const maxQueryLength = 240;

const adapters: Record<DxOfficeHost, OfficeAdapter> = {
  excel: {
    adapterId: "dx.excel.command-center",
    application: "Excel",
    host: "excel",
    localServiceCommands: {
      "dx.excel.show_status": "dx.status",
      "dx.excel.search_assets": "dx.assets.search"
    }
  },
  powerpoint: {
    adapterId: "dx.powerpoint.command-center",
    application: "PowerPoint",
    host: "powerpoint",
    localServiceCommands: {
      "dx.powerpoint.show_status": "dx.status",
      "dx.powerpoint.search_media": "dx.media.search"
    }
  },
  word: {
    adapterId: "dx.word.command-center",
    application: "Word",
    host: "word",
    localServiceCommands: {
      "dx.word.show_status": "dx.status",
      "dx.word.search_assets": "dx.assets.search"
    }
  }
};

const proofKeys = new Set([
  "host",
  "officeApplication",
  "officeVersion",
  "sideloadedHostReceiptPath",
  "proofFilePath",
  "localServiceTransport",
  "localServiceConnected",
  "requests",
  "responses",
  "documentState"
]);
const requestKeys = new Set([
  "protocol",
  "schemaVersion",
  "host",
  "command",
  "operation",
  "query",
  "context"
]);
const responseKeys = new Set(["command", "status", "payloadKind"]);
const contextKeys = new Set(["hostDocumentState"]);
const privacySensitiveProofKeys = new Set([
  "accessToken",
  "account",
  "clipboardContents",
  "documentName",
  "documentText",
  "documentUrl",
  "filePath",
  "presentationName",
  "presentationUrl",
  "selectionText",
  "tenant",
  "token",
  "url",
  "workbookName",
  "workbookUrl"
]);

export function writeOfficeLocalServiceReceipt(
  root = process.cwd(),
  options: OfficeLocalServiceReceiptOptions
): OfficeLocalServiceReceipt {
  const workspaceRoot = resolve(root);
  const proof = validateProof(options.proof);
  const adapter = adapters[proof.host];
  const sideloadedHostReceiptBytes = readFileSync(proof.sideloadedHostReceiptPath);
  const sideloadedHostReceipt = JSON.parse(
    sideloadedHostReceiptBytes.toString("utf8")
  ) as OfficeSideloadedHostReceipt;
  const proofFileBytes = readFileSync(proof.proofFilePath);

  validateSideloadedHostReceipt(sideloadedHostReceipt, adapter, proof);
  validateRequests(proof, adapter);
  validateResponses(proof);

  const receiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    adapter.adapterId,
    "local-service-latest.json"
  );
  const receipt: OfficeLocalServiceReceipt = {
    receipt: "dx.extension.office_taskpane.local_service",
    adapterId: adapter.adapterId,
    host: adapter.host,
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand: options.verificationCommand ?? "npm run smoke:office-local-service:j1",
    receiptPath,
    office: {
      application: proof.officeApplication,
      version: proof.officeVersion.trim()
    },
    sideloadedHost: {
      receiptPath: proof.sideloadedHostReceiptPath,
      receiptSha256: sha256(sideloadedHostReceiptBytes)
    },
    localService: {
      transport: proof.localServiceTransport,
      connected: true,
      documentState: proof.documentState,
      requests: normalizeRequests(proof.requests),
      responses: normalizeResponses(proof.requests, proof.responses)
    },
    manualProof: {
      proofFilePath: proof.proofFilePath,
      proofFileSha256: sha256(proofFileBytes)
    },
    releaseClaims: {
      sideloadedHostVerified: true,
      localServiceVerified: true,
      signingVerified: false,
      releaseChecksumVerified: false,
      appSourceApproved: false,
      distributionVerified: false
    }
  };

  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

  return receipt;
}

if (isDirectRun()) {
  try {
    const proofPath = process.env.DX_OFFICE_LOCAL_SERVICE_PROOF_JSON;

    if (!proofPath) {
      throw new Error("DX_OFFICE_LOCAL_SERVICE_PROOF_JSON must point to an Office local-service proof JSON file.");
    }

    assertExistingProofJsonFile(proofPath);
    const proofSource = JSON.parse(readFileSync(proofPath, "utf8")) as
      | OfficeLocalServiceProof
      | OfficeLocalServiceProof[];
    const proofs = Array.isArray(proofSource) ? proofSource : [proofSource];

    for (const proof of proofs) {
      const receipt = writeOfficeLocalServiceReceipt(process.cwd(), {
        proof,
        verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run smoke:office-local-service:j1"
      });

      console.log(`${receipt.office.application} local-service receipt written: ${receipt.receiptPath}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function validateProof(proof: OfficeLocalServiceProof): OfficeLocalServiceProof {
  if (!isRecord(proof)) {
    throw new Error("Office local-service proof must be an object.");
  }

  rejectPrivacySensitiveKeys(proof);
  rejectUnexpectedProofKeys(proof);

  if (!Object.hasOwn(adapters, proof.host)) {
    throw new Error(`Unsupported Office local-service host: ${proof.host}`);
  }

  const adapter = adapters[proof.host];

  if (proof.officeApplication !== adapter.application) {
    throw new Error(`Office local-service proof application must be ${adapter.application}.`);
  }

  assertNonEmpty(proof.officeVersion, "Office version");
  assertExistingAbsoluteFile(proof.sideloadedHostReceiptPath, "sideloaded-host receipt");
  assertExistingAbsoluteFile(proof.proofFilePath, "proof file");

  if (proof.localServiceTransport !== "loopback") {
    throw new Error("Office local-service proof transport must be loopback.");
  }

  if (proof.localServiceConnected !== true) {
    throw new Error("Office local-service proof must verify a connected local service.");
  }

  if (proof.documentState !== "loaded" && proof.documentState !== "unavailable") {
    throw new Error("Office local-service proof must use a coarse document state.");
  }

  if (!Array.isArray(proof.requests) || proof.requests.length === 0) {
    throw new Error("Office local-service proof must include request metadata.");
  }

  if (!Array.isArray(proof.responses) || proof.responses.length === 0) {
    throw new Error("Office local-service proof must include response metadata.");
  }

  return proof;
}

function rejectPrivacySensitiveKeys(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      rejectPrivacySensitiveKeys(item);
    }

    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (privacySensitiveProofKeys.has(key)) {
      throw new Error(`Office local-service proof contains privacy-sensitive Office local-service proof field: ${key}`);
    }

    rejectPrivacySensitiveKeys(child);
  }
}

function rejectUnexpectedProofKeys(proof: Record<string, unknown>): void {
  for (const key of Object.keys(proof)) {
    if (!proofKeys.has(key)) {
      throw new Error(`Unexpected Office local-service proof field: ${key}`);
    }
  }
}

function validateSideloadedHostReceipt(
  receipt: OfficeSideloadedHostReceipt,
  adapter: OfficeAdapter,
  proof: OfficeLocalServiceProof
): void {
  if (receipt.receipt !== "dx.extension.office_taskpane.sideloaded_host") {
    throw new Error("Office local-service proof requires an Office sideloaded-host receipt.");
  }

  if (receipt.adapterId !== adapter.adapterId || receipt.host !== adapter.host) {
    throw new Error("Office local-service proof sideloaded-host receipt must match the Office adapter.");
  }

  if (receipt.office?.application !== adapter.application) {
    throw new Error(`Office local-service sideloaded-host receipt must target ${adapter.application}.`);
  }

  if (receipt.office?.version !== proof.officeVersion.trim()) {
    throw new Error("Office local-service proof Office version must match the sideloaded-host receipt.");
  }

  if (receipt.releaseClaims?.sideloadedHostVerified !== true) {
    throw new Error("Office local-service proof requires a verified sideloaded-host receipt.");
  }
}

function validateRequests(proof: OfficeLocalServiceProof, adapter: OfficeAdapter): void {
  const requiredCommands = new Set(Object.keys(adapter.localServiceCommands));
  const seenCommands = new Set<string>();

  for (const request of proof.requests) {
    if (!isRecord(request)) {
      throw new Error("Office local-service request metadata must be an object.");
    }

    rejectUnexpectedKeys(request, requestKeys, "Office local-service request");

    if (request.protocol !== protocol) {
      throw new Error("Office local-service request must use the Office local-service protocol.");
    }

    if (request.schemaVersion !== schemaVersion) {
      throw new Error("Office local-service request must use schema version 1.");
    }

    if (request.host !== adapter.host) {
      throw new Error("Office local-service request host must match the Office adapter.");
    }

    if (typeof request.command !== "string" || request.command.trim() === "") {
      throw new Error("Office local-service request command is required.");
    }

    const expectedOperation = adapter.localServiceCommands[request.command];

    if (!expectedOperation) {
      throw new Error(`Office local-service proof includes unsupported ${adapter.application} command: ${request.command}`);
    }

    if (request.operation !== expectedOperation) {
      throw new Error(`Office local-service request operation must match command ${request.command}.`);
    }

    validateRequestContext(request.context, proof.documentState);
    validateOptionalQuery(request.query);

    if (seenCommands.has(request.command)) {
      throw new Error(`Office local-service proof duplicates command metadata: ${request.command}`);
    }

    seenCommands.add(request.command);
  }

  for (const command of requiredCommands) {
    if (!seenCommands.has(command)) {
      throw new Error(`Office local-service proof must include request metadata for ${command}.`);
    }
  }
}

function validateRequestContext(context: unknown, documentState: DxOfficeHostDocumentState): void {
  if (!isRecord(context)) {
    throw new Error("Office local-service request context must be an object.");
  }

  rejectUnexpectedKeys(context, contextKeys, "Office local-service request context");

  if (context.hostDocumentState !== documentState) {
    throw new Error("Office local-service request context must match the proof document state.");
  }
}

function validateOptionalQuery(query: unknown): void {
  if (query === undefined) {
    return;
  }

  if (typeof query !== "string") {
    throw new Error("Office local-service request query must be text.");
  }

  const normalized = query.trim();

  if (normalized.length === 0) {
    throw new Error("Office local-service request query must not be blank.");
  }

  if (normalized.length > maxQueryLength) {
    throw new Error("Office local-service request query must stay within the metadata limit.");
  }
}

function validateResponses(proof: OfficeLocalServiceProof): void {
  const requestCommands = new Set(proof.requests.map((request) => request.command));
  const seenResponses = new Set<string>();

  for (const response of proof.responses) {
    if (!isRecord(response)) {
      throw new Error("Office local-service response metadata must be an object.");
    }

    rejectUnexpectedKeys(response, responseKeys, "Office local-service response");

    if (typeof response.command !== "string" || !requestCommands.has(response.command)) {
      throw new Error("Office local-service response command must match a request command.");
    }

    if (response.status !== "ok") {
      throw new Error("Office local-service proof response must be ok.");
    }

    if (response.payloadKind !== "metadata-only") {
      throw new Error("Office local-service proof response payload must be metadata-only.");
    }

    if (seenResponses.has(response.command)) {
      throw new Error(`Office local-service proof duplicates response metadata: ${response.command}`);
    }

    seenResponses.add(response.command);
  }

  for (const command of requestCommands) {
    if (!seenResponses.has(command)) {
      throw new Error(`Office local-service proof must include response metadata for ${command}.`);
    }
  }
}

function normalizeRequests(requests: DxOfficeLocalServiceRequest[]): DxOfficeLocalServiceRequest[] {
  return requests.map((request) => {
    const normalized: DxOfficeLocalServiceRequest = {
      protocol: "dx.office.local-service",
      schemaVersion: 1,
      host: request.host,
      command: request.command.trim(),
      operation: request.operation,
      context: {
        hostDocumentState: request.context.hostDocumentState
      }
    };
    const query = request.query?.trim();

    if (query) {
      normalized.query = query;
    }

    return normalized;
  });
}

function normalizeResponses(
  requests: DxOfficeLocalServiceRequest[],
  responses: OfficeLocalServiceResponse[]
): OfficeLocalServiceResponse[] {
  const responsesByCommand = new Map(responses.map((response) => [response.command, response]));

  return requests.map((request) => {
    const response = responsesByCommand.get(request.command);

    if (!response) {
      throw new Error(`Office local-service proof must include response metadata for ${request.command}.`);
    }

    return {
      command: response.command.trim(),
      status: "ok",
      payloadKind: "metadata-only"
    };
  });
}

function rejectUnexpectedKeys(value: Record<string, unknown>, allowedKeys: Set<string>, label: string): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`${label} contains an unsupported field: ${key}`);
    }
  }
}

function assertExistingAbsoluteFile(path: string, label: string): void {
  if (!isAbsolute(path)) {
    throw new Error(`Office local-service proof ${label} must be an absolute path.`);
  }

  if (!existsSync(path)) {
    throw new Error(`Office local-service proof ${label} does not exist: ${path}`);
  }
}

function assertExistingProofJsonFile(path: string): void {
  if (!isAbsolute(path)) {
    throw new Error("Office local-service proof JSON file must be an absolute path.");
  }

  if (!existsSync(path)) {
    throw new Error(`Office local-service proof JSON file does not exist: ${path}`);
  }
}

function assertNonEmpty(value: string, label: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Office local-service proof ${label} is required.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizeGeneratedAt(value: Date | string | undefined): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value ?? new Date().toISOString();
}

function isDirectRun(): boolean {
  if (!process.argv[1]) {
    return false;
  }

  return (
    normalize(resolve(process.argv[1])).toLowerCase() ===
    normalize(fileURLToPath(import.meta.url)).toLowerCase()
  );
}
