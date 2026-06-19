import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defaultPlatformHostDiscoveryTargets } from "./platform-host-discovery-targets.ts";
import {
  type IdeGameEngineCommandOperation,
  type IdeGameEngineCommandStatus,
  type IdeGameEngineCommandTransport,
  expectedIdeGameEngineCommandResultFor
} from "./lib/ide-game-engine-command-result-semantics.ts";
import { verifyPackageOutputReceipt } from "./lib/package-output-proof.ts";

export type IdeGameEngineLoadedHostTarget =
  | "intellij-platform"
  | "visual-studio"
  | "unity-editor"
  | "unreal-engine";
export type IdeGameEngineLoadedHostVerificationMode =
  | "sandbox-ide"
  | "experimental-instance"
  | "loaded-editor";
export type IdeGameEngineProjectState = "loaded" | "empty" | "unavailable";

export interface IdeGameEngineLoadedHostReceiptOptions {
  generatedAt?: Date | string;
  verificationCommand?: string;
  proof: IdeGameEngineLoadedHostProof;
}

export interface IdeGameEngineLoadedHostProof {
  target: IdeGameEngineLoadedHostTarget;
  hostApplication: string;
  hostVersion: string;
  hostExecutablePath: string;
  packageOutputReceiptPath: string;
  proofFilePath: string;
  verificationMode: IdeGameEngineLoadedHostVerificationMode;
  loadedHostVerified: boolean;
  extensionInstalled: boolean;
  commandIdsVisible: string[];
  commandResults: IdeGameEngineCommandResult[];
  localServiceRequestsBlocked: boolean;
  projectState: IdeGameEngineProjectState;
}

export interface IdeGameEngineCommandResult {
  commandId: string;
  operation: IdeGameEngineCommandOperation;
  transport: IdeGameEngineCommandTransport;
  status: IdeGameEngineCommandStatus;
}

export interface IdeGameEngineLoadedHostReceipt {
  receipt: "dx.extension.ide_game_engine.loaded_host";
  adapterId: string;
  host: IdeGameEngineLoadedHostTarget;
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  hostApplication: {
    name: string;
    version: string;
    executablePath: string;
    verificationMode: IdeGameEngineLoadedHostVerificationMode;
    projectState: IdeGameEngineProjectState;
  };
  packageOutput: {
    receiptPath: string;
    receiptSha256: string;
    packageSha256: string;
  };
  hostDiscovery: {
    receiptPath: string;
    receiptSha256: string;
    toolId: string;
    toolPath: string;
    executableSha256: string;
    requiredTools: Array<{
      id: string;
      path: string;
      sha256: string;
    }>;
  };
  loadedHost: {
    extensionInstalled: true;
    commandIdsVisible: string[];
    commandResults: IdeGameEngineCommandResult[];
    localServiceRequestsBlocked: true;
  };
  manualProof: {
    proofFilePath: string;
    proofFileSha256: string;
  };
  releaseClaims: {
    loadedHostVerified: true;
    localServiceVerified: false;
    signingVerified: false;
    releaseChecksumVerified: false;
    distributionVerified: false;
    pluginVerifierVerified: false;
    projectImportVerified: false;
    projectEnablementVerified: false;
    marketplaceReviewVerified: false;
  };
}

interface AdapterConfig {
  adapterId: string;
  hostApplication: string;
  receiptName: string;
  requiredCommandIds: string[];
  target: IdeGameEngineLoadedHostTarget;
  hostToolId: string;
  verificationMode: IdeGameEngineLoadedHostVerificationMode;
}

const adapterConfigs: Record<IdeGameEngineLoadedHostTarget, AdapterConfig> = {
  "intellij-platform": {
    adapterId: "dx.intellij-platform.command-center",
    hostApplication: "IntelliJ IDEA",
    receiptName: "sandbox-ide-latest.json",
    requiredCommandIds: [
      "dx.intellij-platform.show_status",
      "dx.intellij-platform.search_assets",
      "dx.intellij-platform.show_receipts"
    ],
    target: "intellij-platform",
    hostToolId: "idea",
    verificationMode: "sandbox-ide"
  },
  "visual-studio": {
    adapterId: "dx.visual-studio.command-center",
    hostApplication: "Visual Studio",
    receiptName: "experimental-instance-latest.json",
    requiredCommandIds: [
      "dx.visual-studio.show_status",
      "dx.visual-studio.search_assets",
      "dx.visual-studio.show_receipts"
    ],
    target: "visual-studio",
    hostToolId: "devenv",
    verificationMode: "experimental-instance"
  },
  "unity-editor": {
    adapterId: "dx.unity-editor.command-center",
    hostApplication: "Unity Editor",
    receiptName: "loaded-host-latest.json",
    requiredCommandIds: [
      "dx.unity-editor.show_status",
      "dx.unity-editor.search_assets",
      "dx.unity-editor.show_receipts"
    ],
    target: "unity-editor",
    hostToolId: "unity-editor",
    verificationMode: "loaded-editor"
  },
  "unreal-engine": {
    adapterId: "dx.unreal-engine.command-center",
    hostApplication: "Unreal Editor",
    receiptName: "loaded-host-latest.json",
    requiredCommandIds: [
      "dx.unreal-engine.show_status",
      "dx.unreal-engine.search_assets",
      "dx.unreal-engine.show_receipts"
    ],
    target: "unreal-engine",
    hostToolId: "unreal-editor",
    verificationMode: "loaded-editor"
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
  "extensionInstalled",
  "commandIdsVisible",
  "commandResults",
  "localServiceRequestsBlocked",
  "projectState"
]);
const commandResultKeys = new Set(["commandId", "operation", "transport", "status"]);
const privacySensitiveProofKeys = new Set([
  "account",
  "apiKey",
  "assetName",
  "documentName",
  "filePath",
  "organization",
  "password",
  "projectName",
  "projectPath",
  "sceneName",
  "secret",
  "solutionName",
  "tenant",
  "token",
  "url",
  "workspaceName"
]);

export function writeIdeGameEngineLoadedHostReceipt(
  root = process.cwd(),
  options: IdeGameEngineLoadedHostReceiptOptions
): IdeGameEngineLoadedHostReceipt {
  const workspaceRoot = resolve(root);
  const proof = validateProof(options.proof);
  const config = adapterConfigs[proof.target];
  const packageOutputReceiptBytes = readFileSync(proof.packageOutputReceiptPath);
  const proofFileBytes = readFileSync(proof.proofFilePath);
  const hostExecutableBytes = readFileSync(proof.hostExecutablePath);
  const packageOutputProof = verifyPackageOutputReceipt(
    config.adapterId,
    JSON.parse(packageOutputReceiptBytes.toString("utf8"))
  );
  const hostDiscovery = readHostDiscoveryLink(
    workspaceRoot,
    config,
    proof.hostExecutablePath,
    sha256(hostExecutableBytes)
  );

  if (packageOutputProof.host !== config.target) {
    throw new Error(`IDE/game-engine package output host mismatch for ${config.adapterId}.`);
  }

  const receiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    config.adapterId,
    config.receiptName
  );
  const receipt: IdeGameEngineLoadedHostReceipt = {
    receipt: "dx.extension.ide_game_engine.loaded_host",
    adapterId: config.adapterId,
    host: config.target,
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand: options.verificationCommand ?? "npm run smoke:ide-game-engine-loaded-host:j1",
    receiptPath,
    hostApplication: {
      name: proof.hostApplication.trim(),
      version: proof.hostVersion.trim(),
      executablePath: proof.hostExecutablePath,
      verificationMode: proof.verificationMode,
      projectState: proof.projectState
    },
    packageOutput: {
      receiptPath: proof.packageOutputReceiptPath,
      receiptSha256: sha256(packageOutputReceiptBytes),
      packageSha256: packageOutputProof.sha256
    },
    hostDiscovery,
    loadedHost: {
      extensionInstalled: true,
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
      localServiceVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      distributionVerified: false,
      pluginVerifierVerified: false,
      projectImportVerified: false,
      projectEnablementVerified: false,
      marketplaceReviewVerified: false
    }
  };

  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

  return receipt;
}

export function writeIdeGameEngineLoadedHostReceipts(
  root = process.cwd(),
  options: Omit<IdeGameEngineLoadedHostReceiptOptions, "proof"> & {
    proof: IdeGameEngineLoadedHostProof | IdeGameEngineLoadedHostProof[];
  }
): IdeGameEngineLoadedHostReceipt[] {
  const proofs = Array.isArray(options.proof) ? options.proof : [options.proof];

  return proofs.map((proof) =>
    writeIdeGameEngineLoadedHostReceipt(root, {
      generatedAt: options.generatedAt,
      verificationCommand: options.verificationCommand,
      proof
    })
  );
}

if (isDirectRun()) {
  try {
    const proofPath = process.env.DX_IDE_GAME_ENGINE_LOADED_HOST_PROOF_JSON;

    if (!proofPath) {
      throw new Error(
        "DX_IDE_GAME_ENGINE_LOADED_HOST_PROOF_JSON must point to an IDE/game-engine loaded-host proof JSON file."
      );
    }

    assertExistingAbsoluteFile(proofPath, "proof JSON");
    const proofSource = JSON.parse(readFileSync(proofPath, "utf8")) as
      | IdeGameEngineLoadedHostProof
      | IdeGameEngineLoadedHostProof[];
    const receipts = writeIdeGameEngineLoadedHostReceipts(process.cwd(), {
      proof: proofSource,
      verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run smoke:ide-game-engine-loaded-host:j1"
    });

    for (const receipt of receipts) {
      console.log(`${receipt.hostApplication.name} loaded-host receipt written: ${receipt.receiptPath}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function readHostDiscoveryLink(
  workspaceRoot: string,
  config: AdapterConfig,
  hostExecutablePath: string,
  executableSha256: string
): IdeGameEngineLoadedHostReceipt["hostDiscovery"] {
  const receiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    config.adapterId,
    "host-discovery-latest.json"
  );

  if (!existsSync(receiptPath)) {
    throw new Error(`IDE/game-engine loaded-host proof host-discovery receipt does not exist: ${receiptPath}`);
  }

  const receiptBytes = readFileSync(receiptPath);
  let receipt: unknown;

  try {
    receipt = JSON.parse(receiptBytes.toString("utf8"));
  } catch {
    throw new Error(`IDE/game-engine loaded-host proof host-discovery receipt is not readable JSON: ${receiptPath}`);
  }

  if (
    !isRecord(receipt) ||
    receipt.receipt !== "dx.extension.platform_host_discovery" ||
    receipt.adapterId !== config.adapterId ||
    receipt.host !== config.target ||
    receipt.status !== "candidate-found" ||
    receipt.candidateFound !== true
  ) {
    throw new Error(`IDE/game-engine loaded-host proof host-discovery receipt is invalid for ${config.adapterId}.`);
  }

  const tools = Array.isArray(receipt.tools) ? receipt.tools.filter(isRecord) : [];
  const missingRequiredTools = readStringArray(receipt.missingRequiredTools);

  if (missingRequiredTools.length > 0) {
    throw new Error(
      `IDE/game-engine loaded-host proof host-discovery receipt contradicts missing required tools for ${config.adapterId}: ${missingRequiredTools.join(", ")}.`
    );
  }

  const requiredTools = readRequiredHostDiscoveryTools(config, tools);
  const hostTool = requiredTools.find((tool) => tool.id === config.hostToolId);

  if (!hostTool || hostTool.found !== true || hostTool.path !== hostExecutablePath) {
    throw new Error(
      `IDE/game-engine loaded-host proof host-discovery receipt must match host executable for ${config.adapterId}.`
    );
  }

  return {
    receiptPath,
    receiptSha256: sha256(receiptBytes),
    toolId: config.hostToolId,
    toolPath: hostExecutablePath,
    executableSha256,
    requiredTools: requiredTools.map((tool) => ({
      id: String(tool.id),
      path: String(tool.path),
      sha256: sha256(readFileSync(String(tool.path)))
    }))
  };
}

function readRequiredHostDiscoveryTools(
  config: AdapterConfig,
  tools: Record<string, unknown>[]
): Record<string, unknown>[] {
  const expectedToolIds = requiredHostDiscoveryToolIds(config.adapterId);
  const requiredTools: Record<string, unknown>[] = [];

  for (const toolId of expectedToolIds) {
    const tool = tools.find((candidate) => candidate.id === toolId);

    if (tool?.found !== true || typeof tool.path !== "string" || tool.path.trim() === "") {
      throw new Error(`IDE/game-engine loaded-host proof host-discovery receipt is missing required host-discovery tool: ${toolId}.`);
    }

    if (!existsSync(tool.path)) {
      throw new Error(`IDE/game-engine loaded-host proof required host-discovery tool does not exist: ${toolId}.`);
    }

    requiredTools.push(tool);
  }

  return requiredTools;
}

function requiredHostDiscoveryToolIds(adapterId: string): string[] {
  const target = defaultPlatformHostDiscoveryTargets.find((candidate) => candidate.adapterId === adapterId);

  if (!target) {
    throw new Error(`IDE/game-engine loaded-host proof host-discovery target is not registered: ${adapterId}.`);
  }

  return target.tools
    .filter((tool) => tool.required)
    .map((tool) => tool.id);
}

function validateProof(proof: IdeGameEngineLoadedHostProof): IdeGameEngineLoadedHostProof {
  if (!isRecord(proof)) {
    throw new Error("IDE/game-engine loaded-host proof must be an object.");
  }

  rejectPrivacySensitiveKeys(proof);
  rejectUnexpectedProofKeys(proof);

  if (!Object.hasOwn(adapterConfigs, proof.target)) {
    throw new Error(`Unsupported IDE/game-engine loaded-host target: ${proof.target}`);
  }

  const config = adapterConfigs[proof.target];

  if (proof.hostApplication !== config.hostApplication) {
    throw new Error(`IDE/game-engine loaded-host proof application must be ${config.hostApplication}.`);
  }

  if (proof.verificationMode !== config.verificationMode) {
    throw new Error(`IDE/game-engine loaded-host proof mode must be ${config.verificationMode}.`);
  }

  assertNonEmpty(proof.hostVersion, "host version");
  assertExistingAbsoluteFile(proof.hostExecutablePath, "host executable");
  assertExistingAbsoluteFile(proof.packageOutputReceiptPath, "package-output receipt");
  assertExistingAbsoluteFile(proof.proofFilePath, "proof file");

  if (proof.loadedHostVerified !== true) {
    throw new Error("IDE/game-engine loaded-host proof must verify a real loaded host.");
  }

  if (proof.extensionInstalled !== true) {
    throw new Error("IDE/game-engine loaded-host proof must verify the extension is installed.");
  }

  if (proof.localServiceRequestsBlocked !== true) {
    throw new Error("IDE/game-engine loaded-host proof must keep local-service requests blocked.");
  }

  if (!["loaded", "empty", "unavailable"].includes(proof.projectState)) {
    throw new Error("IDE/game-engine loaded-host proof must use a coarse project state.");
  }

  if (proof.projectState !== "loaded") {
    throw new Error("IDE/game-engine loaded-host proof must verify a loaded project state.");
  }

  validateCommandIds(proof, config);
  validateCommandResults(proof, config);

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
      throw new Error(
        `IDE/game-engine loaded-host proof contains privacy-sensitive IDE/game-engine loaded-host proof field: ${key}`
      );
    }

    rejectPrivacySensitiveKeys(child);
  }
}

function rejectUnexpectedProofKeys(proof: Record<string, unknown>): void {
  for (const key of Object.keys(proof)) {
    if (!proofKeys.has(key)) {
      throw new Error(`Unexpected IDE/game-engine loaded-host proof field: ${key}`);
    }
  }
}

function validateCommandIds(proof: IdeGameEngineLoadedHostProof, config: AdapterConfig): void {
  const visible = new Set(proof.commandIdsVisible);

  for (const commandId of config.requiredCommandIds) {
    if (!visible.has(commandId)) {
      throw new Error(`IDE/game-engine loaded-host proof must include visible command metadata for ${commandId}.`);
    }
  }

  for (const commandId of proof.commandIdsVisible) {
    if (!config.requiredCommandIds.includes(commandId)) {
      throw new Error(`IDE/game-engine loaded-host proof includes unsupported command metadata: ${commandId}`);
    }
  }
}

function validateCommandResults(proof: IdeGameEngineLoadedHostProof, config: AdapterConfig): void {
  if (!Array.isArray(proof.commandResults) || proof.commandResults.length === 0) {
    throw new Error("IDE/game-engine loaded-host proof must include command result metadata.");
  }

  const resultCommands = new Set<string>();

  for (const result of proof.commandResults) {
    if (!isRecord(result)) {
      throw new Error("IDE/game-engine loaded-host command result must be an object.");
    }

    for (const key of Object.keys(result)) {
      if (!commandResultKeys.has(key)) {
        throw new Error(`IDE/game-engine loaded-host command result contains an unsupported field: ${key}`);
      }
    }

    if (!config.requiredCommandIds.includes(result.commandId)) {
      throw new Error(`IDE/game-engine loaded-host command result uses unsupported command: ${result.commandId}`);
    }

    const expectedCommandResult = expectedIdeGameEngineCommandResultFor(result.commandId);

    if (
      !expectedCommandResult ||
      result.operation !== expectedCommandResult.operation ||
      result.transport !== expectedCommandResult.transport ||
      result.status !== expectedCommandResult.status
    ) {
      throw new Error(
        `IDE/game-engine loaded-host proof must map command result ${result.commandId} to ${expectedCommandResult?.operation ?? "a supported operation"} over ${expectedCommandResult?.transport ?? "a supported transport"} with ${expectedCommandResult?.status ?? "a supported status"}.`
      );
    }

    resultCommands.add(result.commandId);
  }

  for (const commandId of config.requiredCommandIds) {
    if (!resultCommands.has(commandId)) {
      throw new Error(`IDE/game-engine loaded-host proof must include command result metadata for ${commandId}.`);
    }
  }
}

function normalizeCommandResults(results: IdeGameEngineCommandResult[]): IdeGameEngineCommandResult[] {
  return [...results]
    .map((result) => ({
      commandId: result.commandId,
      operation: result.operation,
      transport: result.transport,
      status: result.status
    }))
    .sort((left, right) => left.commandId.localeCompare(right.commandId));
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function assertExistingAbsoluteFile(path: string, label: string): void {
  if (!isAbsolute(path)) {
    throw new Error(`IDE/game-engine loaded-host proof ${label} must be an absolute path.`);
  }

  if (!existsSync(path)) {
    throw new Error(`IDE/game-engine loaded-host proof ${label} does not exist: ${path}`);
  }
}

function assertNonEmpty(value: string, label: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`IDE/game-engine loaded-host proof ${label} is required.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "")
    : [];
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
