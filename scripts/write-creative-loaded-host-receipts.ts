import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyPackageOutputReceipt } from "./lib/package-output-proof.ts";

export type CreativeLoadedHostTarget = "photoshop" | "premiere-pro" | "indesign" | "davinci-resolve";
export type CreativeLoadedHostVerificationMode = "uxp-developer-tool" | "resolve-scripting";
export type CreativeHostState = "loaded" | "empty" | "unavailable";
export type CreativeCommandStatus = "proof-blocked" | "visible";
export type ResolveScriptLanguage = "python" | "lua";

export interface CreativeLoadedHostReceiptOptions {
  generatedAt?: Date | string;
  verificationCommand?: string;
  proof: CreativeLoadedHostProof;
}

export type CreativeLoadedHostProof = AdobeUxpLoadedHostProof | DavinciResolveLoadedHostProof;

export interface CreativeLoadedHostProofBase {
  target: CreativeLoadedHostTarget;
  hostApplication: string;
  hostVersion: string;
  hostExecutablePath: string;
  packageOutputReceiptPath: string;
  proofFilePath: string;
  verificationMode: CreativeLoadedHostVerificationMode;
  loadedHostVerified: boolean;
  commandIdsVisible: string[];
  commandResults: CreativeLoadedHostCommandResult[];
  localServiceRequestsBlocked: boolean;
  hostState: CreativeHostState;
}

export interface AdobeUxpLoadedHostProof extends CreativeLoadedHostProofBase {
  target: "photoshop" | "premiere-pro" | "indesign";
  verificationMode: "uxp-developer-tool";
  uxpDeveloperToolPath: string;
  developerToolVerified: boolean;
  pluginLoaded: boolean;
  panelRendered: boolean;
  uxpManifestId: string;
  entrypointsVisible: string[];
}

export interface DavinciResolveLoadedHostProof extends CreativeLoadedHostProofBase {
  target: "davinci-resolve";
  verificationMode: "resolve-scripting";
  loadedResolveVerified: boolean;
  scriptLanguage: ResolveScriptLanguage;
  scriptLoadedInResolve: boolean;
  mutatesResolveProject: boolean;
  readOnlyProjectMetadataVerified: boolean;
  workflowIntegrationVerified: boolean;
}

export interface CreativeLoadedHostCommandResult {
  commandId: string;
  status: CreativeCommandStatus;
}

export interface CreativeLoadedHostReceipt {
  receipt: "dx.extension.creative.loaded_host";
  adapterId: string;
  host: CreativeLoadedHostTarget;
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  hostApplication: {
    name: string;
    version: string;
    executablePath: string;
    executableSha256: string;
    verificationMode: CreativeLoadedHostVerificationMode;
    hostState: CreativeHostState;
  };
  packageOutput: {
    receiptPath: string;
    receiptSha256: string;
    packageSha256: string;
  };
  loadedHost: {
    commandIdsVisible: string[];
    commandResults: CreativeLoadedHostCommandResult[];
    localServiceRequestsBlocked: true;
  };
  adobeUxp?: {
    uxpDeveloperToolPath: string;
    developerToolVerified: true;
    pluginLoaded: true;
    panelRendered: true;
    uxpManifestId: string;
    entrypointsVisible: string[];
  };
  davinciResolve?: {
    loadedResolveVerified: true;
    scriptLanguage: ResolveScriptLanguage;
    scriptLoadedInResolve: true;
    mutatesResolveProject: false;
    readOnlyProjectMetadataVerified: boolean;
    workflowIntegrationVerified: boolean;
  };
  manualProof: {
    proofFilePath: string;
    proofFileSha256: string;
  };
  releaseClaims: CreativeLoadedHostReleaseClaims;
}

export interface CreativeLoadedHostReleaseClaims {
  loadedHostVerified: true;
  developerToolVerified: false;
  ccxPackaged: false;
  nativeOrHybridPluginVerified: false;
  localServiceVerified: false;
  workflowIntegrationVerified: false;
  readOnlyProjectMetadataVerified: false;
  signingVerified: false;
  releaseChecksumVerified: false;
  distributionVerified: false;
}

export interface DavinciResolveWorkflowIntegrationReceipt {
  receipt: "dx.extension.davinci_resolve.workflow_integration";
  adapterId: "dx.davinci-resolve.command-center";
  host: "davinci-resolve";
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  loadedHostReceiptPath: string;
  loadedHostReceiptSha256: string;
  packageOutput: {
    receiptPath: string;
    receiptSha256: string;
    packageSha256: string;
  };
  workflow: {
    scriptLanguage: ResolveScriptLanguage;
    scriptLoadedInResolve: true;
    readOnlyProjectMetadataVerified: true;
    mutatesResolveProject: false;
    hostState: CreativeHostState;
  };
  manualProof: {
    proofFilePath: string;
    proofFileSha256: string;
  };
  releaseClaims: {
    loadedHostVerified: true;
    workflowIntegrationVerified: true;
    readOnlyProjectMetadataVerified: true;
    signingVerified: false;
    releaseChecksumVerified: false;
    distributionVerified: false;
  };
}

interface AdapterConfig {
  adapterId: string;
  entrypointIds?: string[];
  hostApplication: string;
  manifestId?: string;
  packageHost: CreativeLoadedHostTarget;
  requiredCommandIds: string[];
  target: CreativeLoadedHostTarget;
  verificationMode: CreativeLoadedHostVerificationMode;
}

const adapterConfigs: Record<CreativeLoadedHostTarget, AdapterConfig> = {
  photoshop: {
    adapterId: "dx.photoshop.command-center",
    entrypointIds: ["dxCommandCenterPanel", "dxShowReceipts", "dxShowStatus"],
    hostApplication: "Photoshop",
    manifestId: "dx.photoshop.command-center.development",
    packageHost: "photoshop",
    requiredCommandIds: [
      "dx.photoshop.show_status",
      "dx.photoshop.search_assets",
      "dx.photoshop.copy_receipts_path"
    ],
    target: "photoshop",
    verificationMode: "uxp-developer-tool"
  },
  "premiere-pro": {
    adapterId: "dx.premiere-pro.command-center",
    entrypointIds: ["dxCommandCenterPanel", "dxShowReceipts", "dxShowStatus"],
    hostApplication: "Premiere Pro",
    manifestId: "dx.premiere-pro.command-center.development",
    packageHost: "premiere-pro",
    requiredCommandIds: [
      "dx.premiere-pro.show_status",
      "dx.premiere-pro.search_media_assets",
      "dx.premiere-pro.show_receipts"
    ],
    target: "premiere-pro",
    verificationMode: "uxp-developer-tool"
  },
  indesign: {
    adapterId: "dx.indesign.command-center",
    entrypointIds: ["dxCommandCenterPanel", "dxShowReceipts", "dxShowStatus"],
    hostApplication: "InDesign",
    manifestId: "dx.indesign.command-center.development",
    packageHost: "indesign",
    requiredCommandIds: [
      "dx.indesign.show_status",
      "dx.indesign.search_assets",
      "dx.indesign.show_receipts"
    ],
    target: "indesign",
    verificationMode: "uxp-developer-tool"
  },
  "davinci-resolve": {
    adapterId: "dx.davinci-resolve.command-center",
    hostApplication: "DaVinci Resolve",
    packageHost: "davinci-resolve",
    requiredCommandIds: [
      "dx.davinci-resolve.show_status",
      "dx.davinci-resolve.inspect_project",
      "dx.davinci-resolve.show_receipts"
    ],
    target: "davinci-resolve",
    verificationMode: "resolve-scripting"
  }
};

const proofKeys = new Set([
  "target",
  "hostApplication",
  "hostVersion",
  "hostExecutablePath",
  "packageOutputReceiptPath",
  "proofFilePath",
  "verificationMode",
  "loadedHostVerified",
  "commandIdsVisible",
  "commandResults",
  "localServiceRequestsBlocked",
  "hostState",
  "uxpDeveloperToolPath",
  "developerToolVerified",
  "pluginLoaded",
  "panelRendered",
  "uxpManifestId",
  "entrypointsVisible",
  "loadedResolveVerified",
  "scriptLanguage",
  "scriptLoadedInResolve",
  "mutatesResolveProject",
  "readOnlyProjectMetadataVerified",
  "workflowIntegrationVerified"
]);
const commandResultKeys = new Set(["commandId", "status"]);
const privacySensitiveProofKeys = new Set([
  "account",
  "apiKey",
  "assetName",
  "clipboard",
  "clipboardContents",
  "documentName",
  "documentText",
  "domain",
  "email",
  "fileContents",
  "filePath",
  "mediaItemName",
  "nodeId",
  "organization",
  "pageName",
  "password",
  "projectName",
  "projectPath",
  "rawHostResponse",
  "sceneName",
  "secret",
  "selectionText",
  "teamId",
  "tenant",
  "timelineName",
  "token",
  "url",
  "userId",
  "workspaceId",
  "workspaceName"
]);

export function writeCreativeLoadedHostReceipt(
  root = process.cwd(),
  options: CreativeLoadedHostReceiptOptions
): CreativeLoadedHostReceipt {
  const workspaceRoot = resolve(root);
  const generatedAt = normalizeGeneratedAt(options.generatedAt);
  const verificationCommand = options.verificationCommand ?? "npm run smoke:creative-loaded-host:j1";
  const proof = validateProof(options.proof);
  const config = adapterConfigs[proof.target];
  const packageOutputReceiptBytes = readFileSync(proof.packageOutputReceiptPath);
  const proofFileBytes = readFileSync(proof.proofFilePath);
  const hostExecutableBytes = readFileSync(proof.hostExecutablePath);
  const packageOutputProof = verifyPackageOutputReceipt(
    config.adapterId,
    JSON.parse(packageOutputReceiptBytes.toString("utf8"))
  );

  if (packageOutputProof.host !== config.packageHost) {
    throw new Error(`Creative loaded-host package output host mismatch for ${config.adapterId}.`);
  }

  if (proof.target !== "davinci-resolve") {
    verifyAdobeManifest(proof, packageOutputProof.root);
  }

  const receiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    config.adapterId,
    "loaded-host-latest.json"
  );
  const receipt: CreativeLoadedHostReceipt = {
    receipt: "dx.extension.creative.loaded_host",
    adapterId: config.adapterId,
    host: config.target,
    generatedAt,
    verificationCommand,
    receiptPath,
    hostApplication: {
      name: proof.hostApplication.trim(),
      version: proof.hostVersion.trim(),
      executablePath: proof.hostExecutablePath,
      executableSha256: sha256(hostExecutableBytes),
      verificationMode: proof.verificationMode,
      hostState: proof.hostState
    },
    packageOutput: {
      receiptPath: proof.packageOutputReceiptPath,
      receiptSha256: sha256(packageOutputReceiptBytes),
      packageSha256: packageOutputProof.sha256
    },
    loadedHost: {
      commandIdsVisible: uniqueSorted(proof.commandIdsVisible),
      commandResults: normalizeCommandResults(proof.commandResults),
      localServiceRequestsBlocked: true
    },
    manualProof: {
      proofFilePath: proof.proofFilePath,
      proofFileSha256: sha256(proofFileBytes)
    },
    releaseClaims: {
      loadedHostVerified: true,
      developerToolVerified: false,
      ccxPackaged: false,
      nativeOrHybridPluginVerified: false,
      localServiceVerified: false,
      workflowIntegrationVerified: false,
      readOnlyProjectMetadataVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      distributionVerified: false
    }
  };

  if (proof.target === "davinci-resolve") {
    receipt.davinciResolve = {
      loadedResolveVerified: true,
      scriptLanguage: proof.scriptLanguage,
      scriptLoadedInResolve: true,
      mutatesResolveProject: false,
      readOnlyProjectMetadataVerified: proof.readOnlyProjectMetadataVerified,
      workflowIntegrationVerified: proof.workflowIntegrationVerified
    };
  } else {
    receipt.adobeUxp = {
      uxpDeveloperToolPath: proof.uxpDeveloperToolPath,
      developerToolVerified: true,
      pluginLoaded: true,
      panelRendered: true,
      uxpManifestId: proof.uxpManifestId,
      entrypointsVisible: uniqueSorted(proof.entrypointsVisible)
    };
  }

  writeJsonReceipt(receiptPath, receipt);

  if (proof.target === "davinci-resolve" && proof.workflowIntegrationVerified === true) {
    writeDavinciResolveWorkflowIntegrationReceipt(workspaceRoot, {
      generatedAt,
      loadedHostReceipt: receipt,
      packageOutputReceiptBytes,
      proof,
      proofFileBytes,
      verificationCommand
    });
  }

  return receipt;
}

export function writeCreativeLoadedHostReceipts(
  root = process.cwd(),
  options: Omit<CreativeLoadedHostReceiptOptions, "proof"> & {
    proof: CreativeLoadedHostProof | CreativeLoadedHostProof[];
  }
): CreativeLoadedHostReceipt[] {
  const proofs = Array.isArray(options.proof) ? options.proof : [options.proof];

  return proofs.map((proof) =>
    writeCreativeLoadedHostReceipt(root, {
      generatedAt: options.generatedAt,
      verificationCommand: options.verificationCommand,
      proof
    })
  );
}

if (isDirectRun()) {
  try {
    const proofPath = process.env.DX_CREATIVE_LOADED_HOST_PROOF_JSON;

    if (!proofPath) {
      throw new Error("DX_CREATIVE_LOADED_HOST_PROOF_JSON must point to a creative loaded-host proof JSON file.");
    }

    assertExistingAbsoluteFile(proofPath, "proof JSON");
    const proofSource = JSON.parse(readFileSync(proofPath, "utf8")) as
      | CreativeLoadedHostProof
      | CreativeLoadedHostProof[];
    const receipts = writeCreativeLoadedHostReceipts(process.cwd(), {
      proof: proofSource,
      verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run smoke:creative-loaded-host:j1"
    });

    for (const receipt of receipts) {
      console.log(`${receipt.hostApplication.name} loaded-host receipt written: ${receipt.receiptPath}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function writeDavinciResolveWorkflowIntegrationReceipt(
  root: string,
  options: {
    generatedAt: string;
    loadedHostReceipt: CreativeLoadedHostReceipt;
    packageOutputReceiptBytes: Buffer;
    proof: DavinciResolveLoadedHostProof;
    proofFileBytes: Buffer;
    verificationCommand: string;
  }
): DavinciResolveWorkflowIntegrationReceipt {
  if (options.proof.readOnlyProjectMetadataVerified !== true) {
    throw new Error("DaVinci Resolve workflow integration proof must verify read-only project metadata.");
  }

  const receiptPath = join(
    root,
    ".dx",
    "receipts",
    "extensions",
    "dx.davinci-resolve.command-center",
    "workflow-integration-latest.json"
  );
  const receiptBytes = readFileSync(options.loadedHostReceipt.receiptPath);
  const receipt: DavinciResolveWorkflowIntegrationReceipt = {
    receipt: "dx.extension.davinci_resolve.workflow_integration",
    adapterId: "dx.davinci-resolve.command-center",
    host: "davinci-resolve",
    generatedAt: options.generatedAt,
    verificationCommand: options.verificationCommand,
    receiptPath,
    loadedHostReceiptPath: options.loadedHostReceipt.receiptPath,
    loadedHostReceiptSha256: sha256(receiptBytes),
    packageOutput: {
      receiptPath: options.loadedHostReceipt.packageOutput.receiptPath,
      receiptSha256: sha256(options.packageOutputReceiptBytes),
      packageSha256: options.loadedHostReceipt.packageOutput.packageSha256
    },
    workflow: {
      scriptLanguage: options.proof.scriptLanguage,
      scriptLoadedInResolve: true,
      readOnlyProjectMetadataVerified: true,
      mutatesResolveProject: false,
      hostState: options.proof.hostState
    },
    manualProof: {
      proofFilePath: options.proof.proofFilePath,
      proofFileSha256: sha256(options.proofFileBytes)
    },
    releaseClaims: {
      loadedHostVerified: true,
      workflowIntegrationVerified: true,
      readOnlyProjectMetadataVerified: true,
      signingVerified: false,
      releaseChecksumVerified: false,
      distributionVerified: false
    }
  };

  writeJsonReceipt(receiptPath, receipt);
  return receipt;
}

function validateProof(proof: CreativeLoadedHostProof): CreativeLoadedHostProof {
  if (!isRecord(proof)) {
    throw new Error("Creative loaded-host proof must be an object.");
  }

  rejectPrivacySensitiveKeys(proof);
  rejectUnexpectedProofKeys(proof);

  if (!Object.hasOwn(adapterConfigs, proof.target)) {
    throw new Error(`Unsupported creative loaded-host target: ${proof.target}`);
  }

  const config = adapterConfigs[proof.target];

  if (proof.hostApplication !== config.hostApplication) {
    throw new Error(`Creative loaded-host proof application must be ${config.hostApplication}.`);
  }

  if (proof.verificationMode !== config.verificationMode) {
    throw new Error(`Creative loaded-host proof mode must be ${config.verificationMode}.`);
  }

  assertNonEmpty(proof.hostVersion, "host version");
  assertExistingAbsoluteFile(proof.hostExecutablePath, "host executable");
  assertExistingAbsoluteFile(proof.packageOutputReceiptPath, "package-output receipt");
  assertExistingAbsoluteFile(proof.proofFilePath, "proof file");

  if (proof.loadedHostVerified !== true) {
    throw new Error("Creative loaded-host proof must verify a real creative host.");
  }

  if (proof.localServiceRequestsBlocked !== true) {
    throw new Error("Creative loaded-host proof must keep local-service requests blocked.");
  }

  if (!["loaded", "empty", "unavailable"].includes(proof.hostState)) {
    throw new Error("Creative loaded-host proof must use a coarse host state.");
  }

  if (proof.hostState !== "loaded") {
    throw new Error("Creative loaded-host proof must verify a loaded creative host state.");
  }

  validateCommandIds(proof, config);
  validateCommandResults(proof, config);

  if (proof.target === "davinci-resolve") {
    validateDavinciResolveProof(proof);
  } else {
    validateAdobeUxpProof(proof, config);
  }

  return proof;
}

function validateAdobeUxpProof(proof: AdobeUxpLoadedHostProof, config: AdapterConfig): void {
  assertExistingAbsoluteFile(proof.uxpDeveloperToolPath, "UXP Developer Tool");

  if (proof.developerToolVerified !== true) {
    throw new Error("Adobe UXP loaded-host proof must verify UXP Developer Tool.");
  }

  if (proof.pluginLoaded !== true) {
    throw new Error("Adobe UXP loaded-host proof must verify the plugin is loaded.");
  }

  if (proof.panelRendered !== true) {
    throw new Error("Adobe UXP loaded-host proof must verify the panel rendered.");
  }

  if (proof.uxpManifestId !== config.manifestId) {
    throw new Error(`Adobe UXP loaded-host proof manifest id must be ${config.manifestId}.`);
  }

  const visibleEntryPoints = new Set(proof.entrypointsVisible);

  for (const entrypointId of config.entrypointIds ?? []) {
    if (!visibleEntryPoints.has(entrypointId)) {
      throw new Error(`Adobe UXP loaded-host proof must include visible entrypoint metadata for ${entrypointId}.`);
    }
  }

  for (const entrypointId of proof.entrypointsVisible) {
    if (!(config.entrypointIds ?? []).includes(entrypointId)) {
      throw new Error(`Adobe UXP loaded-host proof includes unsupported entrypoint metadata: ${entrypointId}.`);
    }
  }
}

function validateDavinciResolveProof(proof: DavinciResolveLoadedHostProof): void {
  if (proof.loadedResolveVerified !== true) {
    throw new Error("DaVinci Resolve loaded-host proof must verify loaded Resolve.");
  }

  if (proof.scriptLanguage !== "python" && proof.scriptLanguage !== "lua") {
    throw new Error("DaVinci Resolve loaded-host proof must use python or lua.");
  }

  if (proof.scriptLoadedInResolve !== true) {
    throw new Error("DaVinci Resolve loaded-host proof must verify the script loaded inside Resolve.");
  }

  if (proof.mutatesResolveProject !== false) {
    throw new Error("DaVinci Resolve loaded-host proof must not mutate the Resolve project.");
  }

  if (typeof proof.readOnlyProjectMetadataVerified !== "boolean") {
    throw new Error("DaVinci Resolve proof must explicitly state read-only project metadata verification.");
  }

  if (typeof proof.workflowIntegrationVerified !== "boolean") {
    throw new Error("DaVinci Resolve proof must explicitly state workflow integration verification.");
  }

  if (proof.workflowIntegrationVerified === true && proof.readOnlyProjectMetadataVerified !== true) {
    throw new Error("DaVinci Resolve workflow integration proof requires read-only project metadata verification.");
  }
}

function verifyAdobeManifest(proof: AdobeUxpLoadedHostProof, packageRoot: string): void {
  const manifest = JSON.parse(readFileSync(join(packageRoot, "manifest.json"), "utf8"));

  if (manifest.id !== proof.uxpManifestId) {
    throw new Error(`Adobe UXP package manifest id changed for ${proof.target}.`);
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
      throw new Error(`Creative loaded-host proof contains privacy-sensitive creative loaded-host proof field: ${key}`);
    }

    rejectPrivacySensitiveKeys(child);
  }
}

function rejectUnexpectedProofKeys(proof: Record<string, unknown>): void {
  for (const key of Object.keys(proof)) {
    if (!proofKeys.has(key)) {
      throw new Error(`Unexpected creative loaded-host proof field: ${key}`);
    }
  }
}

function validateCommandIds(proof: CreativeLoadedHostProof, config: AdapterConfig): void {
  const visible = new Set(proof.commandIdsVisible);

  for (const commandId of config.requiredCommandIds) {
    if (!visible.has(commandId)) {
      throw new Error(`Creative loaded-host proof must include visible command metadata for ${commandId}.`);
    }
  }

  for (const commandId of proof.commandIdsVisible) {
    if (!config.requiredCommandIds.includes(commandId)) {
      throw new Error(`Creative loaded-host proof includes unsupported command metadata: ${commandId}.`);
    }
  }
}

function validateCommandResults(proof: CreativeLoadedHostProof, config: AdapterConfig): void {
  if (!Array.isArray(proof.commandResults) || proof.commandResults.length === 0) {
    throw new Error("Creative loaded-host proof must include command result metadata.");
  }

  const resultCommands = new Set<string>();

  for (const result of proof.commandResults) {
    if (!isRecord(result)) {
      throw new Error("Creative loaded-host command result must be an object.");
    }

    for (const key of Object.keys(result)) {
      if (!commandResultKeys.has(key)) {
        throw new Error(`Creative loaded-host command result contains an unsupported field: ${key}`);
      }
    }

    if (!config.requiredCommandIds.includes(result.commandId)) {
      throw new Error(`Creative loaded-host command result uses unsupported command: ${result.commandId}`);
    }

    if (result.status !== "proof-blocked" && result.status !== "visible") {
      throw new Error(`Unsupported creative loaded-host command result status: ${result.status}`);
    }

    resultCommands.add(result.commandId);
  }

  for (const commandId of config.requiredCommandIds) {
    if (!resultCommands.has(commandId)) {
      throw new Error(`Creative loaded-host proof must include command result metadata for ${commandId}.`);
    }
  }
}

function normalizeCommandResults(results: CreativeLoadedHostCommandResult[]): CreativeLoadedHostCommandResult[] {
  return [...results]
    .map((result) => ({
      commandId: result.commandId,
      status: result.status
    }))
    .sort((left, right) => left.commandId.localeCompare(right.commandId));
}

function writeJsonReceipt(path: string, receipt: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`);
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function assertExistingAbsoluteFile(path: string, label: string): void {
  if (!isAbsolute(path)) {
    throw new Error(`Creative loaded-host proof ${label} must be an absolute path.`);
  }

  if (!existsSync(path)) {
    throw new Error(`Creative loaded-host proof ${label} does not exist: ${path}`);
  }
}

function assertNonEmpty(value: string, label: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Creative loaded-host proof ${label} is required.`);
  }
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
