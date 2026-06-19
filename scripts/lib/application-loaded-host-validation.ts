import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute } from "node:path";

import {
  type ApplicationLoadedHostAdapterConfig,
  type ApplicationLoadedHostProof,
  applicationLoadedHostAdapterConfigs
} from "./application-loaded-host-model.ts";

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
  "hostState",
  "mutatesHostDocument",
  "extensionId",
  "extensionLoaded",
  "addonInstalled",
  "developmentAppVerified",
  "runtimePermissionsEmpty",
  "sketchtoolPath",
  "sketchtoolVerified",
  "zedDevExtension"
]);

const commandResultKeys = new Set(["commandId", "status"]);
const zedDevExtensionKeys = new Set([
  "sourcePath",
  "installedPath",
  "installedPathLinksToSource",
  "extensionIndexPath",
  "extensionIndexContainsDevExtension",
  "hostLogPath",
  "hostLogReferencesExtension",
  "wasmArtifactPath",
  "wasmArtifactSha256",
  "hostExecutableSha256"
]);

const privacySensitiveProofKeys = new Set([
  "account",
  "apiKey",
  "assetName",
  "clipboard",
  "clipboardContents",
  "designId",
  "designName",
  "documentName",
  "documentText",
  "email",
  "fileContents",
  "fileId",
  "fileKey",
  "fileName",
  "filePath",
  "organization",
  "password",
  "projectName",
  "projectPath",
  "rawHostResponse",
  "secret",
  "selectionText",
  "teamId",
  "tenant",
  "token",
  "url",
  "userId",
  "vaultName",
  "workspaceId",
  "workspaceName"
]);

export function validateApplicationLoadedHostProof(
  proof: ApplicationLoadedHostProof
): ApplicationLoadedHostProof {
  if (!isRecord(proof)) {
    throw new Error("Application loaded-host proof must be an object.");
  }

  rejectPrivacySensitiveKeys(proof);
  rejectUnexpectedProofKeys(proof);

  if (!Object.hasOwn(applicationLoadedHostAdapterConfigs, proof.target)) {
    throw new Error(`Unsupported application loaded-host target: ${proof.target}`);
  }

  const config = applicationLoadedHostAdapterConfigs[proof.target];

  if (proof.hostApplication !== config.hostApplication) {
    throw new Error(`Application loaded-host proof application must be ${config.hostApplication}.`);
  }

  if (proof.verificationMode !== config.verificationMode) {
    throw new Error(`Application loaded-host proof mode must be ${config.verificationMode}.`);
  }

  assertNonEmpty(proof.hostVersion, "host version");
  assertExistingAbsoluteFile(proof.hostExecutablePath, "host executable");
  assertExistingAbsoluteFile(proof.packageOutputReceiptPath, "package-output receipt");
  assertExistingAbsoluteFile(proof.proofFilePath, "proof file");

  if (proof.loadedHostVerified !== true) {
    throw new Error("Application loaded-host proof must verify a real loaded host.");
  }

  if (proof.extensionInstalled !== true) {
    throw new Error("Application loaded-host proof must verify the extension is installed.");
  }

  if (proof.localServiceRequestsBlocked !== true) {
    throw new Error("Application loaded-host proof must keep local-service requests blocked.");
  }

  if (!["loaded", "empty", "unavailable"].includes(proof.hostState)) {
    throw new Error("Application loaded-host proof must use a coarse host state.");
  }

  if (proof.hostState !== "loaded") {
    throw new Error("Application loaded-host proof must verify a loaded host state.");
  }

  if (proof.mutatesHostDocument !== false) {
    throw new Error("Application loaded-host proof must not mutate the host document or workspace.");
  }

  validateCommandIds(proof, config);
  validateCommandResults(proof, config);
  validateTargetProof(proof);

  return proof;
}

function validateTargetProof(proof: ApplicationLoadedHostProof): void {
  if (proof.target === "zed") {
    validateZedDevExtensionProof(proof);
    return;
  }

  if (proof.target === "blender") {
    requireExtensionId(proof, "dx_blender_command_center", "Blender add-on module");
    requireTrue(proof.addonInstalled, "Blender add-on installed proof");
    return;
  }

  if (proof.target === "obsidian") {
    requireExtensionId(proof, "dx-command-center", "Obsidian plugin id");
    requireTrue(proof.extensionLoaded, "Obsidian test-vault plugin loaded proof");
    return;
  }

  if (proof.target === "canva") {
    requireTrue(proof.developmentAppVerified, "Canva development app proof");
    requireTrue(proof.runtimePermissionsEmpty, "Canva runtime permission proof");
    return;
  }

  requireExtensionId(proof, "dev.dx.sketch.command-center", "Sketch plugin identifier");
  requireTrue(proof.extensionLoaded, "Sketch plugin loaded proof");

  if (typeof proof.sketchtoolVerified !== "boolean") {
    throw new Error("Sketch loaded-host proof must explicitly state sketchtool verification.");
  }

  if (proof.sketchtoolVerified === true) {
    assertExistingAbsoluteFile(proof.sketchtoolPath, "sketchtool executable");
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
      throw new Error(`Application loaded-host proof contains privacy-sensitive application loaded-host proof field: ${key}`);
    }

    rejectPrivacySensitiveKeys(child);
  }
}

function rejectUnexpectedProofKeys(proof: Record<string, unknown>): void {
  for (const key of Object.keys(proof)) {
    if (!proofKeys.has(key)) {
      throw new Error(`Unexpected application loaded-host proof field: ${key}`);
    }
  }
}

function validateCommandIds(
  proof: ApplicationLoadedHostProof,
  config: ApplicationLoadedHostAdapterConfig
): void {
  if (config.requiredCommandIds.length === 0) {
    if (!Array.isArray(proof.commandIdsVisible) || proof.commandIdsVisible.length !== 0) {
      throw new Error("Application loaded-host proof for Zed must not rely on slash-command metadata.");
    }

    return;
  }

  const visible = new Set(proof.commandIdsVisible);

  for (const commandId of config.requiredCommandIds) {
    if (!visible.has(commandId)) {
      throw new Error(`Application loaded-host proof must include visible command metadata for ${commandId}.`);
    }
  }

  for (const commandId of proof.commandIdsVisible) {
    if (!config.requiredCommandIds.includes(commandId)) {
      throw new Error(`Application loaded-host proof includes unsupported command metadata: ${commandId}.`);
    }
  }
}

function validateCommandResults(
  proof: ApplicationLoadedHostProof,
  config: ApplicationLoadedHostAdapterConfig
): void {
  if (config.requiredCommandIds.length === 0) {
    if (!Array.isArray(proof.commandResults) || proof.commandResults.length !== 0) {
      throw new Error("Application loaded-host proof for Zed must not rely on slash-command metadata.");
    }

    return;
  }

  if (!Array.isArray(proof.commandResults) || proof.commandResults.length === 0) {
    throw new Error("Application loaded-host proof must include command result metadata.");
  }

  const resultCommands = new Set<string>();

  for (const result of proof.commandResults) {
    if (!isRecord(result)) {
      throw new Error("Application loaded-host command result must be an object.");
    }

    for (const key of Object.keys(result)) {
      if (!commandResultKeys.has(key)) {
        throw new Error(`Application loaded-host command result contains an unsupported field: ${key}`);
      }
    }

    if (!config.requiredCommandIds.includes(result.commandId)) {
      throw new Error(`Application loaded-host command result uses unsupported command: ${result.commandId}`);
    }

    if (result.status !== "proof-blocked" && result.status !== "visible") {
      throw new Error(`Unsupported application loaded-host command result status: ${result.status}`);
    }

    resultCommands.add(result.commandId);
  }

  for (const commandId of config.requiredCommandIds) {
    if (!resultCommands.has(commandId)) {
      throw new Error(`Application loaded-host proof must include command result metadata for ${commandId}.`);
    }
  }
}

function validateZedDevExtensionProof(proof: ApplicationLoadedHostProof): void {
  const zedProof = proof.zedDevExtension;

  if (!isRecord(zedProof)) {
    throw new Error("Application loaded-host proof must include Zed dev-extension proof.");
  }

  for (const key of Object.keys(zedProof)) {
    if (!zedDevExtensionKeys.has(key)) {
      throw new Error(`Unexpected Zed dev-extension proof field: ${key}`);
    }
  }

  assertExistingAbsoluteDirectory(zedProof.sourcePath, "Zed source extension directory");
  assertExistingAbsoluteDirectory(zedProof.installedPath, "Zed installed dev-extension directory");
  assertExistingAbsoluteFile(zedProof.extensionIndexPath, "Zed extension index");
  assertExistingAbsoluteFile(zedProof.hostLogPath, "Zed host log");
  assertExistingAbsoluteFile(zedProof.wasmArtifactPath, "Zed WebAssembly artifact");
  assertSha256(zedProof.hostExecutableSha256, "Zed host executable SHA-256");
  assertSha256(zedProof.wasmArtifactSha256, "Zed WebAssembly SHA-256");
  requireTrue(zedProof.installedPathLinksToSource, "Zed installed path links to the source extension");
  requireTrue(zedProof.extensionIndexContainsDevExtension, "Zed extension index contains the DX dev extension");
  requireTrue(zedProof.hostLogReferencesExtension, "Zed host log references the DX dev extension");

  if (sha256File(proof.hostExecutablePath) !== zedProof.hostExecutableSha256) {
    throw new Error("Application loaded-host proof Zed host executable hash mismatch.");
  }

  if (sha256File(zedProof.wasmArtifactPath) !== zedProof.wasmArtifactSha256) {
    throw new Error("Application loaded-host proof Zed WebAssembly hash mismatch.");
  }

  if (readZedPackageWasmSha256(proof.packageOutputReceiptPath) !== zedProof.wasmArtifactSha256) {
    throw new Error("Application loaded-host proof Zed WebAssembly hash must match the package-output receipt.");
  }

  const extensionIndexSource = readFileSync(zedProof.extensionIndexPath, "utf8");
  if (!extensionIndexSource.includes("dx-command-center")) {
    throw new Error("Application loaded-host proof Zed extension index must reference dx-command-center.");
  }

  const hostLogSource = readFileSync(zedProof.hostLogPath, "utf8");
  if (!hostLogSource.includes("dx-command-center")) {
    throw new Error("Application loaded-host proof Zed host log must reference dx-command-center.");
  }
}

function requireExtensionId(
  proof: ApplicationLoadedHostProof,
  expectedId: string,
  label: string
): void {
  if (proof.extensionId !== expectedId) {
    throw new Error(`Application loaded-host proof ${label} must be ${expectedId}.`);
  }
}

function requireTrue(value: unknown, label: string): void {
  if (value !== true) {
    throw new Error(`Application loaded-host proof must verify ${label}.`);
  }
}

function assertExistingAbsoluteFile(path: unknown, label: string): asserts path is string {
  if (typeof path !== "string" || !isAbsolute(path)) {
    throw new Error(`Application loaded-host proof ${label} must be an absolute path.`);
  }

  if (!existsSync(path)) {
    throw new Error(`Application loaded-host proof ${label} does not exist: ${path}`);
  }
}

function assertExistingAbsoluteDirectory(path: unknown, label: string): asserts path is string {
  if (typeof path !== "string" || !isAbsolute(path)) {
    throw new Error(`Application loaded-host proof ${label} must be an absolute path.`);
  }

  if (!existsSync(path) || !statSync(path).isDirectory()) {
    throw new Error(`Application loaded-host proof ${label} does not exist: ${path}`);
  }
}

function assertNonEmpty(value: string, label: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Application loaded-host proof ${label} is required.`);
  }
}

function assertSha256(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
    throw new Error(`Application loaded-host proof ${label} must be a SHA-256 hex digest.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readZedPackageWasmSha256(packageOutputReceiptPath: string): string {
  const receipt = JSON.parse(readFileSync(packageOutputReceiptPath, "utf8"));
  const webAssemblySha = receipt?.webAssembly?.sha256;

  if (typeof webAssemblySha === "string") {
    return webAssemblySha;
  }

  const files = receipt?.package?.files;
  const wasmFile = Array.isArray(files)
    ? files.find((file) => file?.relativePath === "extension.wasm")
    : undefined;
  const wasmSha = wasmFile?.sha256;

  if (typeof wasmSha !== "string") {
    throw new Error("Application loaded-host proof Zed package-output receipt is missing extension.wasm proof.");
  }

  return wasmSha;
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
