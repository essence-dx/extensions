import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { classifyCreativeLoadedHostWeakness } from "./lib/release-evidence-loaded-application-host-classifier.ts";
import { type ReceiptRecord, isRecord } from "./lib/release-evidence-receipt-primitives.ts";
import { verifyPackageOutputReceipt } from "./lib/package-output-proof.ts";
import { parseTomlDocument } from "./lib/toml-lite.ts";
import {
  type EvidenceReceiptRequirement,
  parseEvidenceReceiptRequirement
} from "./release-evidence-requirements.ts";
import { validateReleaseEvidenceGates } from "./validate-release-evidence-gates.ts";

export type AdobeUxpPluginIdHost = "photoshop" | "premiere-pro" | "indesign";
export type AdobeUxpPluginIdAdapterId =
  | "dx.photoshop.command-center"
  | "dx.premiere-pro.command-center"
  | "dx.indesign.command-center";
export type AdobeUxpMarketplaceListingState = "draft" | "submitted" | "published";

export interface AdobeUxpPluginIdProof {
  adapterId: AdobeUxpPluginIdAdapterId;
  host: AdobeUxpPluginIdHost;
  loadedHostReceiptPath: string;
  proofFilePath: string;
  developerConsolePluginId: string;
  developerConsolePluginIdVerified: boolean;
  developerConsoleProjectVerified: boolean;
  marketplaceListingState: AdobeUxpMarketplaceListingState;
}

export interface AdobeUxpPluginIdReceiptOptions {
  generatedAt?: Date | string;
  verificationCommand?: string;
  receiptPath?: string;
  proof: AdobeUxpPluginIdProof;
}

export interface AdobeUxpPluginIdReceipt {
  receipt: "dx.extension.adobe_uxp.plugin_id";
  adapterId: AdobeUxpPluginIdAdapterId;
  host: AdobeUxpPluginIdHost;
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  loadedHost: {
    receiptPath: string;
    receiptSha256: string;
  };
  packageOutput: {
    receiptPath: string;
    receiptSha256: string;
    packageSha256: string;
  };
  adobeDeveloperConsole: {
    pluginId: string;
    pluginIdSha256: string;
    pluginIdVerified: true;
    projectVerified: true;
    marketplaceListingState: AdobeUxpMarketplaceListingState;
  };
  manualProof: {
    proofFilePath: string;
    proofFileSha256: string;
  };
  releaseClaims: {
    loadedHostVerified: true;
    pluginIdVerified: true;
    signingVerified: false;
    releaseChecksumVerified: false;
    creativeCloudReviewVerified: false;
    distributionVerified: false;
  };
}

interface AdapterConfig {
  adapterId: AdobeUxpPluginIdAdapterId;
  host: AdobeUxpPluginIdHost;
  manifestId: string;
}

interface ReleaseGateEntry {
  id: string;
  evidence_receipt_requirements: string[];
}

const adobeUxpPluginAdapters: Record<AdobeUxpPluginIdAdapterId, AdapterConfig> = {
  "dx.photoshop.command-center": {
    adapterId: "dx.photoshop.command-center",
    host: "photoshop",
    manifestId: "dx.photoshop.command-center.development"
  },
  "dx.premiere-pro.command-center": {
    adapterId: "dx.premiere-pro.command-center",
    host: "premiere-pro",
    manifestId: "dx.premiere-pro.command-center.development"
  },
  "dx.indesign.command-center": {
    adapterId: "dx.indesign.command-center",
    host: "indesign",
    manifestId: "dx.indesign.command-center.development"
  }
};
const proofKeys = new Set([
  "adapterId",
  "host",
  "loadedHostReceiptPath",
  "proofFilePath",
  "developerConsolePluginId",
  "developerConsolePluginIdVerified",
  "developerConsoleProjectVerified",
  "marketplaceListingState"
]);
const privacySensitiveProofKeys = new Set([
  "account",
  "accountEmail",
  "apiKey",
  "email",
  "organization",
  "password",
  "projectName",
  "rawHostResponse",
  "secret",
  "teamId",
  "tenant",
  "token",
  "url",
  "userId"
]);

export function writeAdobeUxpPluginIdReceipt(
  root = process.cwd(),
  options: AdobeUxpPluginIdReceiptOptions
): AdobeUxpPluginIdReceipt {
  const workspaceRoot = resolve(root);
  const gateFailures = validateReleaseEvidenceGates(workspaceRoot);

  if (gateFailures.length > 0) {
    throw new Error(gateFailures.join("\n"));
  }

  const proof = validateProof(options.proof);
  const config = adobeUxpPluginAdapters[proof.adapterId];
  const receiptPath = resolve(
    options.receiptPath ??
      join(workspaceRoot, ".dx", "receipts", "extensions", proof.adapterId, "plugin-id-latest.json")
  );

  validateReleaseGateMapping(workspaceRoot, proof.adapterId, receiptPath);

  const loadedHostReceiptBytes = readFileSync(proof.loadedHostReceiptPath);
  const loadedHostReceipt = readJsonReceipt(loadedHostReceiptBytes, "Adobe UXP loaded-host receipt");
  const loadedHostWeakness = classifyCreativeLoadedHostWeakness(loadedHostReceipt);

  if (loadedHostWeakness) {
    throw new Error(`Adobe UXP plugin-id loaded-host receipt is weak: ${loadedHostWeakness}`);
  }

  validateLoadedHostReceipt(loadedHostReceipt, config);

  if (proof.developerConsolePluginId.trim() !== loadedHostReceipt.adobeUxp?.uxpManifestId) {
    throw new Error("Adobe UXP Developer Console plugin id must match the loaded Adobe UXP manifest id.");
  }

  const packageOutput = readPackageOutputLink(loadedHostReceipt, config);
  const proofFileBytes = readFileSync(proof.proofFilePath);
  const pluginId = proof.developerConsolePluginId.trim();
  const receipt: AdobeUxpPluginIdReceipt = {
    receipt: "dx.extension.adobe_uxp.plugin_id",
    adapterId: config.adapterId,
    host: config.host,
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand: options.verificationCommand ?? "npm run smoke:adobe-uxp-plugin-id:j1",
    receiptPath,
    loadedHost: {
      receiptPath: proof.loadedHostReceiptPath,
      receiptSha256: sha256(loadedHostReceiptBytes)
    },
    packageOutput,
    adobeDeveloperConsole: {
      pluginId,
      pluginIdSha256: sha256(Buffer.from(pluginId)),
      pluginIdVerified: true,
      projectVerified: true,
      marketplaceListingState: proof.marketplaceListingState
    },
    manualProof: {
      proofFilePath: proof.proofFilePath,
      proofFileSha256: sha256(proofFileBytes)
    },
    releaseClaims: {
      loadedHostVerified: true,
      pluginIdVerified: true,
      signingVerified: false,
      releaseChecksumVerified: false,
      creativeCloudReviewVerified: false,
      distributionVerified: false
    }
  };

  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

  return receipt;
}

export function writeAdobeUxpPluginIdReceipts(
  root = process.cwd(),
  options: Omit<AdobeUxpPluginIdReceiptOptions, "proof"> & {
    proof: AdobeUxpPluginIdProof | AdobeUxpPluginIdProof[];
  }
): AdobeUxpPluginIdReceipt[] {
  const proofs = Array.isArray(options.proof) ? options.proof : [options.proof];

  return proofs.map((proof) =>
    writeAdobeUxpPluginIdReceipt(root, {
      generatedAt: options.generatedAt,
      receiptPath: options.receiptPath,
      verificationCommand: options.verificationCommand,
      proof
    })
  );
}

if (isDirectRun()) {
  try {
    const proofPath = process.env.DX_ADOBE_UXP_PLUGIN_ID_PROOF_JSON;

    if (!proofPath) {
      throw new Error("DX_ADOBE_UXP_PLUGIN_ID_PROOF_JSON must point to an Adobe UXP plugin-id proof JSON file.");
    }

    assertExistingAbsoluteFile(proofPath, "proof JSON");
    const proofSource = JSON.parse(readFileSync(proofPath, "utf8")) as
      | AdobeUxpPluginIdProof
      | AdobeUxpPluginIdProof[];
    const receipts = writeAdobeUxpPluginIdReceipts(process.cwd(), {
      proof: proofSource,
      verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run smoke:adobe-uxp-plugin-id:j1"
    });

    for (const receipt of receipts) {
      console.log(`Adobe UXP plugin-id receipt written: ${receipt.receiptPath}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function validateProof(proof: AdobeUxpPluginIdProof): AdobeUxpPluginIdProof {
  if (!isRecord(proof)) {
    throw new Error("Adobe UXP plugin-id proof must be an object.");
  }

  rejectPrivacySensitiveKeys(proof);
  rejectUnexpectedProofKeys(proof);

  const config = adobeUxpPluginAdapters[proof.adapterId];

  if (!config) {
    throw new Error(`Adobe UXP plugin-id proof adapter is unsupported: ${String(proof.adapterId)}`);
  }

  if (proof.host !== config.host) {
    throw new Error(`Adobe UXP plugin-id proof host must be ${config.host}.`);
  }

  assertExistingAbsoluteFile(proof.loadedHostReceiptPath, "loaded-host receipt");
  assertExistingAbsoluteFile(proof.proofFilePath, "proof file");

  if (proof.developerConsolePluginId.trim() !== config.manifestId) {
    throw new Error("Adobe UXP Developer Console plugin id must match the loaded Adobe UXP manifest id.");
  }

  if (proof.developerConsolePluginIdVerified !== true) {
    throw new Error("Adobe UXP plugin-id proof must verify the Developer Console plugin id.");
  }

  if (proof.developerConsoleProjectVerified !== true) {
    throw new Error("Adobe UXP plugin-id proof must verify the Developer Console project.");
  }

  if (!["draft", "submitted", "published"].includes(proof.marketplaceListingState)) {
    throw new Error("Adobe UXP plugin-id proof has an unsupported marketplace listing state.");
  }

  return proof;
}

function validateLoadedHostReceipt(receipt: ReceiptRecord, config: AdapterConfig): void {
  const releaseClaims = isRecord(receipt.releaseClaims) ? receipt.releaseClaims : undefined;
  const adobeUxp = isRecord(receipt.adobeUxp) ? receipt.adobeUxp : undefined;

  if (
    receipt.receipt !== "dx.extension.creative.loaded_host" ||
    receipt.adapterId !== config.adapterId ||
    receipt.host !== config.host ||
    releaseClaims?.loadedHostVerified !== true ||
    adobeUxp?.uxpManifestId !== config.manifestId
  ) {
    throw new Error("Adobe UXP plugin-id proof must link to the matching loaded Adobe UXP host receipt.");
  }
}

function readPackageOutputLink(
  loadedHostReceipt: ReceiptRecord,
  config: AdapterConfig
): AdobeUxpPluginIdReceipt["packageOutput"] {
  const packageOutput = loadedHostReceipt.packageOutput;

  if (
    !isRecord(packageOutput) ||
    typeof packageOutput.receiptPath !== "string" ||
    typeof packageOutput.receiptSha256 !== "string" ||
    typeof packageOutput.packageSha256 !== "string"
  ) {
    throw new Error("Adobe UXP plugin-id proof loaded-host receipt is missing package-output linkage.");
  }

  const packageOutputReceiptBytes = readFileSync(packageOutput.receiptPath);

  if (sha256(packageOutputReceiptBytes) !== packageOutput.receiptSha256) {
    throw new Error("Adobe UXP plugin-id package-output receipt hash changed.");
  }

  const packageOutputReceipt = readJsonReceipt(packageOutputReceiptBytes, "Adobe UXP package-output receipt");
  const packageOutputProof = verifyPackageOutputReceipt(config.adapterId, packageOutputReceipt);

  if (packageOutputProof.host !== config.host || packageOutputProof.sha256 !== packageOutput.packageSha256) {
    throw new Error("Adobe UXP plugin-id package-output proof does not match the loaded-host receipt.");
  }

  return {
    receiptPath: packageOutput.receiptPath,
    receiptSha256: packageOutput.receiptSha256,
    packageSha256: packageOutput.packageSha256
  };
}

function validateReleaseGateMapping(
  workspaceRoot: string,
  adapterId: AdobeUxpPluginIdAdapterId,
  receiptPath: string
): void {
  const receiptRelativePath = toWorkspaceRelativePath(workspaceRoot, receiptPath);
  const gate = readReleaseGateEntries(workspaceRoot).find((entry) => entry.id === adapterId);

  if (!gate) {
    throw new Error(`Adobe UXP plugin-id proof has no release evidence gate for ${adapterId}.`);
  }

  const requirements = gate.evidence_receipt_requirements
    .map((requirement) => parseEvidenceReceiptRequirement(requirement))
    .filter((requirement): requirement is EvidenceReceiptRequirement => Boolean(requirement));
  const pluginIdRequirement = requirements.find((requirement) => requirement.kind === "plugin_id");

  if (!pluginIdRequirement || pluginIdRequirement.receiptPath !== receiptRelativePath) {
    throw new Error(
      `Adobe UXP plugin-id receipt path must match the plugin_id release evidence gate for ${adapterId}.`
    );
  }
}

function readReleaseGateEntries(workspaceRoot: string): ReleaseGateEntry[] {
  const releaseGates = parseTomlDocument(
    readFileSync(join(workspaceRoot, "registry", "release-evidence-gates.toml"), "utf8")
  );

  return (releaseGates.arrays.extensions ?? []).map((entry) => ({
    id: entry.id,
    evidence_receipt_requirements: Array.isArray(entry.evidence_receipt_requirements)
      ? entry.evidence_receipt_requirements
      : []
  }));
}

function readJsonReceipt(bytes: Buffer, label: string): ReceiptRecord {
  const receipt = JSON.parse(bytes.toString("utf8"));

  if (!isRecord(receipt)) {
    throw new Error(`${label} must be a JSON object.`);
  }

  return receipt;
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
      throw new Error(`Adobe UXP plugin-id proof contains privacy-sensitive Adobe UXP plugin-id proof field: ${key}`);
    }

    rejectPrivacySensitiveKeys(child);
  }
}

function rejectUnexpectedProofKeys(proof: Record<string, unknown>): void {
  for (const key of Object.keys(proof)) {
    if (!proofKeys.has(key)) {
      throw new Error(`Unexpected Adobe UXP plugin-id proof field: ${key}`);
    }
  }
}

function assertExistingAbsoluteFile(path: unknown, label: string): asserts path is string {
  if (typeof path !== "string" || !isAbsolute(path)) {
    throw new Error(`Adobe UXP plugin-id proof ${label} must be an absolute path.`);
  }

  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new Error(`Adobe UXP plugin-id proof ${label} does not exist: ${path}`);
  }
}

function toWorkspaceRelativePath(workspaceRoot: string, absolutePath: string): string {
  const relativePath = relative(workspaceRoot, absolutePath).replace(/\\/g, "/");

  if (
    relativePath === ".." ||
    relativePath.startsWith("../") ||
    isAbsolute(relativePath) ||
    !relativePath.startsWith(".dx/receipts/extensions/")
  ) {
    throw new Error("Adobe UXP plugin-id receipt path must stay under .dx/receipts/extensions.");
  }

  return relativePath;
}

function normalizeGeneratedAt(value: Date | string | undefined): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value ?? new Date().toISOString();
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
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
