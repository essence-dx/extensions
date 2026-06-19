import { existsSync, statSync } from "node:fs";
import { extname, isAbsolute } from "node:path";

export type CreativeNativePluginHost = "premiere-pro" | "indesign";
export type CreativeNativePluginAdapterId =
  | "dx.premiere-pro.command-center"
  | "dx.indesign.command-center";
export type CreativeNativePluginKind = "host-native-plugin" | "uxp-native-bridge";
export type CreativeNativePluginBridgeMode = "metadata-command-bridge";

export interface CreativeNativeOrHybridPluginProof {
  adapterId: CreativeNativePluginAdapterId;
  host: CreativeNativePluginHost;
  loadedHostReceiptPath: string;
  packageOutputReceiptPath: string;
  proofFilePath: string;
  nativePluginArtifactPath: string;
  pluginKind: CreativeNativePluginKind;
  sdkName: string;
  sdkVersion: string;
  bridgeMode: CreativeNativePluginBridgeMode;
  loadedByHost: boolean;
  commandIdsVerified: string[];
  metadataOnly: boolean;
  storesHostPayloads: boolean;
  mutatesHostProject: boolean;
  mutatesHostDocument: boolean;
}

export interface CreativeNativeAdapterConfig {
  adapterId: CreativeNativePluginAdapterId;
  host: CreativeNativePluginHost;
  artifactExtensions: string[];
  commandIds: string[];
  sdkName: string;
}

const adapterConfigs: Record<CreativeNativePluginAdapterId, CreativeNativeAdapterConfig> = {
  "dx.premiere-pro.command-center": {
    adapterId: "dx.premiere-pro.command-center",
    artifactExtensions: [".prm"],
    commandIds: [
      "dx.premiere-pro.show_status",
      "dx.premiere-pro.search_media_assets",
      "dx.premiere-pro.show_receipts"
    ],
    host: "premiere-pro",
    sdkName: "Premiere Pro SDK"
  },
  "dx.indesign.command-center": {
    adapterId: "dx.indesign.command-center",
    artifactExtensions: [".idpln"],
    commandIds: [
      "dx.indesign.show_status",
      "dx.indesign.search_assets",
      "dx.indesign.show_receipts"
    ],
    host: "indesign",
    sdkName: "InDesign SDK"
  }
};
const proofKeys = new Set([
  "adapterId",
  "host",
  "loadedHostReceiptPath",
  "packageOutputReceiptPath",
  "proofFilePath",
  "nativePluginArtifactPath",
  "pluginKind",
  "sdkName",
  "sdkVersion",
  "bridgeMode",
  "loadedByHost",
  "commandIdsVerified",
  "metadataOnly",
  "storesHostPayloads",
  "mutatesHostProject",
  "mutatesHostDocument"
]);
const privacySensitiveProofKeys = new Set([
  "account",
  "apiKey",
  "assetName",
  "clipboard",
  "documentName",
  "documentText",
  "email",
  "fileContents",
  "filePath",
  "mediaItemName",
  "password",
  "projectName",
  "projectPath",
  "rawHostResponse",
  "secret",
  "selectionText",
  "sequenceName",
  "teamId",
  "timelineName",
  "token",
  "url",
  "userId"
]);

export function validateCreativeNativeOrHybridPluginProof(
  proof: CreativeNativeOrHybridPluginProof
): CreativeNativeOrHybridPluginProof {
  if (!isRecord(proof)) {
    throw new Error("Creative native/hybrid proof must be an object.");
  }

  rejectPrivacySensitiveKeys(proof);
  rejectUnexpectedProofKeys(proof);

  const config = resolveCreativeNativeAdapter(proof);

  assertExistingAbsoluteFile(proof.loadedHostReceiptPath, "loaded-host receipt");
  assertExistingAbsoluteFile(proof.packageOutputReceiptPath, "package-output receipt");
  assertExistingAbsoluteFile(proof.proofFilePath, "manual proof file");
  assertExistingAbsoluteFile(proof.nativePluginArtifactPath, "native plugin artifact");
  assertNativeArtifactExtension(proof.nativePluginArtifactPath, config);
  assertNonEmpty(proof.sdkVersion, "SDK version");

  if (proof.sdkName !== config.sdkName) {
    throw new Error(`Creative native/hybrid proof SDK must be ${config.sdkName}.`);
  }

  if (!["host-native-plugin", "uxp-native-bridge"].includes(proof.pluginKind)) {
    throw new Error("Creative native/hybrid proof plugin kind is unsupported.");
  }

  if (proof.bridgeMode !== "metadata-command-bridge") {
    throw new Error("Creative native/hybrid proof bridge mode must be metadata-command-bridge.");
  }

  if (proof.loadedByHost !== true) {
    throw new Error("Creative native/hybrid proof must verify the native or hybrid plugin is loaded by the host.");
  }

  if (proof.metadataOnly !== true) {
    throw new Error("Creative native/hybrid proof must verify metadata-only command handling.");
  }

  if (
    proof.storesHostPayloads !== false ||
    proof.mutatesHostProject !== false ||
    proof.mutatesHostDocument !== false
  ) {
    throw new Error("Creative native/hybrid proof must not store payloads or mutate host content.");
  }

  validateCommandIds(proof.commandIdsVerified, config);

  return proof;
}

export function resolveCreativeNativeAdapter(
  proof: Pick<CreativeNativeOrHybridPluginProof, "adapterId" | "host">
): CreativeNativeAdapterConfig {
  const config = adapterConfigs[proof.adapterId];

  if (!config) {
    throw new Error(`Creative native/hybrid proof adapter is unsupported: ${String(proof.adapterId)}`);
  }

  if (proof.host !== config.host) {
    throw new Error(`Creative native/hybrid proof host must be ${config.host}.`);
  }

  return config;
}

export function assertExistingAbsoluteFile(path: unknown, label: string): asserts path is string {
  if (typeof path !== "string" || !isAbsolute(path)) {
    throw new Error(`Creative native/hybrid proof ${label} must be an absolute path.`);
  }

  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new Error(`Creative native/hybrid proof ${label} does not exist: ${path}`);
  }
}

function assertNativeArtifactExtension(path: string, config: CreativeNativeAdapterConfig): void {
  const extension = extname(path).toLowerCase();

  if (!config.artifactExtensions.includes(extension)) {
    throw new Error(
      `Creative native/hybrid proof artifact for ${config.host} must use: ${config.artifactExtensions.join(", ")}`
    );
  }
}

function validateCommandIds(values: unknown, config: CreativeNativeAdapterConfig): void {
  if (!Array.isArray(values) || values.length === 0 || !values.every((value) => typeof value === "string")) {
    throw new Error("Creative native/hybrid proof must include verified command metadata.");
  }

  const verified = new Set(values);

  for (const commandId of config.commandIds) {
    if (!verified.has(commandId)) {
      throw new Error(`Creative native/hybrid proof must include verified command metadata for ${commandId}.`);
    }
  }

  for (const commandId of values) {
    if (!config.commandIds.includes(commandId)) {
      throw new Error(`Creative native/hybrid proof includes unsupported command metadata: ${commandId}`);
    }
  }
}

function rejectUnexpectedProofKeys(proof: Record<string, unknown>): void {
  for (const key of Object.keys(proof)) {
    if (!proofKeys.has(key)) {
      throw new Error(`Unexpected creative native/hybrid proof field: ${key}`);
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
      throw new Error(`Creative native/hybrid proof contains privacy-sensitive creative native/hybrid proof field: ${key}`);
    }

    rejectPrivacySensitiveKeys(child);
  }
}

function assertNonEmpty(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Creative native/hybrid proof ${label} is required.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
