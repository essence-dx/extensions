import { readFileSync } from "node:fs";

import {
  classifyLinkedPackageOutputWeakness,
  classifyLinkedReceiptWeakness,
  classifyManualProofWeakness
} from "./release-evidence-linked-proof-freshness.ts";
import {
  type ReceiptRecord,
  hasManualProofLink,
  hasReleasePackageOutputLink,
  hasReceiptShaLink,
  isNonEmptyString,
  isSha256,
  readRecordArray,
  readRecordField
} from "./release-evidence-receipt-primitives.ts";

const googleWorkspaceCommandOperations = new Map([
  ["dx.google-workspace.show_status", "dx.status"],
  ["dx.google-workspace.search_assets", "dx.assets.search"],
  ["dx.google-workspace.show_receipts", "receipt.showPath"]
]);

export function classifyGoogleWorkspaceDeploymentWeakness(
  receipt: ReceiptRecord | undefined
): string | undefined {
  if (!receipt || receipt.receipt !== "dx.extension.google_workspace.apps_script_deployment") {
    return "Apps Script deployment evidence receipt is not a Google Workspace deployment receipt";
  }

  if (receipt.adapterId !== "dx.google-workspace.command-center" || receipt.host !== "google-workspace") {
    return "Google Workspace deployment receipt is missing adapter or host identity";
  }

  const releaseClaims = readRecordField(receipt, "releaseClaims");

  if (releaseClaims?.appsScriptDeploymentVerified !== true) {
    return "Google Workspace deployment receipt does not verify Apps Script deployment";
  }

  const deployment = readRecordField(receipt, "deployment");

  if (
    !hasReleasePackageOutputLink(receipt) ||
    !hasManualProofLink(receipt) ||
    deployment?.deploymentMode !== "test-deployment" ||
    !isSha256(deployment.deploymentIdSha256) ||
    !isSha256(deployment.appsScriptProjectIdSha256) ||
    !isNonEmptyString(deployment.deploymentVersion) ||
    deployment.oauthScopesEmpty !== true
  ) {
    return "Google Workspace deployment receipt must use a test deployment and include package, manual, deployment, and OAuth-scope proof";
  }

  return (
    classifyLinkedPackageOutputWeakness(receipt, "Google Workspace deployment") ??
    classifyManualProofWeakness(receipt, "Google Workspace deployment")
  );
}

export function classifyGoogleWorkspaceCloudServiceWeakness(
  receipt: ReceiptRecord | undefined
): string | undefined {
  if (!receipt || receipt.receipt !== "dx.extension.google_workspace.cloud_service") {
    return "cloud-service evidence receipt is not a Google Workspace cloud-service receipt";
  }

  if (receipt.adapterId !== "dx.google-workspace.command-center" || receipt.host !== "google-workspace") {
    return "Google Workspace cloud-service receipt is missing adapter or host identity";
  }

  const releaseClaims = readRecordField(receipt, "releaseClaims");

  if (
    releaseClaims?.appsScriptDeploymentVerified !== true ||
    releaseClaims.cloudServiceVerified !== true
  ) {
    return "Google Workspace cloud-service receipt does not verify deployment and cloud-service proof";
  }

  const service = readRecordField(receipt, "service");
  const metadataExchangeWeakness = classifyCloudMetadataExchangeWeakness(
    receipt.requests,
    receipt.responses,
    "Google Workspace cloud-service",
    googleWorkspaceCommandOperations
  );

  if (
    !hasReceiptShaLink({
      receiptPath: receipt.deploymentReceiptPath,
      receiptSha256: receipt.deploymentReceiptSha256
    }) ||
    !hasReleasePackageOutputLink(receipt) ||
    !hasManualProofLink(receipt) ||
    !isNonEmptyString(service?.endpointHost) ||
    service.transport !== "https" ||
    service.metadataOnly !== true ||
    service.storesWorkspacePayloads !== false
  ) {
    return "Google Workspace cloud-service receipt is missing deployment linkage or metadata-only service proof";
  }

  if (metadataExchangeWeakness) {
    return metadataExchangeWeakness;
  }

  return (
    classifyLinkedGoogleWorkspaceReceiptWeakness(
      {
        receiptPath: receipt.deploymentReceiptPath,
        receiptSha256: receipt.deploymentReceiptSha256
      },
      "Google Workspace cloud-service deployment",
      "Google Workspace cloud-service deployment",
      classifyGoogleWorkspaceDeploymentWeakness
    ) ??
    classifyLinkedPackageOutputWeakness(receipt, "Google Workspace cloud-service") ??
    classifyManualProofWeakness(receipt, "Google Workspace cloud-service")
  );
}

export function classifyLinkedGoogleWorkspaceReceiptWeakness(
  link: ReceiptRecord,
  linkLabel: string,
  semanticLabel: string,
  classifyReceipt: (receipt: ReceiptRecord) => string | undefined
): string | undefined {
  const linkWeakness = classifyLinkedReceiptWeakness(link, linkLabel);

  if (linkWeakness) {
    return linkWeakness;
  }

  const linkedReceipt = readLinkedReceiptObject(link.receiptPath, semanticLabel);

  if (typeof linkedReceipt === "string") {
    return linkedReceipt;
  }

  const receiptWeakness = classifyReceipt(linkedReceipt);

  if (receiptWeakness) {
    return `${semanticLabel} receipt is weak: ${receiptWeakness}`;
  }

  return undefined;
}

function hasCloudMetadataRequests(value: unknown): boolean {
  const requests = readRecordArray(value);

  return (
    requests.length > 0 &&
    requests.every(
      (request) =>
        isNonEmptyString(request.commandId) &&
        isNonEmptyString(request.operation) &&
        request.metadataOnly === true &&
        request.transport === "cloud-service"
    )
  );
}

function hasCloudMetadataResponses(value: unknown): boolean {
  const responses = readRecordArray(value);

  return (
    responses.length > 0 &&
    responses.every(
      (response) =>
        isNonEmptyString(response.commandId) &&
        (response.status === "ok" || response.status === "proof-blocked") &&
        response.payloadKind === "metadata-only-card"
    )
  );
}

function classifyCloudMetadataExchangeWeakness(
  requestsValue: unknown,
  responsesValue: unknown,
  label: string,
  requiredCommandOperations: Map<string, string>
): string | undefined {
  const requests = readRecordArray(requestsValue);
  const responses = readRecordArray(responsesValue);

  if (!hasCloudMetadataRequests(requestsValue)) {
    return `${label} receipt is missing metadata-only request proof`;
  }

  if (responses.some((response) => response.status === "proof-blocked")) {
    return `${label} responses must prove successful cloud-service execution`;
  }

  if (!hasCloudMetadataResponses(responsesValue)) {
    return `${label} receipt is missing metadata-only response proof`;
  }

  const requestCommandIds = commandIdSet(requests);
  const responseCommandIds = commandIdSet(responses);

  if (
    requestCommandIds.size !== requests.length ||
    responseCommandIds.size !== responses.length ||
    requestCommandIds.size !== responseCommandIds.size ||
    ![...requestCommandIds].every((commandId) => responseCommandIds.has(commandId))
  ) {
    return `${label} response command set does not match request command set`;
  }

  const requiredCommandIds = [...requiredCommandOperations.keys()];

  if (
    requiredCommandIds.some(
      (commandId) => !requestCommandIds.has(commandId) || !responseCommandIds.has(commandId)
    )
  ) {
    return `${label} receipt is missing required command metadata`;
  }

  for (const request of requests) {
    const expectedOperation = requiredCommandOperations.get(String(request.commandId));

    if (!expectedOperation) {
      return `${label} receipt uses unsupported command metadata`;
    }

    if (request.operation !== expectedOperation) {
      return `${label} receipt has an invalid command operation`;
    }
  }

  return undefined;
}

function readLinkedReceiptObject(path: unknown, label: string): ReceiptRecord | string {
  if (!isNonEmptyString(path)) {
    return `${label} receipt is missing receipt path`;
  }

  try {
    const parsedReceipt = JSON.parse(readFileSync(path, "utf8"));

    if (!parsedReceipt || typeof parsedReceipt !== "object" || Array.isArray(parsedReceipt)) {
      return `${label} receipt is not a JSON object`;
    }

    return parsedReceipt as ReceiptRecord;
  } catch {
    return `${label} receipt is not readable JSON`;
  }
}

function commandIdSet(records: ReceiptRecord[]): Set<string> {
  return new Set(
    records
      .map((record) => record.commandId)
      .filter((commandId): commandId is string => isNonEmptyString(commandId))
  );
}
