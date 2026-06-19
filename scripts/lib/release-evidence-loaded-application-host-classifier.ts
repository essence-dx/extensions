import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import {
  applicationLoadedHostAdapterConfigs,
  type ApplicationLoadedHostAdapterConfig
} from "./application-loaded-host-model.ts";
import { expectedIdeGameEngineCommandResultFor } from "./ide-game-engine-command-result-semantics.ts";
import { defaultPlatformHostDiscoveryTargets } from "../platform-host-discovery-targets.ts";
import {
  type ReceiptRecord,
  hasCommandResults,
  hasManualProofLink,
  hasReleasePackageOutputLink,
  hasStringList,
  isAdapterId,
  isNonEmptyString,
  isRecord,
  isSha256,
  readRecordField
} from "./release-evidence-receipt-primitives.ts";
import {
  classifyCurrentSha256FileProofWeakness,
  classifyLinkedReceiptWeakness,
  classifyLinkedPackageOutputWeakness,
  classifyManualProofWeakness
} from "./release-evidence-linked-proof-freshness.ts";

const applicationLoadedHostConfigsByAdapterId = new Map(
  Object.values(applicationLoadedHostAdapterConfigs).map((config) => [config.adapterId, config])
);
const creativeLoadedHosts = new Set(["photoshop", "premiere-pro", "indesign", "davinci-resolve"]);
const creativeLoadedHostConfigs: Record<
  string,
  {
    adapterId: string;
    commandIds: string[];
    entrypointIds?: string[];
    hostApplication: string;
    manifestId?: string;
    verificationMode: string;
  }
> = {
  photoshop: {
    adapterId: "dx.photoshop.command-center",
    commandIds: [
      "dx.photoshop.show_status",
      "dx.photoshop.search_assets",
      "dx.photoshop.copy_receipts_path"
    ],
    entrypointIds: ["dxCommandCenterPanel", "dxShowReceipts", "dxShowStatus"],
    hostApplication: "Photoshop",
    manifestId: "dx.photoshop.command-center.development",
    verificationMode: "uxp-developer-tool"
  },
  "premiere-pro": {
    adapterId: "dx.premiere-pro.command-center",
    commandIds: [
      "dx.premiere-pro.show_status",
      "dx.premiere-pro.search_media_assets",
      "dx.premiere-pro.show_receipts"
    ],
    entrypointIds: ["dxCommandCenterPanel", "dxShowReceipts", "dxShowStatus"],
    hostApplication: "Premiere Pro",
    manifestId: "dx.premiere-pro.command-center.development",
    verificationMode: "uxp-developer-tool"
  },
  indesign: {
    adapterId: "dx.indesign.command-center",
    commandIds: [
      "dx.indesign.show_status",
      "dx.indesign.search_assets",
      "dx.indesign.show_receipts"
    ],
    entrypointIds: ["dxCommandCenterPanel", "dxShowReceipts", "dxShowStatus"],
    hostApplication: "InDesign",
    manifestId: "dx.indesign.command-center.development",
    verificationMode: "uxp-developer-tool"
  },
  "davinci-resolve": {
    adapterId: "dx.davinci-resolve.command-center",
    commandIds: [
      "dx.davinci-resolve.show_status",
      "dx.davinci-resolve.inspect_project",
      "dx.davinci-resolve.show_receipts"
    ],
    hostApplication: "DaVinci Resolve",
    verificationMode: "resolve-scripting"
  }
};
const figmaCommandIds = [
  "dx.figma.show_status",
  "dx.figma.search_assets",
  "dx.figma.copy_receipts_path"
];
const figmaMenuCommands = ["show-status", "search-assets", "copy-receipts-path"];
const ideGameEngineLoadedHosts = new Set([
  "intellij-platform",
  "visual-studio",
  "unity-editor",
  "unreal-engine"
]);
const ideGameEngineLoadedHostConfigs: Record<
  string,
  {
    adapterId: string;
    commandIds: string[];
    hostApplication: string;
    hostToolId: string;
    verificationMode: string;
  }
> = {
  "intellij-platform": {
    adapterId: "dx.intellij-platform.command-center",
    commandIds: [
      "dx.intellij-platform.show_status",
      "dx.intellij-platform.search_assets",
      "dx.intellij-platform.show_receipts"
    ],
    hostApplication: "IntelliJ IDEA",
    hostToolId: "idea",
    verificationMode: "sandbox-ide"
  },
  "visual-studio": {
    adapterId: "dx.visual-studio.command-center",
    commandIds: [
      "dx.visual-studio.show_status",
      "dx.visual-studio.search_assets",
      "dx.visual-studio.show_receipts"
    ],
    hostApplication: "Visual Studio",
    hostToolId: "devenv",
    verificationMode: "experimental-instance"
  },
  "unity-editor": {
    adapterId: "dx.unity-editor.command-center",
    commandIds: [
      "dx.unity-editor.show_status",
      "dx.unity-editor.search_assets",
      "dx.unity-editor.show_receipts"
    ],
    hostApplication: "Unity Editor",
    hostToolId: "unity-editor",
    verificationMode: "loaded-editor"
  },
  "unreal-engine": {
    adapterId: "dx.unreal-engine.command-center",
    commandIds: [
      "dx.unreal-engine.show_status",
      "dx.unreal-engine.search_assets",
      "dx.unreal-engine.show_receipts"
    ],
    hostApplication: "Unreal Editor",
    hostToolId: "unreal-editor",
    verificationMode: "loaded-editor"
  }
};

export function classifyApplicationLoadedHostWeakness(receipt: ReceiptRecord): string | undefined {
  const config = applicationLoadedHostConfigsByAdapterId.get(String(receipt.adapterId));

  if (!isAdapterId(receipt.adapterId) || !config || receipt.host !== config.target) {
    return "application loaded-host receipt is missing adapter or host identity";
  }

  const weakness = classifyCommonLoadedHostWeakness(receipt, "loadedHostVerified", {
    commandMetadataRequired: config.requiredCommandIds.length > 0
  });

  if (weakness) {
    return `application ${weakness}`;
  }

  const packageOutputWeakness = classifyLinkedPackageOutputWeakness(receipt, "application loaded-host");

  if (packageOutputWeakness) {
    return packageOutputWeakness;
  }

  const manualProofWeakness = classifyManualProofWeakness(receipt, "application loaded-host");

  if (manualProofWeakness) {
    return manualProofWeakness;
  }

  const loadedHost = readRecordField(receipt, "loadedHost");
  const hostApplication = readRecordField(receipt, "hostApplication");

  if (
    hostApplication?.name !== config.hostApplication ||
    hostApplication.verificationMode !== config.verificationMode ||
    !["loaded", "empty", "unavailable"].includes(String(hostApplication.hostState))
  ) {
    return "application loaded-host receipt has the wrong host application or verification mode";
  }

  if (hostApplication.hostState !== "loaded") {
    return "application loaded-host receipt must verify a loaded host state";
  }

  const executableWeakness = classifyLoadedHostExecutableWeakness("application loaded-host", hostApplication);

  if (executableWeakness) {
    return executableWeakness;
  }

  if (loadedHost?.extensionInstalled !== true || loadedHost.mutatesHostDocument !== false) {
    return "application loaded-host receipt does not prove a safe installed extension";
  }

  const commandWeakness = classifyApplicationLoadedHostCommandWeakness(loadedHost, config);

  if (commandWeakness) {
    return commandWeakness;
  }

  if (config.target === "zed") {
    return classifyZedLoadedHostWeakness(receipt);
  }

  return classifyApplicationTargetProofWeakness(receipt, config);
}

function classifyApplicationLoadedHostCommandWeakness(
  loadedHost: ReceiptRecord | undefined,
  config: ApplicationLoadedHostAdapterConfig
): string | undefined {
  if (config.requiredCommandIds.length === 0) {
    const commandIdsVisible = Array.isArray(loadedHost?.commandIdsVisible) ? loadedHost.commandIdsVisible : [];
    const commandResults = Array.isArray(loadedHost?.commandResults) ? loadedHost.commandResults : [];

    return commandIdsVisible.length === 0 && commandResults.length === 0
      ? undefined
      : "application loaded-host receipt must not rely on command metadata";
  }

  if (!hasExactStringSet(loadedHost?.commandIdsVisible, config.requiredCommandIds)) {
    return "application loaded-host receipt is missing expected command IDs";
  }

  if (!hasLoadedHostCommandResults(loadedHost?.commandResults, config.requiredCommandIds)) {
    return "application loaded-host receipt has unsupported command results";
  }

  return undefined;
}

function classifyApplicationTargetProofWeakness(
  receipt: ReceiptRecord,
  config: ApplicationLoadedHostAdapterConfig
): string | undefined {
  if (config.target === "blender") {
    const blender = readRecordField(receipt, "blender");

    return blender?.addonModule === "dx_blender_command_center" && blender.addonInstalled === true
      ? undefined
      : "application loaded-host receipt is missing Blender add-on proof";
  }

  if (config.target === "obsidian") {
    const obsidian = readRecordField(receipt, "obsidian");

    return obsidian?.pluginId === "dx-command-center" && obsidian.testVaultLoaded === true
      ? undefined
      : "application loaded-host receipt is missing Obsidian test-vault proof";
  }

  if (config.target === "canva") {
    const canva = readRecordField(receipt, "canva");

    return canva?.developmentAppVerified === true && canva.runtimePermissionsEmpty === true
      ? undefined
      : "application loaded-host receipt is missing Canva development-app proof";
  }

  if (config.target === "sketch") {
    const sketch = readRecordField(receipt, "sketch");

    return sketch?.pluginIdentifier === "dev.dx.sketch.command-center" &&
      sketch.pluginLoaded === true &&
      typeof sketch.sketchtoolVerified === "boolean"
      ? undefined
      : "application loaded-host receipt is missing Sketch plugin proof";
  }

  return undefined;
}

export function classifyCreativeLoadedHostWeakness(receipt: ReceiptRecord): string | undefined {
  const host = String(receipt.host);
  const config = creativeLoadedHostConfigs[host];

  if (!isAdapterId(receipt.adapterId) || !creativeLoadedHosts.has(host) || !config) {
    return "creative loaded-host receipt is missing adapter or host identity";
  }

  if (receipt.adapterId !== config.adapterId) {
    return "creative loaded-host receipt does not match the expected adapter id";
  }

  const weakness = classifyCommonLoadedHostWeakness(receipt, "loadedHostVerified");

  if (weakness) {
    return `creative ${weakness}`;
  }

  const packageOutputWeakness = classifyLinkedPackageOutputWeakness(receipt, "creative loaded-host");

  if (packageOutputWeakness) {
    return packageOutputWeakness;
  }

  const manualProofWeakness = classifyManualProofWeakness(receipt, "creative loaded-host");

  if (manualProofWeakness) {
    return manualProofWeakness;
  }

  const hostApplication = readRecordField(receipt, "hostApplication");
  const loadedHost = readRecordField(receipt, "loadedHost");

  if (
    hostApplication?.name !== config.hostApplication ||
    hostApplication.verificationMode !== config.verificationMode ||
    !["loaded", "empty", "unavailable"].includes(String(hostApplication.hostState))
  ) {
    return "creative loaded-host receipt has the wrong host application or verification mode";
  }

  if (hostApplication.hostState !== "loaded") {
    return "creative loaded-host receipt must verify a loaded host state";
  }

  const executableWeakness = classifyLoadedHostExecutableWeakness("creative loaded-host", hostApplication);

  if (executableWeakness) {
    return executableWeakness;
  }

  if (!hasExactStringSet(loadedHost?.commandIdsVisible, config.commandIds)) {
    return "creative loaded-host receipt is missing expected command IDs";
  }

  if (!hasLoadedHostCommandResults(loadedHost?.commandResults, config.commandIds)) {
    return "creative loaded-host receipt has unsupported command results";
  }

  if (host === "davinci-resolve") {
    return classifyDavinciResolveLoadedHostWeakness(receipt);
  }

  return classifyAdobeUxpLoadedHostWeakness(receipt, config);
}

export function classifyFigmaLoadedHostWeakness(receipt: ReceiptRecord): string | undefined {
  if (receipt.adapterId !== "dx.figma.command-center" || receipt.host !== "figma") {
    return "Figma loaded-host receipt is missing adapter or host identity";
  }

  const weakness = classifyCommonLoadedHostWeakness(receipt, "loadedHostVerified");

  if (weakness) {
    return `Figma ${weakness}`;
  }

  const packageOutputWeakness = classifyLinkedPackageOutputWeakness(receipt, "Figma loaded-host");

  if (packageOutputWeakness) {
    return packageOutputWeakness;
  }

  const manualProofWeakness = classifyManualProofWeakness(receipt, "Figma loaded-host");

  if (manualProofWeakness) {
    return manualProofWeakness;
  }

  const loadedHost = readRecordField(receipt, "loadedHost");
  const hostApplication = readRecordField(receipt, "hostApplication");

  if (
    hostApplication?.name !== "Figma" ||
    hostApplication.verificationMode !== "figma-desktop-plugin"
  ) {
    return "Figma loaded-host receipt has the wrong host application or verification mode";
  }

  if (hostApplication.fileState !== "test-file") {
    return "Figma loaded-host receipt must verify a loaded test file";
  }

  const executableWeakness = classifyLoadedHostExecutableWeakness("Figma loaded-host", hostApplication);

  if (executableWeakness) {
    return executableWeakness;
  }

  if (
    loadedHost?.pluginUiRendered !== true ||
    loadedHost.networkAccessRestricted !== true ||
    loadedHost.mutatesFigmaFile !== false ||
    loadedHost.storesFigmaPayloads !== false ||
    !hasStringList(loadedHost.menuCommandsVisible)
  ) {
    return "Figma loaded-host receipt is missing safe plugin UI proof";
  }

  if (!hasExactStringSet(loadedHost.commandIdsVisible, figmaCommandIds)) {
    return "Figma loaded-host receipt is missing expected command IDs";
  }

  if (!hasExactStringSet(loadedHost.menuCommandsVisible, figmaMenuCommands)) {
    return "Figma loaded-host receipt is missing expected menu commands";
  }

  if (!hasLoadedHostCommandResults(loadedHost.commandResults, figmaCommandIds)) {
    return "Figma loaded-host receipt has unsupported command results";
  }

  return undefined;
}

export function classifyIdeGameEngineLoadedHostWeakness(receipt: ReceiptRecord): string | undefined {
  const host = String(receipt.host);
  const config = ideGameEngineLoadedHostConfigs[host];

  if (!isAdapterId(receipt.adapterId) || !ideGameEngineLoadedHosts.has(host) || !config) {
    return "IDE/game-engine loaded-host receipt is missing adapter or host identity";
  }

  if (receipt.adapterId !== config.adapterId) {
    return "IDE/game-engine loaded-host receipt does not match the expected adapter id";
  }

  const weakness = classifyCommonLoadedHostWeakness(receipt, "loadedHostVerified");

  if (weakness) {
    return `IDE/game-engine ${weakness}`;
  }

  const packageOutputWeakness = classifyLinkedPackageOutputWeakness(receipt, "IDE/game-engine loaded-host");

  if (packageOutputWeakness) {
    return packageOutputWeakness;
  }

  const manualProofWeakness = classifyManualProofWeakness(receipt, "IDE/game-engine loaded-host");

  if (manualProofWeakness) {
    return manualProofWeakness;
  }

  const hostApplication = readRecordField(receipt, "hostApplication");
  const loadedHost = readRecordField(receipt, "loadedHost");

  if (
    hostApplication?.name !== config.hostApplication ||
    !isNonEmptyString(hostApplication.executablePath) ||
    hostApplication.verificationMode !== config.verificationMode ||
    !["loaded", "empty", "unavailable"].includes(String(hostApplication.projectState))
  ) {
    return "IDE/game-engine loaded-host receipt has the wrong host application or verification mode";
  }

  if (hostApplication.projectState !== "loaded") {
    return "IDE/game-engine loaded-host receipt must verify a loaded project state";
  }

  const hostDiscoveryWeakness = classifyIdeGameEngineHostDiscoveryWeakness(
    receipt,
    config,
    hostApplication.executablePath
  );

  if (hostDiscoveryWeakness) {
    return hostDiscoveryWeakness;
  }

  if (loadedHost?.extensionInstalled !== true) {
    return "IDE/game-engine loaded-host receipt does not prove the extension is installed";
  }

  if (!hasExactStringSet(loadedHost.commandIdsVisible, config.commandIds)) {
    return "IDE/game-engine loaded-host receipt is missing expected command IDs";
  }

  if (!hasIdeGameEngineCommandResults(loadedHost.commandResults, config.commandIds)) {
    return "IDE/game-engine loaded-host receipt has unsupported command result semantics";
  }

  return undefined;
}

function classifyIdeGameEngineHostDiscoveryWeakness(
  receipt: ReceiptRecord,
  config: (typeof ideGameEngineLoadedHostConfigs)[string],
  hostExecutablePath: string
): string | undefined {
  const hostDiscovery = readRecordField(receipt, "hostDiscovery");

  if (
    !isNonEmptyString(hostDiscovery?.receiptPath) ||
    !isSha256(hostDiscovery.receiptSha256) ||
    hostDiscovery.toolId !== config.hostToolId ||
    hostDiscovery.toolPath !== hostExecutablePath ||
    !isSha256(hostDiscovery.executableSha256)
  ) {
    return "IDE/game-engine loaded-host receipt is missing host-discovery linkage";
  }

  const linkWeakness = classifyLinkedReceiptWeakness(
    hostDiscovery,
    "IDE/game-engine loaded-host host-discovery"
  );

  if (linkWeakness) {
    return linkWeakness;
  }

  if (!existsSync(hostExecutablePath)) {
    return "IDE/game-engine loaded-host host executable does not exist";
  }

  if (sha256(readFileSync(hostExecutablePath)) !== hostDiscovery.executableSha256) {
    return "IDE/game-engine loaded-host host executable hash changed";
  }

  let hostDiscoveryReceipt: unknown;

  try {
    hostDiscoveryReceipt = JSON.parse(readFileSync(hostDiscovery.receiptPath, "utf8"));
  } catch {
    return "IDE/game-engine loaded-host host-discovery receipt is not readable JSON";
  }

  if (
    !isRecord(hostDiscoveryReceipt) ||
    hostDiscoveryReceipt.receipt !== "dx.extension.platform_host_discovery" ||
    hostDiscoveryReceipt.adapterId !== config.adapterId ||
    hostDiscoveryReceipt.host !== receipt.host ||
    hostDiscoveryReceipt.status !== "candidate-found" ||
    hostDiscoveryReceipt.candidateFound !== true
  ) {
    return "IDE/game-engine loaded-host host-discovery receipt is invalid";
  }

  const missingRequiredTools = readStringList(hostDiscoveryReceipt.missingRequiredTools);

  if (missingRequiredTools.length > 0) {
    return `IDE/game-engine loaded-host host-discovery receipt contradicts missing required tools: ${missingRequiredTools.join(", ")}`;
  }

  const tools = Array.isArray(hostDiscoveryReceipt.tools) ? hostDiscoveryReceipt.tools.filter(isRecord) : [];
  const hostTool = tools.find((tool) => tool.id === config.hostToolId);

  if (!hostTool || hostTool.found !== true || hostTool.path !== hostExecutablePath) {
    return "IDE/game-engine loaded-host host-discovery receipt does not match the host executable";
  }

  const requiredToolWeakness = classifyRequiredHostDiscoveryToolWeakness(
    config,
    hostDiscovery,
    tools,
    hostExecutablePath
  );

  if (requiredToolWeakness) {
    return requiredToolWeakness;
  }

  return undefined;
}

function classifyRequiredHostDiscoveryToolWeakness(
  config: (typeof ideGameEngineLoadedHostConfigs)[string],
  hostDiscovery: ReceiptRecord,
  tools: ReceiptRecord[],
  hostExecutablePath: string
): string | undefined {
  const requiredToolIds = requiredHostDiscoveryToolIds(config.adapterId);
  const linkedTools = Array.isArray(hostDiscovery.requiredTools)
    ? hostDiscovery.requiredTools.filter(isRecord)
    : [];

  for (const toolId of requiredToolIds) {
    const discoveredTool = tools.find((tool) => tool.id === toolId);

    if (!discoveredTool || discoveredTool.found !== true || !isNonEmptyString(discoveredTool.path)) {
      return `IDE/game-engine loaded-host host-discovery receipt is missing required host-discovery tool: ${toolId}`;
    }

    const linkedTool = linkedTools.find((tool) => tool.id === toolId);

    if (!linkedTool || linkedTool.path !== discoveredTool.path || !isSha256(linkedTool.sha256)) {
      return `IDE/game-engine loaded-host receipt is missing required host-discovery tool linkage: ${toolId}`;
    }

    if (toolId === config.hostToolId && linkedTool.path !== hostExecutablePath) {
      return "IDE/game-engine loaded-host host-discovery receipt does not match the host executable";
    }

    if (!existsSync(linkedTool.path)) {
      return `IDE/game-engine loaded-host required host-discovery tool does not exist: ${toolId}`;
    }

    if (sha256(readFileSync(linkedTool.path)) !== linkedTool.sha256) {
      return `IDE/game-engine loaded-host required host-discovery tool hash changed: ${toolId}`;
    }
  }

  return undefined;
}

function requiredHostDiscoveryToolIds(adapterId: string): string[] {
  const target = defaultPlatformHostDiscoveryTargets.find((candidate) => candidate.adapterId === adapterId);

  return target?.tools
    .filter((tool) => tool.required)
    .map((tool) => tool.id) ?? [];
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function readStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "")
    : [];
}

function classifyDavinciResolveLoadedHostWeakness(receipt: ReceiptRecord): string | undefined {
  const resolveProof = readRecordField(receipt, "davinciResolve");

  if (
    resolveProof?.loadedResolveVerified !== true ||
    !["python", "lua"].includes(String(resolveProof.scriptLanguage)) ||
    resolveProof.scriptLoadedInResolve !== true ||
    resolveProof.mutatesResolveProject !== false ||
    typeof resolveProof.readOnlyProjectMetadataVerified !== "boolean" ||
    typeof resolveProof.workflowIntegrationVerified !== "boolean"
  ) {
    return "DaVinci Resolve loaded-host receipt is missing read-only scripting proof";
  }

  if (resolveProof.workflowIntegrationVerified === true && resolveProof.readOnlyProjectMetadataVerified !== true) {
    return "DaVinci Resolve loaded-host receipt verifies workflow integration without read-only metadata proof";
  }

  return undefined;
}

function classifyAdobeUxpLoadedHostWeakness(
  receipt: ReceiptRecord,
  config: (typeof creativeLoadedHostConfigs)[string]
): string | undefined {
  const adobeUxp = readRecordField(receipt, "adobeUxp");

  if (
    adobeUxp?.developerToolVerified !== true ||
    adobeUxp.pluginLoaded !== true ||
    adobeUxp.panelRendered !== true ||
    !isNonEmptyString(adobeUxp.uxpDeveloperToolPath) ||
    adobeUxp.uxpManifestId !== config.manifestId ||
    !hasExactStringSet(adobeUxp.entrypointsVisible, config.entrypointIds ?? [])
  ) {
    return "Adobe UXP loaded-host receipt is missing Developer Tool or rendered-panel proof";
  }

  return undefined;
}

function classifyZedLoadedHostWeakness(receipt: ReceiptRecord): string | undefined {
  const zed = readRecordField(receipt, "zed");

  if (
    zed?.extensionId !== "dx-command-center" ||
    zed.devExtensionLoaded !== true ||
    zed.installedPathLinksToSource !== true ||
    zed.extensionIndexContainsDevExtension !== true ||
    zed.hostLogReferencesExtension !== true ||
    !isNonEmptyString(zed.sourcePath) ||
    !isNonEmptyString(zed.installedPath) ||
    !isNonEmptyString(zed.extensionIndexPath) ||
    !isNonEmptyString(zed.hostLogPath) ||
    !isNonEmptyString(zed.wasmArtifactPath) ||
    !isSha256(zed.extensionIndexSha256) ||
    !isSha256(zed.hostLogSha256) ||
    !isSha256(zed.wasmArtifactSha256) ||
    !isSha256(zed.hostExecutableSha256)
  ) {
    return "Zed loaded-host receipt is missing dev-extension install, index, log, or WebAssembly proof";
  }

  const extensionIndexWeakness = classifyCurrentSha256FileProofWeakness(
    zed.extensionIndexPath,
    zed.extensionIndexSha256,
    "Zed loaded-host extension index"
  );

  if (extensionIndexWeakness) {
    return extensionIndexWeakness;
  }

  const hostLogWeakness = classifyCurrentSha256FileProofWeakness(
    zed.hostLogPath,
    zed.hostLogSha256,
    "Zed loaded-host host log"
  );

  if (hostLogWeakness) {
    return hostLogWeakness;
  }

  const wasmArtifactWeakness = classifyCurrentSha256FileProofWeakness(
    zed.wasmArtifactPath,
    zed.wasmArtifactSha256,
    "Zed loaded-host WebAssembly artifact"
  );

  if (wasmArtifactWeakness) {
    return wasmArtifactWeakness;
  }

  const linkedPackageOutput = readLinkedPackageOutputReceipt(receipt);
  const webAssembly = typeof linkedPackageOutput === "string"
    ? undefined
    : readRecordField(linkedPackageOutput, "webAssembly");

  if (typeof linkedPackageOutput === "string") {
    return linkedPackageOutput;
  }

  if (webAssembly?.sha256 !== zed.wasmArtifactSha256) {
    return "Zed loaded-host WebAssembly hash does not match linked package-output receipt";
  }

  return undefined;
}

function readLinkedPackageOutputReceipt(receipt: ReceiptRecord): ReceiptRecord | string {
  const packageOutput = readRecordField(receipt, "packageOutput");

  if (!isNonEmptyString(packageOutput?.receiptPath)) {
    return "Zed loaded-host receipt is missing linked package-output path";
  }

  try {
    const parsedReceipt = JSON.parse(readFileSync(packageOutput.receiptPath, "utf8"));

    return isRecord(parsedReceipt)
      ? parsedReceipt
      : "Zed loaded-host linked package-output receipt is not a JSON object";
  } catch {
    return "Zed loaded-host linked package-output receipt is not readable JSON";
  }
}

function classifyCommonLoadedHostWeakness(
  receipt: ReceiptRecord,
  releaseClaim: string,
  options: { commandMetadataRequired?: boolean } = {}
): string | undefined {
  const releaseClaims = readRecordField(receipt, "releaseClaims");

  if (releaseClaims?.[releaseClaim] !== true) {
    return "loaded-host receipt does not verify loaded-host execution";
  }

  if (!hasReleasePackageOutputLink(receipt)) {
    return "loaded-host receipt is missing package-output linkage";
  }

  if (!hasManualProofLink(receipt)) {
    return "loaded-host receipt is missing manual-proof linkage";
  }

  const hostApplication = readRecordField(receipt, "hostApplication");
  const loadedHost = readRecordField(receipt, "loadedHost");

  if (!isNonEmptyString(hostApplication?.name) || !isNonEmptyString(hostApplication.version)) {
    return "loaded-host receipt is missing host application proof";
  }

  if (loadedHost?.localServiceRequestsBlocked !== true) {
    return "loaded-host receipt is missing local-service safety proof";
  }

  if (
    options.commandMetadataRequired !== false &&
    (!hasStringList(loadedHost.commandIdsVisible) || !hasCommandResults(loadedHost.commandResults))
  ) {
    return "loaded-host receipt is missing command visibility or local-service safety proof";
  }

  return undefined;
}

function classifyLoadedHostExecutableWeakness(
  label: string,
  hostApplication: ReceiptRecord
): string | undefined {
  if (
    !isNonEmptyString(hostApplication.executablePath) ||
    !isSha256(hostApplication.executableSha256)
  ) {
    return `${label} receipt is missing host executable linkage`;
  }

  if (!existsSync(hostApplication.executablePath)) {
    return `${label} host executable does not exist`;
  }

  if (sha256(readFileSync(hostApplication.executablePath)) !== hostApplication.executableSha256) {
    return `${label} host executable hash changed`;
  }

  return undefined;
}

function hasExactStringSet(value: unknown, expectedValues: string[]): boolean {
  if (!hasStringList(value)) {
    return false;
  }

  const values = value as string[];
  const uniqueValues = new Set(values);

  if (uniqueValues.size !== expectedValues.length) {
    return false;
  }

  return expectedValues.every((expectedValue) => uniqueValues.has(expectedValue));
}

function hasLoadedHostCommandResults(value: unknown, expectedCommandIds: string[]): boolean {
  if (!Array.isArray(value)) {
    return false;
  }

  const results = value.filter((item): item is ReceiptRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item));
  const resultCommandIds = new Set<string>();

  if (results.length !== expectedCommandIds.length) {
    return false;
  }

  for (const result of results) {
    if (
      !isNonEmptyString(result.commandId) ||
      !expectedCommandIds.includes(result.commandId) ||
      !["proof-blocked", "visible"].includes(String(result.status))
    ) {
      return false;
    }

    resultCommandIds.add(result.commandId);
  }

  return expectedCommandIds.every((commandId) => resultCommandIds.has(commandId));
}

function hasIdeGameEngineCommandResults(value: unknown, expectedCommandIds: string[]): boolean {
  if (!Array.isArray(value)) {
    return false;
  }

  const results = value.filter((item): item is ReceiptRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item));
  const resultCommandIds = new Set<string>();

  if (results.length !== expectedCommandIds.length) {
    return false;
  }

  for (const result of results) {
    const expectedCommandResult = isNonEmptyString(result.commandId)
      ? expectedIdeGameEngineCommandResultFor(result.commandId)
      : undefined;

    if (
      !isNonEmptyString(result.commandId) ||
      !expectedCommandIds.includes(result.commandId) ||
      !expectedCommandResult ||
      result.operation !== expectedCommandResult.operation ||
      result.transport !== expectedCommandResult.transport ||
      result.status !== expectedCommandResult.status
    ) {
      return false;
    }

    resultCommandIds.add(result.commandId);
  }

  return expectedCommandIds.every((commandId) => resultCommandIds.has(commandId));
}
