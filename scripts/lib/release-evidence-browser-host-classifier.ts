import { readFileSync } from "node:fs";
import { isAbsolute, join, normalize, sep } from "node:path";

import {
  type ReceiptRecord,
  hasReleasePackageOutputLink,
  hasReceiptShaLink,
  hasStringList,
  isNonEmptyString,
  isSha256,
  readRecordArray,
  readRecordField
} from "./release-evidence-receipt-primitives.ts";
import {
  classifyLinkedPackageOutputWeakness,
  classifyLinkedReceiptWeakness
} from "./release-evidence-linked-proof-freshness.ts";

const browserRoundTripCommands = new Set(["forgePackages", "showBuildGraph", "status"]);
const browserTargets = new Set(["chrome", "edge", "firefox"]);
const browserRoundTripActions: Record<
  string,
  {
    hostActionId: string;
    operation: string;
    runtimePlanId: string;
  }
> = {
  forgePackages: {
    hostActionId: "dx.browser.list_forge_packages",
    operation: "dx.forge.packages.list",
    runtimePlanId: "forgePackages"
  },
  showBuildGraph: {
    hostActionId: "dx.browser.show_build_graph",
    operation: "dx.graph.read",
    runtimePlanId: "showBuildGraph"
  },
  status: {
    hostActionId: "dx.browser.show_status",
    operation: "dx.status",
    runtimePlanId: "status"
  }
};

export function classifyVsCodeLoadedHostWeakness(receipt: ReceiptRecord): string | undefined {
  if (
    receipt.adapterId !== "dx.vscode.command-center" ||
    !isNonEmptyString(receipt.extension_id) ||
    receipt.loaded_host !== "vscode" ||
    receipt.workspace_kind !== "temporary"
  ) {
    return "VS Code loaded-host smoke receipt is missing adapter, extension, or workspace identity";
  }

  if (!Number.isSafeInteger(receipt.command_count) || receipt.command_count <= 0) {
    return "VS Code loaded-host smoke receipt is missing command visibility proof";
  }

  const packageOutput = readRecordField(receipt, "packageOutput");

  if (!hasReleasePackageOutputLink(receipt) || !isSha256(packageOutput?.vsixSha256)) {
    return "VS Code loaded-host smoke receipt is missing package-output linkage";
  }

  const packageOutputWeakness = classifyVsCodeLoadedHostPackageOutputWeakness(
    receipt,
    packageOutput
  );

  if (packageOutputWeakness) {
    return packageOutputWeakness;
  }

  if (!hasStringList(receipt.commandIds) || receipt.commandIds.length !== receipt.command_count) {
    return "VS Code loaded-host smoke receipt is missing command ID proof";
  }

  if (receipt.status !== "passed" || receipt.stores_process_output !== false) {
    return "VS Code loaded-host smoke receipt does not prove a safe passed smoke run";
  }

  const releaseClaims = readRecordField(receipt, "releaseClaims");

  if (
    releaseClaims?.loadedExtensionHostVerified !== true ||
    releaseClaims.packageOutputVerified !== true ||
    releaseClaims.localServiceVerified !== false ||
    releaseClaims.signingVerified !== false ||
    releaseClaims.releaseChecksumVerified !== false ||
    releaseClaims.marketplaceReviewVerified !== false ||
    releaseClaims.distributionVerified !== false
  ) {
    return "VS Code loaded-host smoke receipt has incomplete release claims";
  }

  return undefined;
}

function classifyVsCodeLoadedHostPackageOutputWeakness(
  receipt: ReceiptRecord,
  packageOutput: ReceiptRecord | undefined
): string | undefined {
  const linkWeakness = classifyLinkedPackageOutputWeakness(receipt, "VS Code loaded-host");

  if (linkWeakness) {
    return linkWeakness;
  }

  let linkedReceipt: unknown;

  try {
    linkedReceipt = JSON.parse(readFileSync(String(packageOutput?.receiptPath), "utf8"));
  } catch {
    return "VS Code loaded-host linked package-output receipt is not readable JSON";
  }

  if (
    !isRecord(linkedReceipt) ||
    linkedReceipt.receipt !== "dx.extension.vscode.package_output" ||
    linkedReceipt.adapterId !== "dx.vscode.command-center" ||
    linkedReceipt.host !== "vscode"
  ) {
    return "VS Code loaded-host linked package-output receipt is not a VS Code package-output receipt";
  }

  const packageManifest = readRecordField(linkedReceipt, "packageManifest");
  const vsix = readRecordField(linkedReceipt, "vsix");

  if (
    !isNonEmptyString(packageManifest?.publisher) ||
    !isNonEmptyString(packageManifest.name) ||
    !Number.isSafeInteger(packageManifest.commandCount) ||
    packageManifest.commandCount <= 0
  ) {
    return "VS Code loaded-host linked package-output receipt is missing package manifest identity";
  }

  const packageExtensionId = `${packageManifest.publisher}.${packageManifest.name}`;

  if (packageExtensionId !== receipt.extension_id) {
    return "VS Code loaded-host linked package manifest identity changed";
  }

  if (packageManifest.commandCount !== receipt.command_count) {
    return "VS Code loaded-host linked package manifest command count changed";
  }

  if (vsix?.sha256 !== packageOutput?.vsixSha256) {
    return "VS Code loaded-host linked package-output VSIX hash changed";
  }

  return undefined;
}

export function classifyBrowserLoadedProfileWeakness(receipt: ReceiptRecord): string | undefined {
  if (
    receipt.adapterId !== "dx.browser.command-center" ||
    receipt.host !== "browser" ||
    !browserTargets.has(String(receipt.target))
  ) {
    return "browser loaded-profile receipt is missing adapter, host, or browser target identity";
  }

  const packageOutput = readRecordField(receipt, "packageOutput");

  if (!hasReceiptShaLink(packageOutput)) {
    return "browser loaded-profile receipt is missing package-output linkage";
  }

  const packageOutputWeakness = classifyLinkedReceiptWeakness(
    packageOutput,
    "browser loaded-profile package-output"
  );

  if (packageOutputWeakness) {
    return packageOutputWeakness;
  }

  const browser = readRecordField(receipt, "browser");
  const extension = readRecordField(receipt, "extension");
  const nativeHost = readRecordField(receipt, "nativeHost");
  const nativeHostPackage = readRecordField(receipt, "nativeHostPackage");
  const loadedProfile = readRecordField(receipt, "loadedProfile");

  if (
    !isNonEmptyString(browser?.executablePath) ||
    !isNonEmptyString(browser.version) ||
    !isNonEmptyString(extension?.id) ||
    !isNonEmptyString(extension.baseUrl) ||
    !isNonEmptyString(nativeHost?.name) ||
    !isNonEmptyString(nativeHost.manifestPath) ||
    nativeHost?.registered !== true
  ) {
    return "browser loaded-profile receipt is missing browser, extension, or native-host proof";
  }

  const nativeHostPackageWeakness = classifyBrowserLoadedProfileNativeHostPackageWeakness(
    receipt,
    nativeHostPackage,
    nativeHost
  );

  if (nativeHostPackageWeakness) {
    return nativeHostPackageWeakness;
  }

  if (loadedProfile?.backgroundServiceWorkerVerified !== true) {
    return "browser loaded-profile receipt does not verify the background service worker";
  }

  if (!hasStringList(loadedProfile.commandIds) || !hasStringList(loadedProfile.hostUiCommandIds)) {
    return "browser loaded-profile receipt is missing command visibility proof";
  }

  const roundTrips = readRecordArray(loadedProfile.nativeHostRoundTrips);
  const commandIds = new Set(roundTrips.map((roundTrip) => roundTrip.commandId));

  if (![...browserRoundTripCommands].every((commandId) => commandIds.has(commandId))) {
    return "browser loaded-profile receipt is missing required native-host round trips";
  }

  if (
    !roundTrips.every(
      (roundTrip) =>
        roundTrip.handledBy === "native-host" &&
        roundTrip.ok === true &&
        isSafeAdapterReceiptPath(roundTrip.receiptPath) &&
        isSha256(roundTrip.receiptSha256)
    )
  ) {
    return "browser loaded-profile receipt contains incomplete native-host round-trip proof";
  }

  for (const roundTrip of roundTrips) {
    const roundTripWeakness = classifyBrowserLoadedProfileNativeHostRoundTripWeakness(
      receipt,
      roundTrip
    );

    if (roundTripWeakness) {
      return roundTripWeakness;
    }
  }

  return undefined;
}

function classifyBrowserLoadedProfileNativeHostRoundTripWeakness(
  receipt: ReceiptRecord,
  roundTrip: ReceiptRecord
): string | undefined {
  const label = `browser loaded-profile native-host round-trip ${String(roundTrip.commandId)}`;
  const receiptPath = resolveLinkedRoundTripReceiptPath(receipt, String(roundTrip.receiptPath));
  const linkWeakness = classifyLinkedReceiptWeakness(
    {
      receiptPath,
      receiptSha256: roundTrip.receiptSha256
    },
    label
  );

  if (linkWeakness) {
    return linkWeakness;
  }

  let linkedReceipt: unknown;

  try {
    linkedReceipt = JSON.parse(readFileSync(receiptPath, "utf8"));
  } catch {
    return `${label} receipt is not readable JSON`;
  }

  if (
    !isRecord(linkedReceipt) ||
    linkedReceipt.receipt !== "dx.extension.host_action_index" ||
    linkedReceipt.adapterId !== "dx.browser.command-center" ||
    linkedReceipt.host !== "browser"
  ) {
    return `${label} receipt is not a browser host-action index receipt`;
  }

  return classifyBrowserLoadedProfileRoundTripActionWeakness(linkedReceipt, roundTrip, label);
}

function classifyBrowserLoadedProfileRoundTripActionWeakness(
  hostActionIndex: ReceiptRecord,
  roundTrip: ReceiptRecord,
  label: string
): string | undefined {
  const expectedAction = browserRoundTripActions[String(roundTrip.commandId)];

  if (!expectedAction || roundTrip.hostActionId !== expectedAction.hostActionId) {
    return `${label} receipt host action changed`;
  }

  if (hostActionIndex.runtimePlanParity !== true) {
    return `${label} host-action index does not prove runtime plan parity`;
  }

  const actions = readRecordArray(hostActionIndex.actions);
  const action = actions.find((entry) => entry.id === expectedAction.hostActionId);

  if (!action) {
    return `${label} host-action index is missing native-host action`;
  }

  if (
    action.runtimePlanId !== expectedAction.runtimePlanId ||
    action.operation !== expectedAction.operation ||
    action.transport !== "native-host"
  ) {
    return `${label} host-action index native-host action changed`;
  }

  return undefined;
}

function classifyBrowserLoadedProfileNativeHostPackageWeakness(
  receipt: ReceiptRecord,
  nativeHostPackage: ReceiptRecord | undefined,
  nativeHost: ReceiptRecord
): string | undefined {
  if (
    !hasReceiptShaLink(nativeHostPackage) ||
    nativeHostPackage.target !== receipt.target ||
    nativeHostPackage.manifestPath !== nativeHost.manifestPath ||
    !isSha256(nativeHostPackage.manifestSha256) ||
    !isSha256(nativeHostPackage.executableSha256)
  ) {
    return "browser loaded-profile receipt is missing native-host package linkage";
  }

  const linkWeakness = classifyLinkedReceiptWeakness(
    nativeHostPackage,
    "browser loaded-profile native-host package"
  );

  if (linkWeakness) {
    return linkWeakness;
  }

  let nativeHostPackageReceipt: unknown;

  try {
    nativeHostPackageReceipt = JSON.parse(readFileSync(nativeHostPackage.receiptPath, "utf8"));
  } catch {
    return "browser loaded-profile native-host package receipt is not readable JSON";
  }

  if (
    !isRecord(nativeHostPackageReceipt) ||
    nativeHostPackageReceipt.receipt !== "dx.extension.browser.native_host_package" ||
    nativeHostPackageReceipt.adapterId !== "dx.browser.command-center" ||
    nativeHostPackageReceipt.host !== "browser"
  ) {
    return "browser loaded-profile native-host package receipt is invalid";
  }

  const packageNativeHost = readRecordField(nativeHostPackageReceipt, "nativeHost");
  const executable = readRecordField(packageNativeHost, "executable");
  const manifests = Array.isArray(packageNativeHost?.manifests)
    ? packageNativeHost.manifests.filter(isRecord)
    : [];
  const manifest = manifests.find((entry) => entry.target === receipt.target);

  if (
    !manifest ||
    manifest.manifestPath !== nativeHostPackage.manifestPath ||
    manifest.sha256 !== nativeHostPackage.manifestSha256 ||
    manifest.name !== nativeHost.name ||
    executable?.sha256 !== nativeHostPackage.executableSha256
  ) {
    return "browser loaded-profile native-host package linkage changed";
  }

  return undefined;
}

function isRecord(value: unknown): value is ReceiptRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSafeAdapterReceiptPath(value: unknown): value is string {
  return (
    isNonEmptyString(value) &&
    !value.includes("://") &&
    !value.includes("\\") &&
    !value.startsWith("/") &&
    !value.startsWith("~") &&
    !isAbsolute(value) &&
    !value.split("/").includes("..") &&
    value.startsWith(".dx/receipts/extensions/dx.browser.command-center/")
  );
}

function resolveLinkedRoundTripReceiptPath(receipt: ReceiptRecord, receiptPath: string): string {
  const workspaceRoot = workspaceRootFromLoadedProfileReceipt(receipt);

  return workspaceRoot ? join(workspaceRoot, ...receiptPath.split("/")) : receiptPath;
}

function workspaceRootFromLoadedProfileReceipt(receipt: ReceiptRecord): string | undefined {
  if (!isNonEmptyString(receipt.receiptPath)) {
    return undefined;
  }

  const normalizedPath = normalize(receipt.receiptPath);
  const marker = `${sep}.dx${sep}receipts${sep}`;
  const markerIndex = normalizedPath.indexOf(marker);

  return markerIndex > 0 ? normalizedPath.slice(0, markerIndex) : undefined;
}
