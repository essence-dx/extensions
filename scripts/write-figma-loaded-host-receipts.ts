import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyPackageOutputReceipt } from "./lib/package-output-proof.ts";

export type FigmaVerificationMode = "figma-desktop-plugin";
export type FigmaFileState = "test-file" | "empty" | "unavailable";
export type FigmaCommandStatus = "proof-blocked" | "visible";

export interface FigmaLoadedHostProof {
  hostApplication: "Figma";
  hostVersion: string;
  hostExecutablePath: string;
  packageOutputReceiptPath: string;
  proofFilePath: string;
  verificationMode: FigmaVerificationMode;
  loadedHostVerified: boolean;
  pluginIdVerified: boolean;
  manifestPluginId: string;
  pluginUiRendered: boolean;
  menuCommandsVisible: string[];
  commandIdsVisible: string[];
  commandResults: FigmaCommandResult[];
  localServiceRequestsBlocked: boolean;
  fileState: FigmaFileState;
  networkAccessRestricted: boolean;
  mutatesFigmaFile: boolean;
  storesFigmaPayloads: boolean;
}

export interface FigmaCommandResult {
  commandId: string;
  status: FigmaCommandStatus;
}

export interface FigmaLoadedHostReceiptOptions {
  generatedAt?: Date | string;
  verificationCommand?: string;
  proof: FigmaLoadedHostProof;
}

export interface FigmaLoadedHostReceipts {
  loadedHost: Record<string, unknown>;
  pluginId: Record<string, unknown>;
}

const adapterId = "dx.figma.command-center";
const requiredCommandIds = [
  "dx.figma.show_status",
  "dx.figma.search_assets",
  "dx.figma.copy_receipts_path"
];
const requiredMenuCommands = ["show-status", "search-assets", "copy-receipts-path"];
const proofKeys = new Set([
  "hostApplication",
  "hostVersion",
  "hostExecutablePath",
  "packageOutputReceiptPath",
  "proofFilePath",
  "verificationMode",
  "loadedHostVerified",
  "pluginIdVerified",
  "manifestPluginId",
  "pluginUiRendered",
  "menuCommandsVisible",
  "commandIdsVisible",
  "commandResults",
  "localServiceRequestsBlocked",
  "fileState",
  "networkAccessRestricted",
  "mutatesFigmaFile",
  "storesFigmaPayloads"
]);
const commandResultKeys = new Set(["commandId", "status"]);
const privateKeys = new Set([
  "account",
  "apiKey",
  "clipboard",
  "documentName",
  "fileId",
  "fileKey",
  "fileName",
  "nodeId",
  "pageName",
  "password",
  "rawHostResponse",
  "secret",
  "selection",
  "selectionText",
  "teamId",
  "token",
  "url",
  "userId",
  "workspaceId",
  "workspaceName"
]);

export function writeFigmaLoadedHostReceipts(
  root = process.cwd(),
  options: FigmaLoadedHostReceiptOptions
): FigmaLoadedHostReceipts {
  const workspaceRoot = resolve(root);
  const generatedAt = normalizeGeneratedAt(options.generatedAt);
  const verificationCommand = options.verificationCommand ?? "npm run smoke:figma-loaded-host:j1";
  const proof = validateProof(options.proof);
  const packageOutputReceiptBytes = readFileSync(proof.packageOutputReceiptPath);
  const proofFileBytes = readFileSync(proof.proofFilePath);
  const hostExecutableBytes = readFileSync(proof.hostExecutablePath);
  const packageOutputProof = verifyPackageOutputReceipt(
    adapterId,
    JSON.parse(packageOutputReceiptBytes.toString("utf8"))
  );

  if (packageOutputProof.host !== "figma") {
    throw new Error("Figma package output host mismatch.");
  }

  verifyPackageManifest(proof, packageOutputProof.root);

  const receiptRoot = join(workspaceRoot, ".dx", "receipts", "extensions", adapterId);
  const loadedHostPath = join(receiptRoot, "loaded-host-latest.json");
  const packageOutput = {
    receiptPath: proof.packageOutputReceiptPath,
    receiptSha256: sha256(packageOutputReceiptBytes),
    packageSha256: packageOutputProof.sha256
  };
  const manualProof = {
    proofFilePath: proof.proofFilePath,
    proofFileSha256: sha256(proofFileBytes)
  };
  const loadedHost = {
    receipt: "dx.extension.figma.loaded_host",
    adapterId,
    host: "figma",
    generatedAt,
    verificationCommand,
    receiptPath: loadedHostPath,
    hostApplication: {
      name: "Figma",
      version: proof.hostVersion.trim(),
      executablePath: proof.hostExecutablePath,
      executableSha256: sha256(hostExecutableBytes),
      verificationMode: "figma-desktop-plugin",
      fileState: proof.fileState
    },
    packageOutput,
    loadedHost: {
      pluginUiRendered: true,
      commandIdsVisible: uniqueSorted(proof.commandIdsVisible),
      menuCommandsVisible: uniqueSorted(proof.menuCommandsVisible),
      commandResults: normalizeCommandResults(proof.commandResults),
      localServiceRequestsBlocked: true,
      networkAccessRestricted: true,
      mutatesFigmaFile: false,
      storesFigmaPayloads: false
    },
    manualProof,
    releaseClaims: {
      loadedHostVerified: true,
      pluginIdVerified: false,
      localServiceVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      communityReviewVerified: false,
      distributionVerified: false
    }
  };

  writeReceipt(loadedHostPath, loadedHost);

  const pluginIdPath = join(receiptRoot, "plugin-id-latest.json");
  const pluginId = {
    receipt: "dx.extension.figma.plugin_id",
    adapterId,
    host: "figma",
    generatedAt,
    verificationCommand,
    receiptPath: pluginIdPath,
    loadedHostReceiptPath: loadedHostPath,
    loadedHostReceiptSha256: sha256(readFileSync(loadedHostPath)),
    packageOutput,
    plugin: {
      manifestPluginId: proof.manifestPluginId.trim(),
      manifestPluginIdSha256: sha256(Buffer.from(proof.manifestPluginId.trim())),
      pluginIdVerified: true
    },
    manualProof,
    releaseClaims: {
      loadedHostVerified: true,
      pluginIdVerified: true,
      localServiceVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      communityReviewVerified: false,
      distributionVerified: false
    }
  };

  writeReceipt(pluginIdPath, pluginId);

  return {
    loadedHost,
    pluginId
  };
}

if (isDirectRun()) {
  try {
    const proofPath = process.env.DX_FIGMA_LOADED_HOST_PROOF_JSON;

    if (!proofPath) {
      throw new Error("DX_FIGMA_LOADED_HOST_PROOF_JSON must point to a Figma loaded-host proof JSON file.");
    }

    assertExistingAbsoluteFile(proofPath, "proof JSON");
    const proof = JSON.parse(readFileSync(proofPath, "utf8")) as FigmaLoadedHostProof;
    const receipts = writeFigmaLoadedHostReceipts(process.cwd(), {
      proof,
      verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run smoke:figma-loaded-host:j1"
    });

    console.log(`Figma loaded-host receipt written: ${receipts.loadedHost.receiptPath}`);
    console.log(`Figma plugin-id receipt written: ${receipts.pluginId.receiptPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function validateProof(proof: FigmaLoadedHostProof): FigmaLoadedHostProof {
  if (!isRecord(proof)) {
    throw new Error("Figma loaded-host proof must be an object.");
  }

  rejectPrivateKeys(proof);
  rejectUnexpectedProofKeys(proof);

  if (proof.hostApplication !== "Figma") {
    throw new Error("Figma loaded-host proof application must be Figma.");
  }

  assertNonEmpty(proof.hostVersion, "host version");
  assertExistingAbsoluteFile(proof.hostExecutablePath, "host executable");
  assertExistingAbsoluteFile(proof.packageOutputReceiptPath, "package-output receipt");
  assertExistingAbsoluteFile(proof.proofFilePath, "proof file");

  if (proof.verificationMode !== "figma-desktop-plugin") {
    throw new Error("Figma loaded-host proof mode must be figma-desktop-plugin.");
  }

  if (proof.loadedHostVerified !== true) {
    throw new Error("Figma loaded-host proof must verify a real loaded Figma host.");
  }

  if (proof.pluginIdVerified !== true) {
    throw new Error("Figma loaded-host proof must verify the plugin ID.");
  }

  assertNonEmpty(proof.manifestPluginId, "manifest plugin id");

  if (proof.pluginUiRendered !== true) {
    throw new Error("Figma loaded-host proof must verify the plugin UI rendered.");
  }

  if (proof.localServiceRequestsBlocked !== true) {
    throw new Error("Figma loaded-host proof must keep local-service requests blocked.");
  }

  if (!["test-file", "empty", "unavailable"].includes(proof.fileState)) {
    throw new Error("Figma loaded-host proof must use a coarse file state.");
  }

  if (proof.fileState !== "test-file") {
    throw new Error("Figma loaded-host proof must verify a loaded test file.");
  }

  if (proof.networkAccessRestricted !== true) {
    throw new Error("Figma loaded-host proof must keep network access restricted.");
  }

  if (proof.mutatesFigmaFile !== false) {
    throw new Error("Figma loaded-host proof must not mutate the Figma file.");
  }

  if (proof.storesFigmaPayloads !== false) {
    throw new Error("Figma loaded-host proof must not store Figma payloads.");
  }

  validateVisibleValues("command metadata", proof.commandIdsVisible, requiredCommandIds);
  validateVisibleValues("menu command metadata", proof.menuCommandsVisible, requiredMenuCommands);
  validateCommandResults(proof.commandResults);

  return proof;
}

function verifyPackageManifest(proof: FigmaLoadedHostProof, packageRoot: string): void {
  const manifest = JSON.parse(readFileSync(join(packageRoot, "manifest.json"), "utf8"));

  if (manifest.id !== proof.manifestPluginId) {
    throw new Error("Figma package manifest id must match loaded-host proof.");
  }
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
      throw new Error(`Figma loaded-host proof contains privacy-sensitive Figma proof field: ${key}`);
    }

    rejectPrivateKeys(child);
  }
}

function rejectUnexpectedProofKeys(proof: Record<string, unknown>): void {
  for (const key of Object.keys(proof)) {
    if (!proofKeys.has(key)) {
      throw new Error(`Unexpected Figma loaded-host proof field: ${key}`);
    }
  }
}

function validateVisibleValues(label: string, values: string[], expectedValues: string[]): void {
  const visible = new Set(values);

  for (const expected of expectedValues) {
    if (!visible.has(expected)) {
      throw new Error(`Figma loaded-host proof must include visible ${label} for ${expected}.`);
    }
  }

  for (const value of values) {
    if (!expectedValues.includes(value)) {
      throw new Error(`Figma loaded-host proof includes unsupported ${label}: ${value}.`);
    }
  }
}

function validateCommandResults(results: FigmaCommandResult[]): void {
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error("Figma loaded-host proof must include command result metadata.");
  }

  const resultCommands = new Set<string>();

  for (const result of results) {
    if (!isRecord(result)) {
      throw new Error("Figma loaded-host command result must be an object.");
    }

    for (const key of Object.keys(result)) {
      if (!commandResultKeys.has(key)) {
        throw new Error(`Figma loaded-host command result contains an unsupported field: ${key}`);
      }
    }

    if (!requiredCommandIds.includes(result.commandId)) {
      throw new Error(`Figma loaded-host command result uses unsupported command: ${result.commandId}`);
    }

    if (result.status !== "proof-blocked" && result.status !== "visible") {
      throw new Error(`Unsupported Figma loaded-host command result status: ${result.status}`);
    }

    resultCommands.add(result.commandId);
  }

  for (const commandId of requiredCommandIds) {
    if (!resultCommands.has(commandId)) {
      throw new Error(`Figma loaded-host proof must include command result metadata for ${commandId}.`);
    }
  }
}

function normalizeCommandResults(results: FigmaCommandResult[]): FigmaCommandResult[] {
  return [...results]
    .map((result) => ({
      commandId: result.commandId,
      status: result.status
    }))
    .sort((left, right) => left.commandId.localeCompare(right.commandId));
}

function assertExistingAbsoluteFile(path: string, label: string): void {
  if (!isAbsolute(path)) {
    throw new Error(`Figma loaded-host proof ${label} must be an absolute path.`);
  }

  if (!existsSync(path)) {
    throw new Error(`Figma loaded-host proof ${label} does not exist: ${path}`);
  }
}

function assertNonEmpty(value: string, label: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Figma loaded-host proof ${label} is required.`);
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
