import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyPackageOutputReceipt } from "./lib/package-output-proof.ts";

export type OfficeSideloadedHost = "excel" | "powerpoint" | "word";
export type OfficeDocumentState = "loaded" | "unavailable";
export type OfficeCommandResultStatus = "clicked" | "proof-blocked" | "visible";

export interface OfficeSideloadedHostReceiptOptions {
  generatedAt?: Date | string;
  verificationCommand?: string;
  proof: OfficeSideloadedHostProof;
}

export interface OfficeSideloadedHostProof {
  host: OfficeSideloadedHost;
  officeApplication: "Excel" | "PowerPoint" | "Word";
  officeVersion: string;
  packageOutputReceiptPath: string;
  sideloadManifestPath: string;
  taskpaneUrl: string;
  proofFilePath: string;
  taskpaneLoaded: boolean;
  commandIdsVisible: string[];
  commandResults: OfficeCommandResult[];
  localServiceRequestsBlocked: boolean;
  documentState: OfficeDocumentState;
}

export interface OfficeCommandResult {
  commandId: string;
  status: OfficeCommandResultStatus;
}

export interface OfficeSideloadedHostReceipt {
  receipt: "dx.extension.office_taskpane.sideloaded_host";
  adapterId: OfficeAdapterId;
  host: OfficeSideloadedHost;
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  office: {
    application: OfficeSideloadedHostProof["officeApplication"];
    version: string;
  };
  packageOutput: {
    receiptPath: string;
    receiptSha256: string;
    packageSha256: string;
  };
  sideload: {
    manifestPath: string;
    manifestSha256: string;
    taskpaneUrl: string;
    taskpaneLoaded: true;
    documentState: OfficeDocumentState;
    commandIdsVisible: string[];
    commandResults: OfficeCommandResult[];
    localServiceRequestsBlocked: true;
  };
  manualProof: {
    proofFilePath: string;
    proofFileSha256: string;
  };
  releaseClaims: {
    sideloadedHostVerified: true;
    localServiceVerified: false;
    signingVerified: false;
    releaseChecksumVerified: false;
    appSourceApproved: false;
    distributionVerified: false;
  };
}

type OfficeAdapterId =
  | "dx.excel.command-center"
  | "dx.powerpoint.command-center"
  | "dx.word.command-center";

interface OfficeAdapter {
  adapterId: OfficeAdapterId;
  application: OfficeSideloadedHostProof["officeApplication"];
  commandIds: readonly string[];
  host: OfficeSideloadedHost;
  officeHost: "Workbook" | "Presentation" | "Document";
  route: string;
}

interface PackageOutputReceipt {
  adapterId?: string;
  host?: string;
  manifest?: {
    officeHost?: string;
    permission?: string;
    taskpaneUrl?: string;
  };
  package?: {
    root?: string;
    fileCount?: number;
    sha256?: string;
    files?: Array<{
      relativePath?: string;
      bytes?: number;
      sha256?: string;
    }>;
  };
}

const adapters: Record<OfficeSideloadedHost, OfficeAdapter> = {
  excel: {
    adapterId: "dx.excel.command-center",
    application: "Excel",
    commandIds: ["dx.excel.show_status", "dx.excel.search_assets", "dx.excel.copy_receipts_path"],
    host: "excel",
    officeHost: "Workbook",
    route: "excel"
  },
  powerpoint: {
    adapterId: "dx.powerpoint.command-center",
    application: "PowerPoint",
    commandIds: [
      "dx.powerpoint.show_status",
      "dx.powerpoint.search_media",
      "dx.powerpoint.copy_receipts_path"
    ],
    host: "powerpoint",
    officeHost: "Presentation",
    route: "powerpoint"
  },
  word: {
    adapterId: "dx.word.command-center",
    application: "Word",
    commandIds: ["dx.word.show_status", "dx.word.search_assets", "dx.word.copy_receipts_path"],
    host: "word",
    officeHost: "Document",
    route: "word"
  }
};
const proofKeys = new Set([
  "host",
  "officeApplication",
  "officeVersion",
  "packageOutputReceiptPath",
  "sideloadManifestPath",
  "taskpaneUrl",
  "proofFilePath",
  "taskpaneLoaded",
  "commandIdsVisible",
  "commandResults",
  "localServiceRequestsBlocked",
  "documentState"
]);
const commandResultKeys = new Set(["commandId", "status"]);
const commandResultStatuses = new Set(["clicked", "proof-blocked", "visible"]);
const privacySensitiveProofKeys = new Set([
  "account",
  "clipboardContents",
  "documentName",
  "documentText",
  "filePath",
  "presentationName",
  "selectionText",
  "tenant",
  "url",
  "workbookName"
]);

export function writeOfficeSideloadedHostReceipt(
  root = process.cwd(),
  options: OfficeSideloadedHostReceiptOptions
): OfficeSideloadedHostReceipt {
  const workspaceRoot = resolve(root);
  const proof = validateProof(options.proof);
  const adapter = adapters[proof.host];
  const packageOutputReceiptBytes = readFileSync(proof.packageOutputReceiptPath);
  const packageOutputReceipt = JSON.parse(packageOutputReceiptBytes.toString("utf8")) as PackageOutputReceipt;
  const manifestBytes = readFileSync(proof.sideloadManifestPath);
  const proofFileBytes = readFileSync(proof.proofFilePath);
  const manifestSha256 = createHash("sha256").update(manifestBytes).digest("hex");
  const manifest = manifestBytes.toString("utf8");

  validateManifest(manifest, adapter, proof);
  const packageOutputProof = validatePackageOutputReceipt(packageOutputReceipt, adapter, proof, manifestSha256);

  const receiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    adapter.adapterId,
    "sideloaded-host-latest.json"
  );
  const receipt: OfficeSideloadedHostReceipt = {
    receipt: "dx.extension.office_taskpane.sideloaded_host",
    adapterId: adapter.adapterId,
    host: adapter.host,
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand: options.verificationCommand ?? "npm run smoke:office-sideloaded-host:j1",
    receiptPath,
    office: {
      application: proof.officeApplication,
      version: proof.officeVersion.trim()
    },
    packageOutput: {
      receiptPath: proof.packageOutputReceiptPath,
      receiptSha256: createHash("sha256").update(packageOutputReceiptBytes).digest("hex"),
      packageSha256: packageOutputProof.sha256
    },
    sideload: {
      manifestPath: proof.sideloadManifestPath,
      manifestSha256,
      taskpaneUrl: proof.taskpaneUrl,
      taskpaneLoaded: true,
      documentState: proof.documentState,
      commandIdsVisible: uniqueSorted(proof.commandIdsVisible),
      commandResults: [...proof.commandResults].sort((left, right) => left.commandId.localeCompare(right.commandId)),
      localServiceRequestsBlocked: true
    },
    manualProof: {
      proofFilePath: proof.proofFilePath,
      proofFileSha256: createHash("sha256").update(proofFileBytes).digest("hex")
    },
    releaseClaims: {
      sideloadedHostVerified: true,
      localServiceVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      appSourceApproved: false,
      distributionVerified: false
    }
  };

  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

  return receipt;
}

if (isDirectRun()) {
  try {
    const proofPath = process.env.DX_OFFICE_SIDELOADED_HOST_PROOF_JSON;

    if (!proofPath) {
      throw new Error("DX_OFFICE_SIDELOADED_HOST_PROOF_JSON must point to an Office sideload proof JSON file.");
    }

    assertExistingProofJsonFile(proofPath);
    const proofSource = JSON.parse(readFileSync(proofPath, "utf8")) as
      | OfficeSideloadedHostProof
      | OfficeSideloadedHostProof[];
    const proofs = Array.isArray(proofSource) ? proofSource : [proofSource];

    for (const proof of proofs) {
      const receipt = writeOfficeSideloadedHostReceipt(process.cwd(), {
        proof,
        verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run smoke:office-sideloaded-host:j1"
      });

      console.log(`${receipt.office.application} sideloaded-host receipt written: ${receipt.receiptPath}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function validateProof(proof: OfficeSideloadedHostProof): OfficeSideloadedHostProof {
  if (!isRecord(proof)) {
    throw new Error("Office sideloaded proof must be an object.");
  }

  rejectUnexpectedProofKeys(proof);

  if (!Object.hasOwn(adapters, proof.host)) {
    throw new Error(`Unsupported Office sideloaded host: ${proof.host}`);
  }

  const adapter = adapters[proof.host];

  if (proof.officeApplication !== adapter.application) {
    throw new Error(`Office sideloaded proof application must be ${adapter.application}.`);
  }

  assertNonEmpty(proof.officeVersion, "Office version");
  assertExistingAbsoluteFile(proof.packageOutputReceiptPath, "package-output receipt");
  assertExistingAbsoluteFile(proof.sideloadManifestPath, "sideload manifest");
  assertExistingAbsoluteFile(proof.proofFilePath, "proof file");

  if (!proof.taskpaneLoaded) {
    throw new Error("Office sideloaded proof must verify a loaded task pane.");
  }

  if (!proof.localServiceRequestsBlocked) {
    throw new Error("Office sideloaded proof must keep local-service requests blocked.");
  }

  if (proof.documentState !== "loaded" && proof.documentState !== "unavailable") {
    throw new Error("Office sideloaded proof must use a coarse document state.");
  }

  validateCommandIds(proof.commandIdsVisible, adapter, "visible command metadata");
  validateCommandResults(proof.commandResults, adapter);

  return proof;
}

function rejectUnexpectedProofKeys(proof: Record<string, unknown>): void {
  for (const key of Object.keys(proof)) {
    if (privacySensitiveProofKeys.has(key)) {
      throw new Error(`Office sideload proof contains privacy-sensitive Office sideload proof field: ${key}`);
    }

    if (!proofKeys.has(key)) {
      throw new Error(`Unexpected Office sideload proof field: ${key}`);
    }
  }
}

function validateCommandIds(values: unknown, adapter: OfficeAdapter, label: string): Set<string> {
  if (!Array.isArray(values) || values.map((value) => String(value).trim()).filter(Boolean).length === 0) {
    throw new Error(`Office sideloaded proof must include ${label}.`);
  }

  const allowedCommandIds = new Set(adapter.commandIds);
  const commandIds = new Set<string>();

  for (const value of values) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error("Office sideloaded proof command id is required.");
    }

    const commandId = value.trim();

    if (!allowedCommandIds.has(commandId)) {
      throw new Error(`Office sideloaded proof includes unsupported Office sideloaded command id: ${commandId}.`);
    }

    commandIds.add(commandId);
  }

  for (const requiredCommandId of adapter.commandIds) {
    if (!commandIds.has(requiredCommandId)) {
      throw new Error(`Office sideloaded proof must include ${label} for ${requiredCommandId}.`);
    }
  }

  return commandIds;
}

function validateCommandResults(results: unknown, adapter: OfficeAdapter): void {
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error("Office sideloaded proof must include command results.");
  }

  const seenCommandIds = new Set<string>();
  const allowedCommandIds = new Set(adapter.commandIds);

  for (const result of results) {
    if (!isRecord(result)) {
      throw new Error("Office sideloaded command result must be an object.");
    }

    rejectUnexpectedCommandResultKeys(result);
    assertNonEmpty(result.commandId, "command result id");

    const commandId = result.commandId.trim();

    if (!allowedCommandIds.has(commandId)) {
      throw new Error(`Office sideloaded proof includes unsupported Office sideloaded command id: ${commandId}.`);
    }

    if (seenCommandIds.has(commandId)) {
      throw new Error(`Office sideloaded proof duplicates command result metadata: ${commandId}.`);
    }

    if (typeof result.status !== "string" || !commandResultStatuses.has(result.status)) {
      throw new Error(`Unsupported Office sideloaded command result status: ${result.status}`);
    }

    seenCommandIds.add(commandId);
  }

  for (const requiredCommandId of adapter.commandIds) {
    if (!seenCommandIds.has(requiredCommandId)) {
      throw new Error(`Office sideloaded proof must include command result metadata for ${requiredCommandId}.`);
    }
  }
}

function rejectUnexpectedCommandResultKeys(result: Record<string, unknown>): void {
  for (const key of Object.keys(result)) {
    if (privacySensitiveProofKeys.has(key)) {
      throw new Error(`Office sideload proof contains privacy-sensitive Office sideload proof field: ${key}`);
    }

    if (!commandResultKeys.has(key)) {
      throw new Error(`Office sideloaded command result contains an unsupported field: ${key}`);
    }
  }
}

function validatePackageOutputReceipt(
  receipt: PackageOutputReceipt,
  adapter: OfficeAdapter,
  proof: OfficeSideloadedHostProof,
  manifestSha256: string
): ReturnType<typeof verifyPackageOutputReceipt> {
  if (receipt.adapterId !== adapter.adapterId || receipt.host !== adapter.host) {
    throw new Error("Office sideloaded proof package-output receipt must match the Office adapter.");
  }

  if (receipt.manifest?.officeHost !== adapter.officeHost) {
    throw new Error(`Office package-output receipt must target ${adapter.officeHost}.`);
  }

  if (receipt.manifest?.permission !== "ReadDocument") {
    throw new Error("Office package-output receipt must keep ReadDocument permission.");
  }

  if (receipt.manifest?.taskpaneUrl !== proof.taskpaneUrl) {
    throw new Error("Office sideloaded proof taskpane URL must match package-output receipt.");
  }

  const manifestFile = receipt.package?.files?.find((file) => file.relativePath === "manifest.xml");

  if (manifestFile?.sha256 !== manifestSha256) {
    throw new Error("Office sideload manifest hash must match package-output receipt.");
  }

  return verifyPackageOutputReceipt(adapter.adapterId, receipt);
}

function validateManifest(manifest: string, adapter: OfficeAdapter, proof: OfficeSideloadedHostProof): void {
  if (!new RegExp(`<Host Name="${escapeRegExp(adapter.officeHost)}"\\s*\\/>`).test(manifest)) {
    throw new Error(`Office sideload manifest must target ${adapter.officeHost}.`);
  }

  if (!/<Permissions>ReadDocument<\/Permissions>/.test(manifest)) {
    throw new Error("Office sideload manifest must keep ReadDocument permission.");
  }

  if (/<Permissions>\s*(ReadWriteDocument|ReadAllDocument|WriteDocument)\s*<\/Permissions>/i.test(manifest)) {
    throw new Error("Office sideload manifest must keep ReadDocument permission.");
  }

  const taskpaneUrl = readTaskpaneUrl(manifest);

  if (taskpaneUrl !== proof.taskpaneUrl) {
    throw new Error("Office sideload proof taskpane URL must match sideload manifest.");
  }

  if (new URL(taskpaneUrl).protocol !== "https:") {
    throw new Error("Office sideload taskpane URL must use HTTPS.");
  }

  if (!taskpaneUrl.endsWith(`/${adapter.route}/taskpane.html`)) {
    throw new Error(`Office sideload taskpane URL must target ${adapter.route}.`);
  }
}

function readTaskpaneUrl(manifest: string): string {
  const match = /<SourceLocation DefaultValue="([^"]+\/taskpane\.html)"\s*\/>/.exec(manifest);

  if (!match) {
    throw new Error("Office sideload manifest does not declare a taskpane SourceLocation.");
  }

  return match[1];
}

function assertExistingAbsoluteFile(path: string, label: string): void {
  if (!isAbsolute(path)) {
    throw new Error(`Office sideloaded proof ${label} must be an absolute path.`);
  }

  if (!existsSync(path)) {
    throw new Error(`Office sideloaded proof ${label} does not exist: ${path}`);
  }
}

function assertExistingProofJsonFile(path: string): void {
  if (!isAbsolute(path)) {
    throw new Error("Office sideloaded proof JSON file must be an absolute path.");
  }

  if (!existsSync(path)) {
    throw new Error(`Office sideloaded proof JSON file does not exist: ${path}`);
  }
}

function assertNonEmpty(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Office sideloaded proof ${label} is required.`);
  }
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
