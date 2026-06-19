import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyPackageOutputReceipt } from "./lib/package-output-proof.ts";
import { parseTomlDocument } from "./lib/toml-lite.ts";
import {
  type EvidenceReceiptRequirement,
  parseEvidenceReceiptRequirement
} from "./release-evidence-requirements.ts";
import { validateReleaseEvidenceGates } from "./validate-release-evidence-gates.ts";

export type AdobeCcxHost = "photoshop" | "premiere-pro" | "indesign";
export type AdobeCcxAdapterId =
  | "dx.photoshop.command-center"
  | "dx.premiere-pro.command-center"
  | "dx.indesign.command-center";
export type AdobeCcxPackagingTool = "uxp-developer-tool" | "adobe-uxp-packager" | "dx-ccx-packager";

export interface AdobeCcxPackageProof {
  adapterId: AdobeCcxAdapterId;
  host: AdobeCcxHost;
  packageOutputReceiptPath: string;
  ccxArtifactPath: string;
  sourcePackageRoot: string;
  packagingTool: AdobeCcxPackagingTool;
  packagingToolVersion: string;
}

export interface AdobeCcxPackageReceiptOptions {
  generatedAt?: Date | string;
  verificationCommand?: string;
  receiptPath?: string;
  proof: AdobeCcxPackageProof;
}

export interface AdobeCcxPackageReceipt {
  receipt: "dx.extension.adobe_uxp.ccx_package";
  adapterId: AdobeCcxAdapterId;
  host: AdobeCcxHost;
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  packageOutput: {
    receiptPath: string;
    receiptSha256: string;
    packageSha256: string;
    filesVerified: number;
  };
  sourcePackage: {
    root: string;
    manifestId: string;
    manifestVersion: string;
    manifestMain: "index.html";
    hostApp: string;
  };
  ccxPackage: {
    artifactPath: string;
    fileName: string;
    format: "ccx";
    bytes: number;
    sha256: string;
    packagingTool: AdobeCcxPackagingTool;
    packagingToolVersion: string;
  };
  releaseClaims: {
    packageOutputVerified: true;
    ccxPackaged: true;
    loadedHostVerified: false;
    signingVerified: false;
    releaseChecksumVerified: false;
    distributionVerified: false;
  };
}

interface AdobeCcxAdapterConfig {
  adapterId: AdobeCcxAdapterId;
  host: AdobeCcxHost;
  manifestId: string;
  hostApp: string;
}

interface ReleaseGateEntry {
  id: string;
  evidence_receipt_requirements: string[];
}

const adobeAdapters: Record<AdobeCcxAdapterId, AdobeCcxAdapterConfig> = {
  "dx.photoshop.command-center": {
    adapterId: "dx.photoshop.command-center",
    host: "photoshop",
    manifestId: "dx.photoshop.command-center.development",
    hostApp: "PS"
  },
  "dx.premiere-pro.command-center": {
    adapterId: "dx.premiere-pro.command-center",
    host: "premiere-pro",
    manifestId: "dx.premiere-pro.command-center.development",
    hostApp: "premierepro"
  },
  "dx.indesign.command-center": {
    adapterId: "dx.indesign.command-center",
    host: "indesign",
    manifestId: "dx.indesign.command-center.development",
    hostApp: "ID"
  }
};

export function writeAdobeCcxPackageReceipt(
  root = process.cwd(),
  options: AdobeCcxPackageReceiptOptions
): AdobeCcxPackageReceipt {
  const workspaceRoot = resolve(root);
  const gateFailures = validateReleaseEvidenceGates(workspaceRoot);

  if (gateFailures.length > 0) {
    throw new Error(gateFailures.join("\n"));
  }

  const proof = validateProof(options.proof);
  const config = adobeAdapters[proof.adapterId];
  const receiptPath = resolve(
    options.receiptPath ??
      join(workspaceRoot, ".dx", "receipts", "extensions", proof.adapterId, "ccx-package-latest.json")
  );
  validateReleaseGateMapping(workspaceRoot, proof.adapterId, receiptPath);

  const packageOutputReceiptBytes = readFileSync(proof.packageOutputReceiptPath);
  const packageOutputReceipt = JSON.parse(packageOutputReceiptBytes.toString("utf8"));
  const packageOutput = verifyPackageOutputReceipt(proof.adapterId, packageOutputReceipt);

  if (packageOutput.host !== proof.host) {
    throw new Error("Adobe CCX package proof host must match package-output receipt.");
  }

  if (resolve(packageOutput.root) !== resolve(proof.sourcePackageRoot)) {
    throw new Error("Adobe CCX package source package root must match package-output receipt.");
  }

  const manifest = readSourceManifest(packageOutput.root, config);
  const ccxBytes = readFileSync(proof.ccxArtifactPath);
  const receipt: AdobeCcxPackageReceipt = {
    receipt: "dx.extension.adobe_uxp.ccx_package",
    adapterId: proof.adapterId,
    host: proof.host,
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand: options.verificationCommand ?? "npm run package:adobe-ccx:j1",
    receiptPath,
    packageOutput: {
      receiptPath: proof.packageOutputReceiptPath,
      receiptSha256: sha256(packageOutputReceiptBytes),
      packageSha256: packageOutput.sha256,
      filesVerified: packageOutput.filesVerified
    },
    sourcePackage: {
      root: packageOutput.root,
      manifestId: manifest.id,
      manifestVersion: manifest.version,
      manifestMain: "index.html",
      hostApp: manifest.hostApp
    },
    ccxPackage: {
      artifactPath: proof.ccxArtifactPath,
      fileName: basename(proof.ccxArtifactPath),
      format: "ccx",
      bytes: ccxBytes.length,
      sha256: sha256(ccxBytes),
      packagingTool: proof.packagingTool,
      packagingToolVersion: proof.packagingToolVersion
    },
    releaseClaims: {
      packageOutputVerified: true,
      ccxPackaged: true,
      loadedHostVerified: false,
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
    const proofPath = process.env.DX_ADOBE_CCX_PACKAGE_PROOF_JSON;

    if (!proofPath) {
      throw new Error("DX_ADOBE_CCX_PACKAGE_PROOF_JSON must point to an Adobe CCX package proof JSON file.");
    }

    assertExistingAbsoluteFile(proofPath, "proof JSON");
    const proofSource = JSON.parse(readFileSync(proofPath, "utf8")) as AdobeCcxPackageProof | AdobeCcxPackageProof[];
    const proofs = Array.isArray(proofSource) ? proofSource : [proofSource];

    for (const proof of proofs) {
      const receipt = writeAdobeCcxPackageReceipt(process.cwd(), {
        proof,
        verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run package:adobe-ccx:j1"
      });

      console.log(`Adobe CCX package receipt written: ${receipt.receiptPath}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function validateProof(proof: AdobeCcxPackageProof): AdobeCcxPackageProof {
  if (!isRecord(proof)) {
    throw new Error("Adobe CCX package proof must be an object.");
  }

  const config = adobeAdapters[proof.adapterId];

  if (!config) {
    throw new Error(`Adobe CCX package proof adapter is unsupported: ${String(proof.adapterId)}`);
  }

  if (proof.host !== config.host) {
    throw new Error(`Adobe CCX package proof host must be ${config.host}.`);
  }

  assertExistingAbsoluteFile(proof.packageOutputReceiptPath, "package-output receipt");
  assertExistingAbsoluteFile(proof.ccxArtifactPath, "CCX artifact");
  assertExistingAbsoluteDirectory(proof.sourcePackageRoot, "source package root");

  if (extname(proof.ccxArtifactPath).toLowerCase() !== ".ccx") {
    throw new Error("Adobe CCX artifact must use the .ccx extension.");
  }

  if (!["uxp-developer-tool", "adobe-uxp-packager", "dx-ccx-packager"].includes(proof.packagingTool)) {
    throw new Error("Adobe CCX package proof packaging tool is unsupported.");
  }

  assertNonEmpty(proof.packagingToolVersion, "packaging tool version");

  return proof;
}

function validateReleaseGateMapping(workspaceRoot: string, adapterId: AdobeCcxAdapterId, receiptPath: string): void {
  const receiptRelativePath = toWorkspaceRelativePath(workspaceRoot, receiptPath);
  const gate = readReleaseGateEntries(workspaceRoot).find((entry) => entry.id === adapterId);

  if (!gate) {
    throw new Error(`Adobe CCX package proof has no release evidence gate for ${adapterId}.`);
  }

  const requirements = gate.evidence_receipt_requirements
    .map((requirement) => parseEvidenceReceiptRequirement(requirement))
    .filter((requirement): requirement is EvidenceReceiptRequirement => Boolean(requirement));
  const ccxRequirement = requirements.find((requirement) => requirement.kind === "ccx_package");

  if (!ccxRequirement || ccxRequirement.receiptPath !== receiptRelativePath) {
    throw new Error(`Adobe CCX package receipt path must match the ccx_package release evidence gate for ${adapterId}.`);
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

function readSourceManifest(packageRoot: string, config: AdobeCcxAdapterConfig): {
  id: string;
  version: string;
  hostApp: string;
} {
  const manifest = JSON.parse(readFileSync(join(packageRoot, "manifest.json"), "utf8"));

  if (manifest.id !== config.manifestId) {
    throw new Error(`Adobe CCX package manifest id must be ${config.manifestId}.`);
  }

  if (typeof manifest.version !== "string" || manifest.version.trim() === "") {
    throw new Error("Adobe CCX package manifest version is required.");
  }

  if (manifest.main !== "index.html") {
    throw new Error("Adobe CCX package manifest main must be index.html.");
  }

  if (!isRecord(manifest.host) || manifest.host.app !== config.hostApp) {
    throw new Error(`Adobe CCX package manifest host app must be ${config.hostApp}.`);
  }

  return {
    id: manifest.id,
    version: manifest.version,
    hostApp: manifest.host.app
  };
}

function assertExistingAbsoluteFile(path: unknown, label: string): asserts path is string {
  if (typeof path !== "string" || !isAbsolute(path)) {
    throw new Error(`Adobe CCX package ${label} must be an absolute path.`);
  }

  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new Error(`Adobe CCX package ${label} does not exist: ${path}`);
  }
}

function assertExistingAbsoluteDirectory(path: unknown, label: string): asserts path is string {
  if (typeof path !== "string" || !isAbsolute(path)) {
    throw new Error(`Adobe CCX package ${label} must be an absolute path.`);
  }

  if (!existsSync(path) || !statSync(path).isDirectory()) {
    throw new Error(`Adobe CCX package ${label} does not exist: ${path}`);
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
    throw new Error("Adobe CCX package receipt path must stay under .dx/receipts/extensions.");
  }

  return relativePath;
}

function assertNonEmpty(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Adobe CCX package ${label} is required.`);
  }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
