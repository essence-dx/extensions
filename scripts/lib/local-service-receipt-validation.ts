import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";

import { parseTomlDocument } from "./toml-lite.ts";
import { classifyHostExecutionWeakness } from "./release-evidence-host-execution-classifier.ts";
import {
  type EvidenceReceiptRequirement,
  parseEvidenceReceiptRequirement
} from "../release-evidence-requirements.ts";
import type {
  LoadedHostReceipt,
  LocalServiceAction,
  LocalServiceProof,
  LocalServiceRequest,
  LocalServiceResponse,
  LocalServiceValidationResult,
  OfficialExtensionEntry,
  ReleaseGateEntry
} from "./local-service-receipt-types.ts";

const releaseGatesRelativePath = "registry/release-evidence-gates.toml";
const maxQueryLength = 240;
const proofKeys = new Set([
  "adapterId",
  "host",
  "receiptPath",
  "loadedHostReceiptPath",
  "proofFilePath",
  "protocol",
  "schemaVersion",
  "serviceEndpointHost",
  "serviceEndpointPort",
  "serviceTransport",
  "localServiceConnected",
  "requests",
  "responses",
  "hostState",
  "storesHostPayloads",
  "mutatesHostDocument"
]);
const requestKeys = new Set(["commandId", "operation", "metadataOnly", "transport", "query"]);
const responseKeys = new Set(["commandId", "status", "payloadKind"]);
const privacySensitiveProofKeys = new Set([
  "accessToken",
  "account",
  "apiKey",
  "clipboard",
  "clipboardContents",
  "documentName",
  "documentText",
  "email",
  "fileId",
  "fileName",
  "filePath",
  "fileUrl",
  "nodeId",
  "pageName",
  "password",
  "projectName",
  "rawHostResponse",
  "rawPayload",
  "secret",
  "selection",
  "selectionText",
  "tenant",
  "token",
  "url",
  "userId",
  "workspaceId",
  "workspaceName"
]);

export function validateLocalServiceReceiptInputs(
  workspaceRoot: string,
  proofInput: LocalServiceProof
): LocalServiceValidationResult {
  const proof = validateProof(proofInput);
  validateReleaseGateMappings(workspaceRoot, proof);

  const loadedHostReceiptBytes = readFileSync(proof.loadedHostReceiptPath);
  const loadedHostReceipt = JSON.parse(loadedHostReceiptBytes.toString("utf8")) as LoadedHostReceipt;
  const proofFileBytes = readFileSync(proof.proofFilePath);
  const localServiceActions = readLocalServiceActions(workspaceRoot, proof.adapterId);

  validateProofFileBytes(proofFileBytes);
  validateLoadedHostReceipt(loadedHostReceipt, proof);
  validateRequests(proof.requests, localServiceActions);
  validateResponses(proof.requests, proof.responses);

  return {
    proof,
    loadedHostReceiptBytes,
    proofFileBytes
  };
}

export function assertExistingAbsoluteFile(path: unknown, label: string): asserts path is string {
  if (typeof path !== "string" || !isAbsolute(path)) {
    throw new Error(`Local-service proof ${label} must be an absolute path.`);
  }

  if (!existsSync(path)) {
    throw new Error(`Local-service proof ${label} does not exist: ${path}`);
  }
}

function validateProof(proof: LocalServiceProof): LocalServiceProof {
  if (!isRecord(proof)) {
    throw new Error("Local-service proof must be an object.");
  }

  rejectPrivacySensitiveKeys(proof);
  rejectUnexpectedProofKeys(proof);
  assertSafeAdapterId(proof.adapterId);
  assertNonEmpty(proof.host, "host");
  assertSafeReceiptPath(proof.receiptPath);
  assertExistingAbsoluteFile(proof.loadedHostReceiptPath, "loaded-host receipt");
  assertExistingAbsoluteFile(proof.proofFilePath, "proof file");

  if (proof.protocol !== "dx.local-service") {
    throw new Error("Local-service proof protocol must be dx.local-service.");
  }

  if (proof.schemaVersion !== 1) {
    throw new Error("Local-service proof schema version must be 1.");
  }

  assertLoopbackHost(proof.serviceEndpointHost);
  assertServicePort(proof.serviceEndpointPort);

  if (proof.serviceTransport !== "loopback-http" && proof.serviceTransport !== "loopback-websocket") {
    throw new Error("Local-service proof transport must be loopback-http or loopback-websocket.");
  }

  if (proof.localServiceConnected !== true) {
    throw new Error("Local-service proof must verify a connected local service.");
  }

  if (!["loaded", "empty", "unavailable"].includes(proof.hostState)) {
    throw new Error("Local-service proof must use a coarse host state.");
  }

  if (proof.storesHostPayloads !== false) {
    throw new Error("Local-service proof must not store host payloads.");
  }

  if (proof.mutatesHostDocument !== false) {
    throw new Error("Local-service proof must not mutate the host document.");
  }

  if (!Array.isArray(proof.requests) || proof.requests.length === 0) {
    throw new Error("Local-service proof must include request metadata.");
  }

  if (!Array.isArray(proof.responses) || proof.responses.length === 0) {
    throw new Error("Local-service proof must include response metadata.");
  }

  return proof;
}

function validateReleaseGateMappings(workspaceRoot: string, proof: LocalServiceProof): void {
  const gate = readReleaseGateEntries(workspaceRoot).find((entry) => entry.id === proof.adapterId);

  if (!gate) {
    throw new Error(`Local-service proof has no release evidence gate for ${proof.adapterId}.`);
  }

  const requirements = gate.evidence_receipt_requirements
    .map((requirement) => parseEvidenceReceiptRequirement(requirement))
    .filter((requirement): requirement is EvidenceReceiptRequirement => Boolean(requirement));
  const localServiceRequirement = requirements.find(
    (requirement) => requirement.kind === "local_service" && requirement.receiptPath === proof.receiptPath
  );

  if (!localServiceRequirement) {
    throw new Error(`Local-service proof receipt path must match the release evidence local-service receipt for ${proof.adapterId}.`);
  }

  const hostReceiptPath = toWorkspaceRelativeReceiptPath(workspaceRoot, proof.loadedHostReceiptPath);
  const loadedHostRequirement = requirements.find(
    (requirement) => requirement.kind === "host_execution" && requirement.receiptPath === hostReceiptPath
  );

  if (!loadedHostRequirement) {
    throw new Error(`Local-service proof loaded-host receipt must match release evidence host execution for ${proof.adapterId}.`);
  }
}

function readReleaseGateEntries(workspaceRoot: string): ReleaseGateEntry[] {
  const releaseGatesPath = join(workspaceRoot, releaseGatesRelativePath);
  const releaseGates = parseTomlDocument(readFileSync(releaseGatesPath, "utf8"));

  return (releaseGates.arrays.extensions ?? []).map((entry) => ({
    id: entry.id,
    evidence_receipt_requirements: Array.isArray(entry.evidence_receipt_requirements)
      ? entry.evidence_receipt_requirements
      : []
  }));
}

function readLocalServiceActions(workspaceRoot: string, adapterId: string): LocalServiceAction[] {
  const officialRegistryPath = join(workspaceRoot, "registry", "official-extensions.toml");
  const registry = parseTomlDocument(readFileSync(officialRegistryPath, "utf8"));
  const extension = (registry.arrays.extensions ?? [])
    .map((entry): OfficialExtensionEntry => ({
      id: entry.id,
      manifest: entry.manifest
    }))
    .find((entry) => entry.id === adapterId);

  if (!extension) {
    throw new Error(`Local-service proof has no official extension manifest for ${adapterId}.`);
  }

  const manifest = parseTomlDocument(readFileSync(join(workspaceRoot, ...extension.manifest.split("/")), "utf8"));
  const actions = (manifest.arrays.host_actions ?? [])
    .filter((action) => action.transport === "local-service")
    .map((action): LocalServiceAction => ({
      id: action.id,
      operation: action.operation
    }));

  if (actions.length === 0) {
    throw new Error(`Local-service proof has no manifest local-service actions for ${adapterId}.`);
  }

  return actions;
}

function validateLoadedHostReceipt(receipt: LoadedHostReceipt, proof: LocalServiceProof): void {
  if (receipt.adapterId !== proof.adapterId || receipt.host !== proof.host) {
    throw new Error(`Local-service proof loaded-host receipt must match ${proof.adapterId}.`);
  }

  if (receipt.releaseClaims?.loadedHostVerified !== true) {
    throw new Error(`Local-service proof requires verified loaded-host evidence for ${proof.adapterId}.`);
  }

  const loadedHostWeakness = classifyHostExecutionWeakness(receipt as Record<string, unknown>);

  if (loadedHostWeakness) {
    throw new Error(
      `Local-service proof requires release-valid loaded-host evidence for ${proof.adapterId}: ${loadedHostWeakness}`
    );
  }
}

function validateProofFileBytes(bytes: Buffer): void {
  if (bytes.length === 0) {
    throw new Error("Local-service proof file must not be empty.");
  }
}

function validateRequests(requests: LocalServiceRequest[], actions: LocalServiceAction[]): void {
  const expectedOperations = new Map(actions.map((action) => [action.id, action.operation]));
  const seenCommands = new Set<string>();

  for (const request of requests) {
    if (!isRecord(request)) {
      throw new Error("Local-service request metadata must be an object.");
    }

    rejectUnexpectedKeys(request, requestKeys, "Local-service request");
    assertNonEmpty(request.commandId, "request command id");
    assertSafeOperation(request.operation);

    if (request.metadataOnly !== true) {
      throw new Error("Local-service proof requests must be metadata-only.");
    }

    if (request.transport !== "local-service") {
      throw new Error("Local-service proof request transport must be local-service.");
    }

    const expectedOperation = expectedOperations.get(request.commandId);

    if (!expectedOperation) {
      throw new Error(`Local-service proof includes unsupported local-service command: ${request.commandId}`);
    }

    if (request.operation !== expectedOperation) {
      throw new Error(`Local-service proof operation must match command ${request.commandId}.`);
    }

    validateOptionalQuery(request.query);

    if (seenCommands.has(request.commandId)) {
      throw new Error(`Local-service proof duplicates request metadata: ${request.commandId}`);
    }

    seenCommands.add(request.commandId);
  }

  for (const action of actions) {
    if (!seenCommands.has(action.id)) {
      throw new Error(`Local-service proof must include request metadata for ${action.id}.`);
    }
  }
}

function validateResponses(requests: LocalServiceRequest[], responses: LocalServiceResponse[]): void {
  const requestCommands = new Set(requests.map((request) => request.commandId));
  const seenResponses = new Set<string>();

  for (const response of responses) {
    if (!isRecord(response)) {
      throw new Error("Local-service response metadata must be an object.");
    }

    rejectUnexpectedKeys(response, responseKeys, "Local-service response");

    if (typeof response.commandId !== "string" || !requestCommands.has(response.commandId)) {
      throw new Error("Local-service response command must match a request command.");
    }

    if (response.status !== "ok") {
      throw new Error("Local-service proof responses must prove successful local-service execution.");
    }

    if (response.payloadKind !== "metadata-only") {
      throw new Error("Local-service proof responses must use metadata-only payloads.");
    }

    if (seenResponses.has(response.commandId)) {
      throw new Error(`Local-service proof duplicates response metadata: ${response.commandId}`);
    }

    seenResponses.add(response.commandId);
  }

  for (const commandId of requestCommands) {
    if (!seenResponses.has(commandId)) {
      throw new Error(`Local-service proof must include response metadata for ${commandId}.`);
    }
  }
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
      throw new Error(`Local-service proof contains a privacy-sensitive local-service proof field: ${key}`);
    }

    rejectPrivacySensitiveKeys(child);
  }
}

function rejectUnexpectedProofKeys(proof: Record<string, unknown>): void {
  for (const key of Object.keys(proof)) {
    if (!proofKeys.has(key)) {
      throw new Error(`Local-service proof contains an unsupported field: ${key}`);
    }
  }
}

function rejectUnexpectedKeys(value: Record<string, unknown>, allowedKeys: Set<string>, label: string): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`${label} contains an unsupported field: ${key}`);
    }
  }
}

function toWorkspaceRelativeReceiptPath(workspaceRoot: string, absolutePath: string): string {
  const relativePath = relative(workspaceRoot, absolutePath).replace(/\\/g, "/");

  if (
    relativePath === ".." ||
    relativePath.startsWith("../") ||
    isAbsolute(relativePath) ||
    !relativePath.startsWith(".dx/receipts/extensions/")
  ) {
    throw new Error("Local-service proof loaded-host receipt must be under .dx/receipts/extensions.");
  }

  return relativePath;
}

function assertSafeAdapterId(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^dx\.[a-z0-9][a-z0-9.-]*$/.test(value) || value.includes("..")) {
    throw new Error(`Local-service proof adapter id is unsafe: ${String(value)}`);
  }
}

function assertSafeReceiptPath(path: unknown): asserts path is string {
  if (
    typeof path !== "string" ||
    isAbsolute(path) ||
    path.includes("\\") ||
    path.includes("..") ||
    !path.startsWith(".dx/receipts/extensions/") ||
    !path.endsWith(".json")
  ) {
    throw new Error(`Local-service proof receipt path is unsafe: ${String(path)}`);
  }
}

function assertLoopbackHost(host: unknown): asserts host is string {
  const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1"]);

  if (typeof host !== "string" || !loopbackHosts.has(host)) {
    throw new Error("Local-service proof endpoint host must be loopback.");
  }
}

function assertServicePort(port: unknown): asserts port is number {
  if (!Number.isInteger(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error("Local-service proof endpoint port must be between 1 and 65535.");
  }
}

function assertSafeOperation(operation: unknown): asserts operation is string {
  assertNonEmpty(operation, "request operation");

  if (!/^[a-z][a-z0-9.-]*(?:\.[a-z][a-z0-9.-]*)*$/.test(operation)) {
    throw new Error(`Local-service proof operation is unsafe: ${operation}`);
  }
}

function validateOptionalQuery(query: unknown): void {
  if (query === undefined) {
    return;
  }

  if (typeof query !== "string") {
    throw new Error("Local-service proof request query must be text.");
  }

  const normalized = query.trim();

  if (normalized.length === 0) {
    throw new Error("Local-service proof request query must not be blank.");
  }

  if (normalized.length > maxQueryLength) {
    throw new Error("Local-service proof request query must stay within the metadata limit.");
  }
}

function assertNonEmpty(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Local-service proof ${label} is required.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
