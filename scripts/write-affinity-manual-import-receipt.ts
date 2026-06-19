import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyPackageOutputReceipt } from "./lib/package-output-proof.ts";

export interface AffinityManualImportReceiptOptions {
  generatedAt?: Date | string;
  verificationCommand?: string;
  proof: AffinityManualImportProof;
}

export interface AffinityManualImportProof {
  affinityHost: "Affinity Photo 2" | "Affinity Designer 2" | "Affinity Publisher 2";
  hostVersion: string;
  contentPackageReceiptPath: string;
  proofFilePath: string;
  importedContentTypes: string[];
  importedArtifactPaths: string[];
  importSurfaces: string[];
  operator: string;
  notes: string[];
}

export interface AffinityManualImportReceipt {
  receipt: "dx.extension.affinity_content.manual_import";
  adapterId: "dx.affinity-content.bridge";
  host: "affinity";
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  affinityHost: {
    name: AffinityManualImportProof["affinityHost"];
    version: string;
  };
  contentPackage: {
    receiptPath: string;
    receiptSha256: string;
    packageSha256: string;
  };
  manualProof: {
    proofFilePath: string;
    proofFileSha256: string;
    importedContentTypes: string[];
    importedArtifactPaths: string[];
    importSurfaces: string[];
    operator: string;
    notes: string[];
  };
  releaseClaims: {
    contentPackageVerified: true;
    manualImportVerified: true;
    loadedAffinityAppVerified: false;
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

interface AffinityContentArtifact {
  relativePath?: unknown;
  contentType?: unknown;
}

const adapterId = "dx.affinity-content.bridge";
const supportedHosts = new Set(["Affinity Photo 2", "Affinity Designer 2", "Affinity Publisher 2"]);
const allowedContentTypes = new Set(["assets", "fonts", "swatches", "styles", "templates"]);

export function writeAffinityManualImportReceipt(
  root = process.cwd(),
  options: AffinityManualImportReceiptOptions
): AffinityManualImportReceipt {
  const workspaceRoot = resolve(root);
  const proof = validateManualImportProof(options.proof);
  const contentPackageReceiptBytes = readFileSync(proof.contentPackageReceiptPath);
  const contentPackageReceipt = JSON.parse(contentPackageReceiptBytes.toString("utf8")) as AffinityContentPackageReceipt;
  const proofFileBytes = readFileSync(proof.proofFilePath);
  validateManualProofFile(proofFileBytes);
  validateContentPackageReceipt(proof, contentPackageReceipt);
  const contentPackageProof = verifyPackageOutputReceipt(adapterId, contentPackageReceipt);
  const receiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    adapterId,
    "manual-import-latest.json"
  );
  const receipt: AffinityManualImportReceipt = {
    receipt: "dx.extension.affinity_content.manual_import",
    adapterId,
    host: "affinity",
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand: options.verificationCommand ?? "npm run smoke:affinity-manual-import:j1",
    receiptPath,
    affinityHost: {
      name: proof.affinityHost,
      version: proof.hostVersion
    },
    contentPackage: {
      receiptPath: proof.contentPackageReceiptPath,
      receiptSha256: createHash("sha256").update(contentPackageReceiptBytes).digest("hex"),
      packageSha256: contentPackageProof.sha256
    },
    manualProof: {
      proofFilePath: proof.proofFilePath,
      proofFileSha256: createHash("sha256").update(proofFileBytes).digest("hex"),
      importedContentTypes: uniqueSorted(proof.importedContentTypes),
      importedArtifactPaths: uniqueSorted(proof.importedArtifactPaths),
      importSurfaces: uniqueSorted(proof.importSurfaces),
      operator: proof.operator.trim(),
      notes: proof.notes.map((note) => note.trim()).filter(Boolean)
    },
    releaseClaims: {
      contentPackageVerified: true,
      manualImportVerified: true,
      loadedAffinityAppVerified: false,
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
    const proofPath = process.env.DX_AFFINITY_MANUAL_IMPORT_PROOF_JSON;

    if (!proofPath) {
      throw new Error("DX_AFFINITY_MANUAL_IMPORT_PROOF_JSON must point to a manual import proof JSON file.");
    }

    const proof = JSON.parse(readFileSync(proofPath, "utf8")) as AffinityManualImportProof;
    const receipt = writeAffinityManualImportReceipt(process.cwd(), {
      proof,
      verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run smoke:affinity-manual-import:j1"
    });

    console.log(`Affinity manual import receipt written: ${receipt.receiptPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function validateManualImportProof(proof: AffinityManualImportProof): AffinityManualImportProof {
  if (!supportedHosts.has(proof.affinityHost)) {
    throw new Error(`Unsupported Affinity manual import host: ${proof.affinityHost}`);
  }

  assertNonEmpty(proof.hostVersion, "host version");
  assertNonEmpty(proof.operator, "operator");
  assertExistingAbsoluteFile(proof.contentPackageReceiptPath, "content package receipt");
  assertExistingAbsoluteFile(proof.proofFilePath, "manual proof file");
  assertStringList(proof.importedArtifactPaths, "imported artifact");
  assertStringList(proof.importSurfaces, "import surface");
  assertContentTypes(proof.importedContentTypes);

  return proof;
}

function validateContentPackageReceipt(
  proof: AffinityManualImportProof,
  receipt: AffinityContentPackageReceipt
): void {
  if (receipt.receipt !== "dx.extension.affinity_content.content_package") {
    throw new Error("Affinity manual import must link to an Affinity content-package receipt.");
  }

  if (receipt.adapterId !== adapterId) {
    throw new Error("Affinity manual import content package receipt has the wrong adapter id.");
  }

  if (receipt.host !== "affinity") {
    throw new Error("Affinity manual import content package receipt has the wrong host.");
  }

  if (!Array.isArray(receipt.contentArtifacts) || receipt.contentArtifacts.length === 0) {
    throw new Error("Affinity manual import content package receipt must list importable content artifacts.");
  }

  const artifacts = receipt.contentArtifacts.map(readContentArtifact);
  const artifactPaths = new Set(artifacts.map((artifact) => artifact.relativePath));
  const contentTypes = new Set(artifacts.map((artifact) => artifact.contentType));

  for (const artifactPath of uniqueSorted(proof.importedArtifactPaths)) {
    if (!artifactPaths.has(artifactPath)) {
      throw new Error(`Affinity manual import imported artifact is not present in the content package receipt: ${artifactPath}`);
    }
  }

  for (const contentType of uniqueSorted(proof.importedContentTypes)) {
    if (!contentTypes.has(contentType)) {
      throw new Error(`Affinity manual import imported content type is not present in the content package receipt: ${contentType}`);
    }
  }
}

function validateManualProofFile(bytes: Buffer): void {
  if (bytes.length === 0) {
    throw new Error("Affinity manual proof file must not be empty.");
  }
}

function readContentArtifact(artifact: AffinityContentArtifact): {
  relativePath: string;
  contentType: string;
} {
  const relativePath = typeof artifact.relativePath === "string" ? artifact.relativePath.trim() : "";
  const contentType = typeof artifact.contentType === "string" ? artifact.contentType.trim() : "";

  if (!relativePath || relativePath.includes("\\") || relativePath.startsWith("/") || relativePath.split("/").includes("..")) {
    throw new Error("Affinity manual import content package receipt contains an unsafe artifact path.");
  }

  if (!allowedContentTypes.has(contentType)) {
    throw new Error(`Affinity manual import content package receipt contains an unsupported content type: ${contentType}`);
  }

  return {
    relativePath,
    contentType
  };
}

function assertExistingAbsoluteFile(path: string, label: string): void {
  if (!isAbsolute(path)) {
    throw new Error(`Affinity manual import ${label} must be an absolute path.`);
  }

  if (!existsSync(path)) {
    throw new Error(`Affinity manual import ${label} does not exist: ${path}`);
  }
}

function assertNonEmpty(value: string, label: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Affinity manual import ${label} is required.`);
  }
}

function assertStringList(values: string[], label: string): void {
  if (!Array.isArray(values) || values.map((value) => value.trim()).filter(Boolean).length === 0) {
    throw new Error(`Affinity manual import proof must list at least one ${label}.`);
  }
}

function assertContentTypes(values: string[]): void {
  assertStringList(values, "imported content type");

  for (const value of values) {
    if (!allowedContentTypes.has(value)) {
      throw new Error(`Unsupported Affinity imported content type: ${value}`);
    }
  }
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
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
