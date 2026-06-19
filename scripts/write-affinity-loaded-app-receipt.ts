import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyPackageOutputReceipt } from "./lib/package-output-proof.ts";

export interface AffinityLoadedAppReceiptOptions {
  generatedAt?: Date | string;
  verificationCommand?: string;
  proof: AffinityLoadedAppProof;
}

export interface AffinityLoadedAppProof {
  affinityHost: "Affinity Photo 2" | "Affinity Designer 2" | "Affinity Publisher 2";
  hostVersion: string;
  hostExecutablePath: string;
  contentPackageReceiptPath: string;
  manualImportReceiptPath: string;
  proofFilePath: string;
  loadedAppVerified: boolean;
  contentPackageLoaded: boolean;
  manualImportVisible: boolean;
  importedContentTypes: string[];
  importedArtifactPaths: string[];
  importSurfaces: string[];
  mutatesAffinityDocument: boolean;
  storesAffinityPayloads: boolean;
}

export interface AffinityLoadedAppReceipt {
  receipt: "dx.extension.affinity_content.loaded_app";
  adapterId: "dx.affinity-content.bridge";
  host: "affinity";
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  hostApplication: {
    name: "Affinity Photo" | "Affinity Designer" | "Affinity Publisher";
    version: string;
    executablePath: string;
    executableSha256: string;
    loadedAppState: "loaded";
  };
  contentPackage: {
    receiptPath: string;
    receiptSha256: string;
    packageSha256: string;
  };
  manualImport: {
    receiptPath: string;
    receiptSha256: string;
  };
  loadedApp: {
    contentPackageLoaded: true;
    manualImportVisible: true;
    importedContentTypes: string[];
    importedArtifactPaths: string[];
    importSurfaces: string[];
    mutatesAffinityDocument: false;
    storesAffinityPayloads: false;
  };
  manualProof: {
    proofFilePath: string;
    proofFileSha256: string;
  };
  releaseClaims: {
    contentPackageVerified: true;
    manualImportVerified: true;
    loadedAffinityAppVerified: true;
    nativeSdkPluginVerified: false;
    photoshopFilterPluginVerified: false;
    signingVerified: false;
    releaseChecksumVerified: false;
    distributionVerified: false;
  };
}

interface AffinityContentPackageReceipt {
  receipt?: unknown;
  adapterId?: unknown;
  host?: unknown;
  contentArtifacts?: unknown;
}

interface AffinityManualImportReceipt {
  receipt?: unknown;
  adapterId?: unknown;
  host?: unknown;
  affinityHost?: {
    name?: unknown;
    version?: unknown;
  };
  contentPackage?: {
    receiptPath?: unknown;
    receiptSha256?: unknown;
    packageSha256?: unknown;
  };
  manualProof?: {
    importedContentTypes?: unknown;
    importedArtifactPaths?: unknown;
    importSurfaces?: unknown;
  };
  releaseClaims?: {
    contentPackageVerified?: unknown;
    manualImportVerified?: unknown;
  };
}

interface AffinityContentArtifact {
  relativePath?: unknown;
  contentType?: unknown;
}

const adapterId = "dx.affinity-content.bridge";
const hostApplicationByAffinityHost = new Map<
  AffinityLoadedAppProof["affinityHost"],
  AffinityLoadedAppReceipt["hostApplication"]["name"]
>([
  ["Affinity Photo 2", "Affinity Photo"],
  ["Affinity Designer 2", "Affinity Designer"],
  ["Affinity Publisher 2", "Affinity Publisher"]
]);
const allowedContentTypes = new Set(["assets", "fonts", "swatches", "styles", "templates"]);
const proofKeys = new Set([
  "affinityHost",
  "hostVersion",
  "hostExecutablePath",
  "contentPackageReceiptPath",
  "manualImportReceiptPath",
  "proofFilePath",
  "loadedAppVerified",
  "contentPackageLoaded",
  "manualImportVisible",
  "importedContentTypes",
  "importedArtifactPaths",
  "importSurfaces",
  "mutatesAffinityDocument",
  "storesAffinityPayloads"
]);
const privateKeys = new Set([
  "account",
  "clipboard",
  "documentName",
  "documentPath",
  "documentText",
  "filePath",
  "password",
  "rawHostResponse",
  "secret",
  "selection",
  "selectionText",
  "token",
  "workspaceName"
]);

export function writeAffinityLoadedAppReceipt(
  root = process.cwd(),
  options: AffinityLoadedAppReceiptOptions
): AffinityLoadedAppReceipt {
  const workspaceRoot = resolve(root);
  const proof = validateLoadedAppProof(options.proof);
  const hostApplication = hostApplicationByAffinityHost.get(proof.affinityHost);

  if (!hostApplication) {
    throw new Error(`Unsupported Affinity loaded-app host: ${proof.affinityHost}`);
  }

  const contentPackageReceiptBytes = readFileSync(proof.contentPackageReceiptPath);
  const contentPackageReceipt = JSON.parse(contentPackageReceiptBytes.toString("utf8")) as AffinityContentPackageReceipt;
  const manualImportReceiptBytes = readFileSync(proof.manualImportReceiptPath);
  const manualImportReceipt = JSON.parse(manualImportReceiptBytes.toString("utf8")) as AffinityManualImportReceipt;
  const hostExecutableBytes = readFileSync(proof.hostExecutablePath);
  const proofFileBytes = readFileSync(proof.proofFilePath);
  validateContentPackageReceipt(proof, contentPackageReceipt);
  const contentPackageProof = verifyPackageOutputReceipt(adapterId, contentPackageReceipt);
  validateManualImportReceipt(
    proof,
    manualImportReceipt,
    sha256(contentPackageReceiptBytes),
    contentPackageProof.sha256
  );
  validateProofFile(proofFileBytes);

  if (contentPackageProof.host !== "affinity") {
    throw new Error("Affinity loaded-app content package receipt has the wrong host.");
  }

  const receiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    adapterId,
    "loaded-app-latest.json"
  );
  const receipt: AffinityLoadedAppReceipt = {
    receipt: "dx.extension.affinity_content.loaded_app",
    adapterId,
    host: "affinity",
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand: options.verificationCommand ?? "npm run smoke:affinity-loaded-app:j1",
    receiptPath,
    hostApplication: {
      name: hostApplication,
      version: proof.hostVersion.trim(),
      executablePath: proof.hostExecutablePath,
      executableSha256: sha256(hostExecutableBytes),
      loadedAppState: "loaded"
    },
    contentPackage: {
      receiptPath: proof.contentPackageReceiptPath,
      receiptSha256: sha256(contentPackageReceiptBytes),
      packageSha256: contentPackageProof.sha256
    },
    manualImport: {
      receiptPath: proof.manualImportReceiptPath,
      receiptSha256: sha256(manualImportReceiptBytes)
    },
    loadedApp: {
      contentPackageLoaded: true,
      manualImportVisible: true,
      importedContentTypes: uniqueSorted(proof.importedContentTypes),
      importedArtifactPaths: uniqueSorted(proof.importedArtifactPaths),
      importSurfaces: uniqueSorted(proof.importSurfaces),
      mutatesAffinityDocument: false,
      storesAffinityPayloads: false
    },
    manualProof: {
      proofFilePath: proof.proofFilePath,
      proofFileSha256: sha256(proofFileBytes)
    },
    releaseClaims: {
      contentPackageVerified: true,
      manualImportVerified: true,
      loadedAffinityAppVerified: true,
      nativeSdkPluginVerified: false,
      photoshopFilterPluginVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      distributionVerified: false
    }
  };

  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

  return receipt;
}

if (isDirectRun()) {
  try {
    const proofPath = process.env.DX_AFFINITY_LOADED_APP_PROOF_JSON;

    if (!proofPath) {
      throw new Error("DX_AFFINITY_LOADED_APP_PROOF_JSON must point to a loaded Affinity app proof JSON file.");
    }

    assertExistingAbsoluteFile(proofPath, "proof JSON");
    const proof = JSON.parse(readFileSync(proofPath, "utf8")) as AffinityLoadedAppProof;
    const receipt = writeAffinityLoadedAppReceipt(process.cwd(), {
      proof,
      verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run smoke:affinity-loaded-app:j1"
    });

    console.log(`Affinity loaded-app receipt written: ${receipt.receiptPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function validateLoadedAppProof(proof: AffinityLoadedAppProof): AffinityLoadedAppProof {
  if (!isRecord(proof)) {
    throw new Error("Affinity loaded-app proof must be an object.");
  }

  rejectPrivateKeys(proof);
  rejectUnexpectedProofKeys(proof);

  if (!hostApplicationByAffinityHost.has(proof.affinityHost)) {
    throw new Error(`Unsupported Affinity loaded-app host: ${proof.affinityHost}`);
  }

  assertNonEmpty(proof.hostVersion, "host version");
  assertExistingAbsoluteFile(proof.hostExecutablePath, "host executable");
  assertExistingAbsoluteFile(proof.contentPackageReceiptPath, "content-package receipt");
  assertExistingAbsoluteFile(proof.manualImportReceiptPath, "manual-import receipt");
  assertExistingAbsoluteFile(proof.proofFilePath, "proof file");

  if (proof.loadedAppVerified !== true) {
    throw new Error("Affinity loaded-app proof must verify a real loaded Affinity app.");
  }

  if (proof.contentPackageLoaded !== true) {
    throw new Error("Affinity loaded-app proof must verify the content package is loaded.");
  }

  if (proof.manualImportVisible !== true) {
    throw new Error("Affinity loaded-app proof must verify the manual import is visible.");
  }

  if (proof.mutatesAffinityDocument !== false) {
    throw new Error("Affinity loaded-app proof must not mutate an Affinity document.");
  }

  if (proof.storesAffinityPayloads !== false) {
    throw new Error("Affinity loaded-app proof must not store Affinity payloads.");
  }

  assertContentTypes(proof.importedContentTypes);
  assertStringList(proof.importedArtifactPaths, "imported artifact");
  assertStringList(proof.importSurfaces, "import surface");

  return proof;
}

function validateContentPackageReceipt(
  proof: AffinityLoadedAppProof,
  receipt: AffinityContentPackageReceipt
): void {
  if (receipt.receipt !== "dx.extension.affinity_content.content_package") {
    throw new Error("Affinity loaded-app must link to an Affinity content-package receipt.");
  }

  if (receipt.adapterId !== adapterId || receipt.host !== "affinity") {
    throw new Error("Affinity loaded-app content package receipt has the wrong adapter or host.");
  }

  if (!Array.isArray(receipt.contentArtifacts) || receipt.contentArtifacts.length === 0) {
    throw new Error("Affinity loaded-app content package receipt must list importable content artifacts.");
  }

  const artifacts = receipt.contentArtifacts.map(readContentArtifact);
  const artifactPaths = new Set(artifacts.map((artifact) => artifact.relativePath));
  const contentTypes = new Set(artifacts.map((artifact) => artifact.contentType));

  for (const artifactPath of uniqueSorted(proof.importedArtifactPaths)) {
    if (!artifactPaths.has(artifactPath)) {
      throw new Error(`Affinity loaded-app imported artifact is not present in the content package receipt: ${artifactPath}`);
    }
  }

  for (const contentType of uniqueSorted(proof.importedContentTypes)) {
    if (!contentTypes.has(contentType)) {
      throw new Error(`Affinity loaded-app imported content type is not present in the content package receipt: ${contentType}`);
    }
  }
}

function validateManualImportReceipt(
  proof: AffinityLoadedAppProof,
  receipt: AffinityManualImportReceipt,
  contentPackageReceiptSha256: string,
  contentPackageSha256: string
): void {
  if (
    receipt.receipt !== "dx.extension.affinity_content.manual_import" ||
    receipt.adapterId !== adapterId ||
    receipt.host !== "affinity"
  ) {
    throw new Error("Affinity loaded-app must link to an Affinity manual-import receipt.");
  }

  if (
    receipt.releaseClaims?.contentPackageVerified !== true ||
    receipt.releaseClaims.manualImportVerified !== true
  ) {
    throw new Error("Affinity loaded-app manual-import receipt does not verify a manual import.");
  }

  if (
    receipt.affinityHost?.name !== proof.affinityHost ||
    receipt.affinityHost.version !== proof.hostVersion.trim()
  ) {
    throw new Error("Affinity loaded-app proof host must match the manual import receipt.");
  }

  if (
    receipt.contentPackage?.receiptPath !== proof.contentPackageReceiptPath ||
    receipt.contentPackage.receiptSha256 !== contentPackageReceiptSha256 ||
    receipt.contentPackage.packageSha256 !== contentPackageSha256
  ) {
    throw new Error("Affinity loaded-app content package link must match the manual import receipt.");
  }

  if (
    !sameStringSet(proof.importedContentTypes, readStringList(receipt.manualProof?.importedContentTypes)) ||
    !sameStringSet(proof.importedArtifactPaths, readStringList(receipt.manualProof?.importedArtifactPaths)) ||
    !sameStringSet(proof.importSurfaces, readStringList(receipt.manualProof?.importSurfaces))
  ) {
    throw new Error("Affinity loaded-app proof must match the manual import receipt.");
  }
}

function readContentArtifact(artifact: AffinityContentArtifact): {
  relativePath: string;
  contentType: string;
} {
  const relativePath = typeof artifact.relativePath === "string" ? artifact.relativePath.trim() : "";
  const contentType = typeof artifact.contentType === "string" ? artifact.contentType.trim() : "";

  if (!isSafeRelativePath(relativePath)) {
    throw new Error("Affinity loaded-app content package receipt contains an unsafe artifact path.");
  }

  if (!allowedContentTypes.has(contentType)) {
    throw new Error(`Affinity loaded-app content package receipt contains an unsupported content type: ${contentType}`);
  }

  return {
    relativePath,
    contentType
  };
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
      throw new Error(`Affinity loaded-app proof contains privacy-sensitive Affinity loaded-app proof field: ${key}`);
    }

    rejectPrivateKeys(child);
  }
}

function rejectUnexpectedProofKeys(proof: Record<string, unknown>): void {
  for (const key of Object.keys(proof)) {
    if (!proofKeys.has(key)) {
      throw new Error(`Unexpected Affinity loaded-app proof field: ${key}`);
    }
  }
}

function assertExistingAbsoluteFile(path: string, label: string): void {
  if (!isAbsolute(path)) {
    throw new Error(`Affinity loaded-app proof ${label} must be an absolute path.`);
  }

  if (!existsSync(path)) {
    throw new Error(`Affinity loaded-app proof ${label} does not exist: ${path}`);
  }
}

function assertNonEmpty(value: string, label: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Affinity loaded-app proof ${label} is required.`);
  }
}

function assertStringList(values: string[], label: string): void {
  if (!Array.isArray(values) || values.map((value) => value.trim()).filter(Boolean).length === 0) {
    throw new Error(`Affinity loaded-app proof must list at least one ${label}.`);
  }
}

function assertContentTypes(values: string[]): void {
  assertStringList(values, "imported content type");

  for (const value of values) {
    if (!allowedContentTypes.has(value)) {
      throw new Error(`Unsupported Affinity loaded-app imported content type: ${value}`);
    }
  }
}

function validateProofFile(bytes: Buffer): void {
  if (bytes.length === 0) {
    throw new Error("Affinity loaded-app proof file must not be empty.");
  }
}

function readStringList(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
}

function sameStringSet(left: string[], right: string[]): boolean {
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

function isSafeRelativePath(value: unknown): boolean {
  return (
    typeof value === "string" &&
    value.trim() !== "" &&
    !value.includes("\\") &&
    !value.includes("://") &&
    !value.startsWith("/") &&
    !value.startsWith("~") &&
    !value.split("/").includes("..")
  );
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
