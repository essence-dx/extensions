import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface AffinityPhotoshopFilterPluginReceiptOptions {
  generatedAt?: Date | string;
  verificationCommand?: string;
  proof: AffinityPhotoshopFilterPluginProof;
}

export interface AffinityPhotoshopFilterPluginProof {
  loadedAppReceiptPath: string;
  proofFilePath: string;
  filterPluginArtifactPath: string;
  loadedByAffinityPhoto: boolean;
  metadataOnly: boolean;
  mutatesAffinityDocument: boolean;
  storesAffinityPayloads: boolean;
}

export interface AffinityPhotoshopFilterPluginReceipt {
  receipt: "dx.extension.affinity_content.photoshop_filter_plugin";
  adapterId: "dx.affinity-content.bridge";
  host: "affinity";
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  loadedAppReceiptPath: string;
  loadedAppReceiptSha256: string;
  manualProof: {
    proofFilePath: string;
    proofFileSha256: string;
  };
  filterPlugin: {
    kind: "photoshop-compatible-64-bit-filter";
    artifactPath: string;
    fileName: string;
    bytes: number;
    sha256: string;
    loadedByAffinityPhoto: true;
    metadataOnly: true;
    storesAffinityPayloads: false;
    mutatesAffinityDocument: false;
  };
  releaseClaims: {
    loadedAffinityAppVerified: true;
    photoshopFilterPluginVerified: true;
  };
}

interface AffinityLoadedAppReceipt {
  receipt?: unknown;
  adapterId?: unknown;
  host?: unknown;
  hostApplication?: {
    name?: unknown;
    loadedAppState?: unknown;
  };
  releaseClaims?: {
    loadedAffinityAppVerified?: unknown;
  };
}

const adapterId = "dx.affinity-content.bridge";
const proofKeys = new Set([
  "loadedAppReceiptPath",
  "proofFilePath",
  "filterPluginArtifactPath",
  "loadedByAffinityPhoto",
  "metadataOnly",
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

export function writeAffinityPhotoshopFilterPluginReceipt(
  root = process.cwd(),
  options: AffinityPhotoshopFilterPluginReceiptOptions
): AffinityPhotoshopFilterPluginReceipt {
  const workspaceRoot = resolve(root);
  const proof = validateFilterPluginProof(options.proof);
  const loadedAppReceiptBytes = readFileSync(proof.loadedAppReceiptPath);
  const loadedAppReceipt = JSON.parse(loadedAppReceiptBytes.toString("utf8")) as AffinityLoadedAppReceipt;
  const proofFileBytes = readFileSync(proof.proofFilePath);
  const filterPluginBytes = readFileSync(proof.filterPluginArtifactPath);
  validateLoadedAppReceipt(loadedAppReceipt);
  validateNonEmptyFile(proofFileBytes, "proof file");
  validateNonEmptyFile(filterPluginBytes, "filter plugin artifact");
  const receiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    adapterId,
    "photoshop-filter-plugin-latest.json"
  );
  const receipt: AffinityPhotoshopFilterPluginReceipt = {
    receipt: "dx.extension.affinity_content.photoshop_filter_plugin",
    adapterId,
    host: "affinity",
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand: options.verificationCommand ?? "npm run smoke:affinity-photoshop-filter-plugin:j1",
    receiptPath,
    loadedAppReceiptPath: proof.loadedAppReceiptPath,
    loadedAppReceiptSha256: sha256(loadedAppReceiptBytes),
    manualProof: {
      proofFilePath: proof.proofFilePath,
      proofFileSha256: sha256(proofFileBytes)
    },
    filterPlugin: {
      kind: "photoshop-compatible-64-bit-filter",
      artifactPath: proof.filterPluginArtifactPath,
      fileName: basename(proof.filterPluginArtifactPath),
      bytes: filterPluginBytes.length,
      sha256: sha256(filterPluginBytes),
      loadedByAffinityPhoto: true,
      metadataOnly: true,
      storesAffinityPayloads: false,
      mutatesAffinityDocument: false
    },
    releaseClaims: {
      loadedAffinityAppVerified: true,
      photoshopFilterPluginVerified: true
    }
  };

  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

  return receipt;
}

if (isDirectRun()) {
  try {
    const proofPath = process.env.DX_AFFINITY_PHOTOSHOP_FILTER_PLUGIN_PROOF_JSON;

    if (!proofPath) {
      throw new Error(
        "DX_AFFINITY_PHOTOSHOP_FILTER_PLUGIN_PROOF_JSON must point to a metadata-only Affinity Photoshop-compatible filter plugin proof JSON file."
      );
    }

    assertExistingAbsoluteFile(proofPath, "proof JSON");
    const proof = JSON.parse(readFileSync(proofPath, "utf8")) as AffinityPhotoshopFilterPluginProof;
    const receipt = writeAffinityPhotoshopFilterPluginReceipt(process.cwd(), {
      proof,
      verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run smoke:affinity-photoshop-filter-plugin:j1"
    });

    console.log(`Affinity Photoshop-compatible filter plugin receipt written: ${receipt.receiptPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function validateFilterPluginProof(
  proof: AffinityPhotoshopFilterPluginProof
): AffinityPhotoshopFilterPluginProof {
  if (!isRecord(proof)) {
    throw new Error("Affinity filter plugin proof must be an object.");
  }

  rejectPrivateKeys(proof);
  rejectUnexpectedProofKeys(proof);
  assertExistingAbsoluteFile(proof.loadedAppReceiptPath, "loaded-app receipt");
  assertExistingAbsoluteFile(proof.proofFilePath, "proof file");
  assertExistingAbsoluteFile(proof.filterPluginArtifactPath, "filter plugin artifact");

  if (!proof.filterPluginArtifactPath.toLowerCase().endsWith(".8bf")) {
    throw new Error("Affinity filter plugin artifact must be a Photoshop-compatible .8bf filter plugin.");
  }

  if (proof.loadedByAffinityPhoto !== true) {
    throw new Error("Affinity filter plugin proof must verify the Photoshop-compatible filter is loaded by Affinity Photo.");
  }

  if (proof.metadataOnly !== true) {
    throw new Error("Affinity filter plugin proof must verify metadata-only behavior.");
  }

  if (proof.mutatesAffinityDocument !== false) {
    throw new Error("Affinity filter plugin proof must not mutate an Affinity document.");
  }

  if (proof.storesAffinityPayloads !== false) {
    throw new Error("Affinity filter plugin proof must not store Affinity payloads.");
  }

  return proof;
}

function validateLoadedAppReceipt(receipt: AffinityLoadedAppReceipt): void {
  if (
    receipt.receipt !== "dx.extension.affinity_content.loaded_app" ||
    receipt.adapterId !== adapterId ||
    receipt.host !== "affinity" ||
    receipt.hostApplication?.name !== "Affinity Photo" ||
    receipt.hostApplication.loadedAppState !== "loaded" ||
    receipt.releaseClaims?.loadedAffinityAppVerified !== true
  ) {
    throw new Error("Affinity filter plugin must link to a loaded Affinity Photo app receipt.");
  }
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
      throw new Error(`Affinity filter plugin proof contains privacy-sensitive Affinity filter plugin proof field: ${key}`);
    }

    rejectPrivateKeys(child);
  }
}

function rejectUnexpectedProofKeys(proof: Record<string, unknown>): void {
  for (const key of Object.keys(proof)) {
    if (!proofKeys.has(key)) {
      throw new Error(`Unexpected Affinity filter plugin proof field: ${key}`);
    }
  }
}

function assertExistingAbsoluteFile(path: string, label: string): void {
  if (!isAbsolute(path)) {
    throw new Error(`Affinity filter plugin proof ${label} must be an absolute path.`);
  }

  if (!existsSync(path)) {
    throw new Error(`Affinity filter plugin proof ${label} does not exist: ${path}`);
  }
}

function validateNonEmptyFile(bytes: Buffer, label: string): void {
  if (bytes.length === 0) {
    throw new Error(`Affinity filter plugin ${label} must not be empty.`);
  }
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
