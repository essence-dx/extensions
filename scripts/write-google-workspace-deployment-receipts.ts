import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyPackageOutputReceipt } from "./lib/package-output-proof.ts";

type DeploymentMode = "test-deployment" | "head";
type WorkspaceFileType = "docs" | "sheets" | "slides" | "forms";
type WorkspaceFileState = "test-file" | "empty" | "unavailable";
type ResponseStatus = "ok" | "proof-blocked";

export interface GoogleWorkspaceDeploymentProof {
  packageOutputReceiptPath: string;
  proofFilePath: string;
  appsScriptDeploymentVerified: boolean;
  deploymentMode: DeploymentMode;
  deploymentIdSha256: string;
  appsScriptProjectIdSha256: string;
  deploymentVersion: string;
  oauthScopes: string[];
  cloudServiceVerified: boolean;
  serviceEndpointHost: string;
  serviceTransport: "https";
  requests: GoogleWorkspaceCloudServiceRequest[];
  responses: GoogleWorkspaceCloudServiceResponse[];
  workspaceFileSmokeVerified: boolean;
  workspaceFileType: WorkspaceFileType;
  workspaceFileState: WorkspaceFileState;
  cardsRendered: boolean;
  commandIdsVisible: string[];
  mutatesWorkspaceFile: boolean;
  storesWorkspacePayloads: boolean;
}

export interface GoogleWorkspaceCloudServiceRequest {
  commandId: string;
  operation: string;
  metadataOnly: boolean;
  transport: "cloud-service";
}

export interface GoogleWorkspaceCloudServiceResponse {
  commandId: string;
  status: ResponseStatus;
  payloadKind: "metadata-only-card";
}

export interface GoogleWorkspaceDeploymentReceiptOptions {
  generatedAt?: Date | string;
  verificationCommand?: string;
  proof: GoogleWorkspaceDeploymentProof;
}

export interface GoogleWorkspaceDeploymentReceipts {
  deployment: Record<string, unknown>;
  cloudService: Record<string, unknown>;
  workspaceFileSmoke: Record<string, unknown>;
}

const adapterId = "dx.google-workspace.command-center";
const requiredCommandOperations = new Map([
  ["dx.google-workspace.show_status", "dx.status"],
  ["dx.google-workspace.search_assets", "dx.assets.search"],
  ["dx.google-workspace.show_receipts", "receipt.showPath"]
]);
const proofKeys = new Set([
  "packageOutputReceiptPath",
  "proofFilePath",
  "appsScriptDeploymentVerified",
  "deploymentMode",
  "deploymentIdSha256",
  "appsScriptProjectIdSha256",
  "deploymentVersion",
  "oauthScopes",
  "cloudServiceVerified",
  "serviceEndpointHost",
  "serviceTransport",
  "requests",
  "responses",
  "workspaceFileSmokeVerified",
  "workspaceFileType",
  "workspaceFileState",
  "cardsRendered",
  "commandIdsVisible",
  "mutatesWorkspaceFile",
  "storesWorkspacePayloads"
]);
const requestKeys = new Set(["commandId", "operation", "metadataOnly", "transport"]);
const responseKeys = new Set(["commandId", "status", "payloadKind"]);
const privateKeys = new Set([
  "account",
  "apiKey",
  "clipboard",
  "contents",
  "domain",
  "driveFileId",
  "email",
  "fileId",
  "fileName",
  "fileUrl",
  "oauthToken",
  "password",
  "rawResponse",
  "secret",
  "tenant",
  "token",
  "url",
  "userEmail",
  "userId",
  "workspaceFileId",
  "workspaceFileName",
  "workspaceFileUrl"
]);

export function writeGoogleWorkspaceDeploymentReceipts(
  root = process.cwd(),
  options: GoogleWorkspaceDeploymentReceiptOptions
): GoogleWorkspaceDeploymentReceipts {
  const workspaceRoot = resolve(root);
  const generatedAt = normalizeGeneratedAt(options.generatedAt);
  const verificationCommand = options.verificationCommand ?? "npm run smoke:google-workspace-deployment:j1";
  const proof = validateProof(options.proof);
  const packageOutputReceiptBytes = readFileSync(proof.packageOutputReceiptPath);
  const proofFileBytes = readFileSync(proof.proofFilePath);
  const packageOutputProof = verifyPackageOutputReceipt(
    adapterId,
    JSON.parse(packageOutputReceiptBytes.toString("utf8"))
  );

  if (packageOutputProof.host !== "google-workspace") {
    throw new Error("Google Workspace package output host mismatch.");
  }

  const packageOutput = {
    receiptPath: proof.packageOutputReceiptPath,
    receiptSha256: sha256(packageOutputReceiptBytes),
    packageSha256: packageOutputProof.sha256
  };
  const manualProof = {
    proofFilePath: proof.proofFilePath,
    proofFileSha256: sha256(proofFileBytes)
  };
  const receiptDir = join(workspaceRoot, ".dx", "receipts", "extensions", adapterId);
  const deploymentPath = join(receiptDir, "apps-script-deployment-latest.json");
  const deployment = {
    receipt: "dx.extension.google_workspace.apps_script_deployment",
    adapterId,
    host: "google-workspace",
    generatedAt,
    verificationCommand,
    receiptPath: deploymentPath,
    packageOutput,
    deployment: {
      deploymentMode: proof.deploymentMode,
      deploymentIdSha256: proof.deploymentIdSha256,
      appsScriptProjectIdSha256: proof.appsScriptProjectIdSha256,
      deploymentVersion: proof.deploymentVersion.trim(),
      oauthScopesEmpty: true
    },
    manualProof,
    releaseClaims: {
      appsScriptDeploymentVerified: true,
      oauthReviewVerified: false,
      cloudServiceVerified: false,
      workspaceFileSmokeVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      marketplaceApproved: false,
      distributionVerified: false
    }
  };

  writeReceipt(deploymentPath, deployment);

  const deploymentSha256 = sha256(readFileSync(deploymentPath));
  const cloudServicePath = join(receiptDir, "cloud-service-latest.json");
  const cloudService = {
    receipt: "dx.extension.google_workspace.cloud_service",
    adapterId,
    host: "google-workspace",
    generatedAt,
    verificationCommand,
    receiptPath: cloudServicePath,
    deploymentReceiptPath: deploymentPath,
    deploymentReceiptSha256: deploymentSha256,
    packageOutput,
    service: {
      endpointHost: proof.serviceEndpointHost.trim(),
      transport: "https",
      metadataOnly: true,
      storesWorkspacePayloads: false
    },
    requests: normalizeRequests(proof.requests),
    responses: normalizeResponses(proof.responses),
    manualProof,
    releaseClaims: {
      appsScriptDeploymentVerified: true,
      cloudServiceVerified: true,
      oauthReviewVerified: false,
      workspaceFileSmokeVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      marketplaceApproved: false,
      distributionVerified: false
    }
  };

  writeReceipt(cloudServicePath, cloudService);

  const workspaceFileSmokePath = join(receiptDir, "workspace-file-smoke-latest.json");
  const workspaceFileSmoke = {
    receipt: "dx.extension.google_workspace.workspace_file_smoke",
    adapterId,
    host: "google-workspace",
    generatedAt,
    verificationCommand,
    receiptPath: workspaceFileSmokePath,
    deploymentReceiptPath: deploymentPath,
    deploymentReceiptSha256: deploymentSha256,
    cloudServiceReceiptPath: cloudServicePath,
    cloudServiceReceiptSha256: sha256(readFileSync(cloudServicePath)),
    packageOutput,
    workspaceFile: {
      fileType: proof.workspaceFileType,
      fileState: proof.workspaceFileState,
      cardsRendered: true,
      commandIdsVisible: uniqueSorted(proof.commandIdsVisible),
      mutatesWorkspaceFile: false,
      storesWorkspacePayloads: false
    },
    manualProof,
    releaseClaims: {
      appsScriptDeploymentVerified: true,
      cloudServiceVerified: true,
      workspaceFileSmokeVerified: true,
      oauthReviewVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      marketplaceApproved: false,
      distributionVerified: false
    }
  };

  writeReceipt(workspaceFileSmokePath, workspaceFileSmoke);

  return {
    deployment,
    cloudService,
    workspaceFileSmoke
  };
}

if (isDirectRun()) {
  try {
    const proofPath = process.env.DX_GOOGLE_WORKSPACE_DEPLOYMENT_PROOF_JSON;

    if (!proofPath) {
      throw new Error("DX_GOOGLE_WORKSPACE_DEPLOYMENT_PROOF_JSON must point to a Google Workspace proof JSON file.");
    }

    assertExistingAbsoluteFile(proofPath, "proof JSON");
    const proof = JSON.parse(readFileSync(proofPath, "utf8")) as GoogleWorkspaceDeploymentProof;
    const receipts = writeGoogleWorkspaceDeploymentReceipts(process.cwd(), {
      proof,
      verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run smoke:google-workspace-deployment:j1"
    });

    console.log(`Google Workspace deployment receipt written: ${receipts.deployment.receiptPath}`);
    console.log(`Google Workspace cloud-service receipt written: ${receipts.cloudService.receiptPath}`);
    console.log(`Google Workspace file-smoke receipt written: ${receipts.workspaceFileSmoke.receiptPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function validateProof(proof: GoogleWorkspaceDeploymentProof): GoogleWorkspaceDeploymentProof {
  if (!isRecord(proof)) {
    throw new Error("Google Workspace deployment proof must be an object.");
  }

  rejectPrivateKeys(proof);
  rejectUnexpectedProofKeys(proof);
  assertExistingAbsoluteFile(proof.packageOutputReceiptPath, "package-output receipt");
  assertExistingAbsoluteFile(proof.proofFilePath, "proof file");

  if (proof.appsScriptDeploymentVerified !== true) {
    throw new Error("Google Workspace proof must verify an Apps Script test deployment.");
  }

  if (proof.deploymentMode !== "test-deployment") {
    throw new Error("Google Workspace proof must use a test deployment.");
  }

  assertSha256(proof.deploymentIdSha256, "deployment id hash");
  assertSha256(proof.appsScriptProjectIdSha256, "Apps Script project id hash");
  assertNonEmpty(proof.deploymentVersion, "deployment version");

  if (!Array.isArray(proof.oauthScopes) || proof.oauthScopes.length !== 0) {
    throw new Error("Google Workspace deployment proof must keep OAuth scopes empty until OAuth review proof exists.");
  }

  if (proof.cloudServiceVerified !== true) {
    throw new Error("Google Workspace proof must verify the cloud service.");
  }

  assertServiceEndpointHost(proof.serviceEndpointHost);

  if (proof.serviceTransport !== "https") {
    throw new Error("Google Workspace cloud-service proof transport must be https.");
  }

  if (proof.workspaceFileSmokeVerified !== true) {
    throw new Error("Google Workspace proof must verify a Workspace file smoke.");
  }

  if (!["docs", "sheets", "slides", "forms"].includes(proof.workspaceFileType)) {
    throw new Error("Google Workspace proof must use a supported Workspace file type.");
  }

  if (!["test-file", "empty", "unavailable"].includes(proof.workspaceFileState)) {
    throw new Error("Google Workspace proof must use a coarse Workspace file state.");
  }

  if (proof.cardsRendered !== true) {
    throw new Error("Google Workspace proof must verify metadata-only cards rendered.");
  }

  if (proof.mutatesWorkspaceFile !== false) {
    throw new Error("Google Workspace proof must not mutate the Workspace file.");
  }

  if (proof.storesWorkspacePayloads !== false) {
    throw new Error("Google Workspace proof must not store Workspace payloads.");
  }

  validateCommandIds(proof.commandIdsVisible);
  validateRequests(proof.requests);
  validateResponses(proof.responses);

  return proof;
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
      throw new Error(`Google Workspace proof contains privacy-sensitive Google Workspace proof field: ${key}`);
    }

    rejectPrivateKeys(child);
  }
}

function rejectUnexpectedProofKeys(proof: Record<string, unknown>): void {
  for (const key of Object.keys(proof)) {
    if (!proofKeys.has(key)) {
      throw new Error(`Unexpected Google Workspace proof field: ${key}`);
    }
  }
}

function validateCommandIds(commandIdsVisible: string[]): void {
  const visible = new Set(commandIdsVisible);

  for (const commandId of requiredCommandOperations.keys()) {
    if (!visible.has(commandId)) {
      throw new Error(`Google Workspace proof must include visible command metadata for ${commandId}.`);
    }
  }

  for (const commandId of commandIdsVisible) {
    if (!requiredCommandOperations.has(commandId)) {
      throw new Error(`Google Workspace proof includes unsupported command metadata: ${commandId}.`);
    }
  }
}

function validateRequests(requests: GoogleWorkspaceCloudServiceRequest[]): void {
  if (!Array.isArray(requests)) {
    throw new Error("Google Workspace cloud-service proof requests must be an array.");
  }

  const requestCommands = new Set<string>();

  for (const request of requests) {
    if (!isRecord(request)) {
      throw new Error("Google Workspace cloud-service request must be an object.");
    }

    for (const key of Object.keys(request)) {
      if (!requestKeys.has(key)) {
        throw new Error(`Google Workspace cloud-service request contains an unsupported field: ${key}`);
      }
    }

    const expectedOperation = requiredCommandOperations.get(request.commandId);

    if (!expectedOperation) {
      throw new Error(`Google Workspace cloud-service request uses unsupported command: ${request.commandId}`);
    }

    if (request.operation !== expectedOperation) {
      throw new Error(`Google Workspace cloud-service request operation must be ${expectedOperation}.`);
    }

    if (request.metadataOnly !== true) {
      throw new Error("Google Workspace cloud-service requests must be metadata-only.");
    }

    if (request.transport !== "cloud-service") {
      throw new Error("Google Workspace cloud-service request transport must be cloud-service.");
    }

    requestCommands.add(request.commandId);
  }

  for (const commandId of requiredCommandOperations.keys()) {
    if (!requestCommands.has(commandId)) {
      throw new Error(`Google Workspace proof must include cloud-service request metadata for ${commandId}.`);
    }
  }
}

function validateResponses(responses: GoogleWorkspaceCloudServiceResponse[]): void {
  if (!Array.isArray(responses)) {
    throw new Error("Google Workspace cloud-service proof responses must be an array.");
  }

  const responseCommands = new Set<string>();

  for (const response of responses) {
    if (!isRecord(response)) {
      throw new Error("Google Workspace cloud-service response must be an object.");
    }

    for (const key of Object.keys(response)) {
      if (!responseKeys.has(key)) {
        throw new Error(`Google Workspace cloud-service response contains an unsupported field: ${key}`);
      }
    }

    if (!requiredCommandOperations.has(response.commandId)) {
      throw new Error(`Google Workspace cloud-service response uses unsupported command: ${response.commandId}`);
    }

    if (response.status === "proof-blocked") {
      throw new Error("Google Workspace cloud-service responses must prove successful cloud-service execution.");
    }

    if (response.status !== "ok") {
      throw new Error(`Unsupported Google Workspace cloud-service response status: ${response.status}`);
    }

    if (response.payloadKind !== "metadata-only-card") {
      throw new Error("Google Workspace cloud-service responses must use metadata-only cards.");
    }

    responseCommands.add(response.commandId);
  }

  for (const commandId of requiredCommandOperations.keys()) {
    if (!responseCommands.has(commandId)) {
      throw new Error(`Google Workspace proof must include cloud-service response metadata for ${commandId}.`);
    }
  }
}

function normalizeRequests(requests: GoogleWorkspaceCloudServiceRequest[]): GoogleWorkspaceCloudServiceRequest[] {
  return [...requests]
    .map((request) => ({
      commandId: request.commandId,
      operation: request.operation,
      metadataOnly: true,
      transport: "cloud-service" as const
    }))
    .sort((left, right) => left.commandId.localeCompare(right.commandId));
}

function normalizeResponses(responses: GoogleWorkspaceCloudServiceResponse[]): GoogleWorkspaceCloudServiceResponse[] {
  return [...responses]
    .map((response) => ({
      commandId: response.commandId,
      status: response.status,
      payloadKind: "metadata-only-card" as const
    }))
    .sort((left, right) => left.commandId.localeCompare(right.commandId));
}

function assertServiceEndpointHost(value: string): void {
  assertNonEmpty(value, "service endpoint host");

  if (value.includes("/") || value.includes("\\") || value.includes("@") || value.includes("?")) {
    throw new Error("Google Workspace cloud-service proof endpoint must store only a host name.");
  }
}

function assertExistingAbsoluteFile(path: string, label: string): void {
  if (!isAbsolute(path)) {
    throw new Error(`Google Workspace proof ${label} must be an absolute path.`);
  }

  if (!existsSync(path)) {
    throw new Error(`Google Workspace proof ${label} does not exist: ${path}`);
  }
}

function assertNonEmpty(value: string, label: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Google Workspace proof ${label} is required.`);
  }
}

function assertSha256(value: string, label: string): void {
  assertNonEmpty(value, label);

  if (!/^[0-9a-f]{64}$/.test(value)) {
    throw new Error(`Google Workspace proof ${label} must be a SHA-256 hex digest.`);
  }
}

function writeReceipt(path: string, receipt: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`);
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
