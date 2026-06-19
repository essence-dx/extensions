import { readFileSync } from "node:fs";

import {
  classifyCurrentSha256FileProofWeakness,
  classifyLinkedReceiptWeakness,
  classifyLinkedPackageReceiptWeakness,
  classifyLinkedPackageOutputWeakness,
  classifyManualProofWeakness
} from "./release-evidence-linked-proof-freshness.ts";
import {
  classifyGoogleWorkspaceCloudServiceWeakness,
  classifyGoogleWorkspaceDeploymentWeakness,
  classifyLinkedGoogleWorkspaceReceiptWeakness
} from "./release-evidence-google-workspace-classifier.ts";
import {
  type ReceiptRecord,
  hasCommandResults,
  hasManualProofLink,
  hasReceiptShaLink,
  hasReleasePackageOutputLink,
  hasStringList,
  isNonEmptyString,
  isSha256,
  readRecordArray,
  readRecordField,
  readStringArrayField
} from "./release-evidence-receipt-primitives.ts";

const officeAdapterHosts = new Map([
  ["dx.excel.command-center", "excel"],
  ["dx.powerpoint.command-center", "powerpoint"],
  ["dx.word.command-center", "word"]
]);
const googleWorkspaceCommandIds = [
  "dx.google-workspace.show_status",
  "dx.google-workspace.search_assets",
  "dx.google-workspace.show_receipts"
];
const officeSideloadCommandIdsByHost = new Map([
  ["excel", ["dx.excel.show_status", "dx.excel.search_assets", "dx.excel.copy_receipts_path"]],
  [
    "powerpoint",
    ["dx.powerpoint.show_status", "dx.powerpoint.search_media", "dx.powerpoint.copy_receipts_path"]
  ],
  ["word", ["dx.word.show_status", "dx.word.search_assets", "dx.word.copy_receipts_path"]]
]);
const officeLocalServiceOperationsByHost = new Map([
  [
    "excel",
    new Map([
      ["dx.excel.show_status", "dx.status"],
      ["dx.excel.search_assets", "dx.assets.search"]
    ])
  ],
  [
    "powerpoint",
    new Map([
      ["dx.powerpoint.show_status", "dx.status"],
      ["dx.powerpoint.search_media", "dx.media.search"]
    ])
  ],
  [
    "word",
    new Map([
      ["dx.word.show_status", "dx.status"],
      ["dx.word.search_assets", "dx.assets.search"]
    ])
  ]
]);

export function classifyGoogleWorkspaceFileSmokeWeakness(receipt: ReceiptRecord): string | undefined {
  if (receipt.adapterId !== "dx.google-workspace.command-center" || receipt.host !== "google-workspace") {
    return "Google Workspace smoke receipt is missing adapter or host identity";
  }

  const releaseClaims = readRecordField(receipt, "releaseClaims");

  if (
    releaseClaims?.appsScriptDeploymentVerified !== true ||
    releaseClaims.cloudServiceVerified !== true ||
    releaseClaims.workspaceFileSmokeVerified !== true
  ) {
    return "Google Workspace smoke receipt is not linked to deployment, cloud-service, and workspace-file proof";
  }

  if (!hasReleasePackageOutputLink(receipt) || !hasManualProofLink(receipt)) {
    return "Google Workspace smoke receipt is missing package-output or manual-proof linkage";
  }

  const packageOutputWeakness = classifyLinkedPackageOutputWeakness(receipt, "Google Workspace smoke");

  if (packageOutputWeakness) {
    return packageOutputWeakness;
  }

  const deploymentReceiptWeakness = classifyLinkedGoogleWorkspaceReceiptWeakness(
    {
      receiptPath: receipt.deploymentReceiptPath,
      receiptSha256: receipt.deploymentReceiptSha256
    },
    "Google Workspace smoke deployment",
    "Google Workspace smoke deployment",
    classifyGoogleWorkspaceDeploymentWeakness
  );

  if (deploymentReceiptWeakness) {
    return deploymentReceiptWeakness;
  }

  const cloudServiceReceiptWeakness = classifyLinkedGoogleWorkspaceReceiptWeakness(
    {
      receiptPath: receipt.cloudServiceReceiptPath,
      receiptSha256: receipt.cloudServiceReceiptSha256
    },
    "Google Workspace smoke cloud-service",
    "Google Workspace smoke cloud-service",
    classifyGoogleWorkspaceCloudServiceWeakness
  );

  if (cloudServiceReceiptWeakness) {
    return cloudServiceReceiptWeakness;
  }

  const manualProofWeakness = classifyManualProofWeakness(receipt, "Google Workspace smoke");

  if (manualProofWeakness) {
    return manualProofWeakness;
  }

  const workspaceFile = readRecordField(receipt, "workspaceFile");

  if (
    workspaceFile?.cardsRendered !== true ||
    workspaceFile.mutatesWorkspaceFile !== false ||
    workspaceFile.storesWorkspacePayloads !== false ||
    !hasStringList(workspaceFile.commandIdsVisible)
  ) {
    return "Google Workspace smoke receipt is missing safe workspace-file proof";
  }

  if (workspaceFile.fileState !== "test-file") {
    return "Google Workspace smoke receipt must use a real test Workspace file";
  }

  const commandIdsVisible = readStringArrayField(workspaceFile, "commandIdsVisible");
  const visibleCommandIds = new Set(commandIdsVisible);

  if (googleWorkspaceCommandIds.some((commandId) => !visibleCommandIds.has(commandId))) {
    return "Google Workspace smoke receipt is missing required workspace command proof";
  }

  if (commandIdsVisible.some((commandId) => !googleWorkspaceCommandIds.includes(commandId))) {
    return "Google Workspace smoke receipt includes unsupported workspace command proof";
  }

  return undefined;
}

export function classifyOfficeSideloadedHostWeakness(receipt: ReceiptRecord): string | undefined {
  if (!isOfficeAdapterHost(receipt.adapterId, receipt.host)) {
    return "Office sideloaded-host receipt is missing adapter or host identity";
  }

  const releaseClaims = readRecordField(receipt, "releaseClaims");

  if (releaseClaims?.sideloadedHostVerified !== true) {
    return "Office sideloaded-host receipt does not verify a sideloaded host";
  }

  if (!hasReleasePackageOutputLink(receipt) || !hasManualProofLink(receipt)) {
    return "Office sideloaded-host receipt is missing package-output or manual-proof linkage";
  }

  const packageOutputWeakness = classifyLinkedPackageOutputWeakness(receipt, "Office sideloaded-host");

  if (packageOutputWeakness) {
    return packageOutputWeakness;
  }

  const manualProofWeakness = classifyManualProofWeakness(receipt, "Office sideloaded-host");

  if (manualProofWeakness) {
    return manualProofWeakness;
  }

  const sideload = readRecordField(receipt, "sideload");

  if (
    sideload?.taskpaneLoaded !== true ||
    sideload.localServiceRequestsBlocked !== true ||
    !hasStringList(sideload.commandIdsVisible) ||
    !hasCommandResults(sideload.commandResults)
  ) {
    return "Office sideloaded-host receipt is missing taskpane or command proof";
  }

  const commandProofWeakness = classifyOfficeSideloadCommandProof(sideload, receipt.host);

  if (commandProofWeakness) {
    return commandProofWeakness;
  }

  return classifyOfficeSideloadPackageConsistencyWeakness(receipt, sideload);
}

export function classifyOfficeLocalServiceWeakness(receipt: ReceiptRecord): string | undefined {
  if (!isOfficeAdapterHost(receipt.adapterId, receipt.host)) {
    return "Office local-service receipt is missing adapter or host identity";
  }

  const releaseClaims = readRecordField(receipt, "releaseClaims");

  if (releaseClaims?.sideloadedHostVerified !== true || releaseClaims.localServiceVerified !== true) {
    return "Office local-service receipt does not verify sideloaded host and local service";
  }

  if (!hasReceiptShaLink(readRecordField(receipt, "sideloadedHost")) || !hasManualProofLink(receipt)) {
    return "Office local-service receipt is missing sideloaded-host or manual-proof linkage";
  }

  const sideloadedHost = readRecordField(receipt, "sideloadedHost");
  const sideloadedHostWeakness = classifyLinkedReceiptWeakness(sideloadedHost, "Office local-service sideloaded-host");

  if (sideloadedHostWeakness) {
    return sideloadedHostWeakness;
  }

  const sideloadedHostReceipt = readLinkedReceiptRecord(
    sideloadedHost?.receiptPath,
    "Office local-service sideloaded-host"
  );

  if (typeof sideloadedHostReceipt === "string") {
    return sideloadedHostReceipt;
  }

  const sideloadedHostReceiptWeakness = classifyOfficeSideloadedHostWeakness(sideloadedHostReceipt);

  if (sideloadedHostReceiptWeakness) {
    return `Office local-service sideloaded-host receipt is weak: ${sideloadedHostReceiptWeakness}`;
  }

  const manualProofWeakness = classifyManualProofWeakness(receipt, "Office local-service");

  if (manualProofWeakness) {
    return manualProofWeakness;
  }

  const office = readRecordField(receipt, "office");
  const localService = readRecordField(receipt, "localService");

  if (!isNonEmptyString(office?.application) || !isNonEmptyString(office.version)) {
    return "Office local-service receipt is missing Office application proof";
  }

  if (
    localService?.transport !== "loopback" ||
    localService.connected !== true ||
    !["loaded", "unavailable"].includes(String(localService.documentState))
  ) {
    return "Office local-service receipt does not verify connected loopback service";
  }

  const requestWeakness = classifyOfficeLocalServiceRequestWeakness(
    localService.requests,
    receipt.host,
    localService.documentState
  );

  if (requestWeakness) {
    return requestWeakness;
  }

  const responseWeakness = classifyOfficeLocalServiceResponseWeakness(localService.responses, localService.requests);

  if (responseWeakness) {
    return responseWeakness;
  }

  return undefined;
}

export function classifyAffinityManualImportWeakness(receipt: ReceiptRecord): string | undefined {
  if (receipt.adapterId !== "dx.affinity-content.bridge" || receipt.host !== "affinity") {
    return "Affinity manual-import receipt is missing adapter or host identity";
  }

  const releaseClaims = readRecordField(receipt, "releaseClaims");

  if (releaseClaims?.contentPackageVerified !== true || releaseClaims.manualImportVerified !== true) {
    return "Affinity manual-import receipt does not verify content package import";
  }

  const contentPackage = readRecordField(receipt, "contentPackage");

  if (!hasReceiptShaLink(contentPackage) || !isSha256(contentPackage.packageSha256) || !hasManualProofLink(receipt)) {
    return "Affinity manual-import receipt is missing content-package or manual-proof linkage";
  }

  const contentPackageWeakness = classifyLinkedPackageReceiptWeakness(
    contentPackage,
    receipt.adapterId,
    "Affinity manual-import content-package",
    "content_package",
    "content-package"
  );

  if (contentPackageWeakness) {
    return contentPackageWeakness;
  }

  const manualProofWeakness = classifyManualProofWeakness(receipt, "Affinity manual-import");

  if (manualProofWeakness) {
    return manualProofWeakness;
  }

  const manualProof = readRecordField(receipt, "manualProof");

  if (
    !hasStringList(manualProof?.importedContentTypes) ||
    !hasStringList(manualProof.importedArtifactPaths) ||
    !hasStringList(manualProof.importSurfaces) ||
    !isNonEmptyString(manualProof.operator)
  ) {
    return "Affinity manual-import receipt is missing imported content proof";
  }

  return undefined;
}

export function classifyAffinityLoadedAppWeakness(receipt: ReceiptRecord): string | undefined {
  if (receipt.adapterId !== "dx.affinity-content.bridge" || receipt.host !== "affinity") {
    return "Affinity loaded-app receipt is missing adapter or host identity";
  }

  const releaseClaims = readRecordField(receipt, "releaseClaims");

  if (
    releaseClaims?.contentPackageVerified !== true ||
    releaseClaims.manualImportVerified !== true ||
    releaseClaims.loadedAffinityAppVerified !== true
  ) {
    return "Affinity loaded-app receipt does not verify content package, manual import, and loaded app";
  }

  const hostApplication = readRecordField(receipt, "hostApplication");

  if (
    !["Affinity Photo", "Affinity Designer", "Affinity Publisher"].includes(String(hostApplication?.name)) ||
    !isNonEmptyString(hostApplication.version) ||
    hostApplication.loadedAppState !== "loaded"
  ) {
    return "Affinity loaded-app receipt is missing loaded host application proof";
  }

  const executableWeakness = classifyCurrentSha256FileProofWeakness(
    hostApplication.executablePath,
    hostApplication.executableSha256,
    "Affinity loaded-app host executable"
  );

  if (executableWeakness) {
    return executableWeakness;
  }

  const contentPackage = readRecordField(receipt, "contentPackage");

  if (!hasReceiptShaLink(contentPackage) || !isSha256(contentPackage.packageSha256)) {
    return "Affinity loaded-app receipt is missing content-package linkage";
  }

  const contentPackageWeakness = classifyLinkedPackageReceiptWeakness(
    contentPackage,
    receipt.adapterId,
    "Affinity loaded-app content-package",
    "content_package",
    "content-package"
  );

  if (contentPackageWeakness) {
    return contentPackageWeakness;
  }

  const manualImport = readRecordField(receipt, "manualImport");
  const manualImportLinkWeakness = classifyLinkedReceiptWeakness(manualImport, "Affinity loaded-app manual-import");

  if (manualImportLinkWeakness) {
    return manualImportLinkWeakness;
  }

  const manualImportReceipt = readLinkedReceiptRecord(
    manualImport?.receiptPath,
    "Affinity loaded-app manual-import"
  );

  if (typeof manualImportReceipt === "string") {
    return manualImportReceipt;
  }

  const manualImportWeakness = classifyAffinityManualImportWeakness(manualImportReceipt);

  if (manualImportWeakness) {
    return `Affinity loaded-app manual-import receipt is weak: ${manualImportWeakness}`;
  }

  const manualImportContentPackage = readRecordField(manualImportReceipt, "contentPackage");

  if (
    manualImportContentPackage?.receiptPath !== contentPackage.receiptPath ||
    manualImportContentPackage.receiptSha256 !== contentPackage.receiptSha256 ||
    manualImportContentPackage.packageSha256 !== contentPackage.packageSha256
  ) {
    return "Affinity loaded-app content-package link does not match manual-import receipt";
  }

  const loadedApp = readRecordField(receipt, "loadedApp");

  if (
    loadedApp?.contentPackageLoaded !== true ||
    loadedApp.manualImportVisible !== true ||
    loadedApp.mutatesAffinityDocument !== false ||
    loadedApp.storesAffinityPayloads !== false ||
    !hasStringList(loadedApp.importedContentTypes) ||
    !hasStringList(loadedApp.importedArtifactPaths) ||
    !hasStringList(loadedApp.importSurfaces)
  ) {
    return "Affinity loaded-app receipt is missing loaded-app proof";
  }

  const manualImportProof = readRecordField(manualImportReceipt, "manualProof");

  if (
    !manualImportProof ||
    !hasSameStringSet(
      readStringArrayField(loadedApp, "importedContentTypes"),
      readStringArrayField(manualImportProof, "importedContentTypes")
    ) ||
    !hasSameStringSet(
      readStringArrayField(loadedApp, "importedArtifactPaths"),
      readStringArrayField(manualImportProof, "importedArtifactPaths")
    ) ||
    !hasSameStringSet(
      readStringArrayField(loadedApp, "importSurfaces"),
      readStringArrayField(manualImportProof, "importSurfaces")
    )
  ) {
    return "Affinity loaded-app proof does not match manual-import receipt";
  }

  const manualProofWeakness = classifyManualProofWeakness(receipt, "Affinity loaded-app");

  if (manualProofWeakness) {
    return manualProofWeakness;
  }

  return undefined;
}

function isOfficeAdapterHost(adapterId: unknown, host: unknown): boolean {
  return typeof adapterId === "string" && officeAdapterHosts.get(adapterId) === host;
}

function hasSameStringSet(left: string[], right: string[]): boolean {
  const normalizedLeft = uniqueSorted(left);
  const normalizedRight = uniqueSorted(right);

  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => normalizedRight[index] === value)
  );
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function readLinkedReceiptRecord(receiptPath: unknown, label: string): ReceiptRecord | string {
  if (!isNonEmptyString(receiptPath)) {
    return `${label} receipt is missing receipt linkage`;
  }

  try {
    const value = JSON.parse(readFileSync(receiptPath, "utf8"));

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return `${label} receipt is not a JSON object`;
    }

    return value as ReceiptRecord;
  } catch {
    return `${label} receipt is not readable JSON`;
  }
}

function classifyOfficeSideloadCommandProof(sideload: ReceiptRecord, host: unknown): string | undefined {
  const requiredCommandIds = officeSideloadCommandIdsByHost.get(String(host));

  if (!requiredCommandIds) {
    return "Office sideloaded-host receipt is missing adapter or host identity";
  }

  const visibleCommandIds = readStringArrayField(sideload, "commandIdsVisible");
  const commandResults = readRecordArray(sideload.commandResults);
  const resultCommandIds = commandResults
    .map((result) => result.commandId)
    .filter((commandId): commandId is string => isNonEmptyString(commandId));
  const visibleSet = new Set(visibleCommandIds);
  const resultSet = new Set(resultCommandIds);

  if (
    requiredCommandIds.some((commandId) => !visibleSet.has(commandId) || !resultSet.has(commandId))
  ) {
    return "Office sideloaded-host receipt is missing required command proof";
  }

  if (
    visibleCommandIds.some((commandId) => !requiredCommandIds.includes(commandId)) ||
    resultCommandIds.some((commandId) => !requiredCommandIds.includes(commandId))
  ) {
    return "Office sideloaded-host receipt includes unsupported command proof";
  }

  return undefined;
}

function classifyOfficeSideloadPackageConsistencyWeakness(
  receipt: ReceiptRecord,
  sideload: ReceiptRecord
): string | undefined {
  const packageOutput = readRecordField(receipt, "packageOutput");
  const packageOutputReceipt = readLinkedReceiptRecord(
    packageOutput?.receiptPath,
    "Office sideloaded-host package-output"
  );

  if (typeof packageOutputReceipt === "string") {
    return packageOutputReceipt;
  }

  const manifest = readRecordField(packageOutputReceipt, "manifest");
  const packagePayload = readRecordField(packageOutputReceipt, "package");
  const manifestFile = readRecordArray(packagePayload?.files).find(
    (file) => file.relativePath === "manifest.xml"
  );

  if (manifest?.permission !== "ReadDocument" || manifest.placeholderOriginRemoved !== true) {
    return "Office sideloaded-host package output does not prove a safe manifest";
  }

  if (!isNonEmptyString(sideload.taskpaneUrl) || sideload.taskpaneUrl !== manifest.taskpaneUrl) {
    return "Office sideloaded-host taskpane URL does not match package output";
  }

  if (!isSha256(sideload.manifestSha256) || sideload.manifestSha256 !== manifestFile?.sha256) {
    return "Office sideloaded-host manifest hash does not match package output";
  }

  return classifyCurrentSha256FileProofWeakness(
    sideload.manifestPath,
    sideload.manifestSha256,
    "Office sideloaded-host manifest"
  );
}

function classifyOfficeLocalServiceRequestWeakness(
  value: unknown,
  host: unknown,
  documentState: unknown
): string | undefined {
  const requiredOperations = officeLocalServiceOperationsByHost.get(String(host));
  const requests = readRecordArray(value);
  const requestCommands = new Set<string>();

  if (!requiredOperations || requests.length === 0) {
    return "Office local-service receipt is missing metadata-only request proof";
  }

  for (const request of requests) {
    const context = readRecordField(request, "context");

    if (
      request.protocol !== "dx.office.local-service" ||
      request.schemaVersion !== 1 ||
      request.host !== host ||
      !isNonEmptyString(request.command) ||
      !isNonEmptyString(request.operation) ||
      context?.hostDocumentState !== documentState
    ) {
      return "Office local-service receipt is missing metadata-only request proof";
    }

    const expectedOperation = requiredOperations.get(request.command);

    if (!expectedOperation) {
      return "Office local-service receipt uses unsupported command";
    }

    if (request.operation !== expectedOperation) {
      return "Office local-service receipt has an invalid command operation";
    }

    requestCommands.add(request.command);
  }

  if ([...requiredOperations.keys()].some((commandId) => !requestCommands.has(commandId))) {
    return "Office local-service receipt is missing required command proof";
  }

  return undefined;
}

function classifyOfficeLocalServiceResponseWeakness(
  responsesValue: unknown,
  requestsValue: unknown
): string | undefined {
  const responses = readRecordArray(responsesValue);
  const requestCommands = new Set(
    readRecordArray(requestsValue)
      .map((request) => request.command)
      .filter((command): command is string => isNonEmptyString(command))
  );

  if (
    requestCommands.size === 0 ||
    responses.length !== requestCommands.size ||
    !responses.every(
      (response) =>
        isNonEmptyString(response.command) &&
        requestCommands.has(response.command) &&
        response.status === "ok" &&
        response.payloadKind === "metadata-only"
    )
  ) {
    return "Office local-service receipt is missing metadata-only response proof";
  }

  return undefined;
}
