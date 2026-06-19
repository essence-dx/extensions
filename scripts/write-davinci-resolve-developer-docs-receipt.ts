import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { parseTomlDocument } from "./lib/toml-lite.ts";
import { verifyPackageOutputReceipt } from "./lib/package-output-proof.ts";
import { validateReleaseEvidenceGates } from "./validate-release-evidence-gates.ts";

export interface DavinciResolveDeveloperDocsProof {
  packageOutputReceiptPath: string;
  proofFilePath: string;
  docsRoot: string;
  docsFiles: string[];
  docsSource: "installed-developer-documentation" | "developer-documentation-export";
  resolveVersion: string;
  developerDocsVersion: string;
}

export interface DavinciResolveDeveloperDocsReceiptOptions {
  generatedAt?: Date | string;
  verificationCommand?: string;
  receiptPath?: string;
  proof: DavinciResolveDeveloperDocsProof;
}

export interface DavinciResolveDeveloperDocsReceipt {
  receipt: "dx.extension.davinci_resolve.developer_docs";
  adapterId: "dx.davinci-resolve.command-center";
  host: "davinci-resolve";
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  packageOutput: {
    receiptPath: string;
    receiptSha256: string;
    packageSha256: string;
    filesVerified: number;
  };
  documentation: {
    docsRoot: string;
    docsSource: DavinciResolveDeveloperDocsProof["docsSource"];
    resolveVersion: string;
    developerDocsVersion: string;
    fileCount: number;
    files: DavinciResolveDeveloperDocsFile[];
    metadataOnly: true;
  };
  manualProof: {
    proofFilePath: string;
    proofFileSha256: string;
  };
  releaseClaims: {
    packageOutputVerified: true;
    developerDocsVersionVerified: true;
    loadedResolveVerified: false;
    workflowIntegrationVerified: false;
    localServiceVerified: false;
    signingVerified: false;
    releaseChecksumVerified: false;
    distributionVerified: false;
  };
}

export interface DavinciResolveDeveloperDocsFile {
  relativePath: string;
  bytes: number;
  sha256: string;
}

const adapterId = "dx.davinci-resolve.command-center";
const defaultReceiptRelativePath =
  ".dx/receipts/extensions/dx.davinci-resolve.command-center/developer-docs-latest.json";
const releaseGatesRelativePath = "registry/release-evidence-gates.toml";

export function writeDavinciResolveDeveloperDocsReceipt(
  root = process.cwd(),
  options: DavinciResolveDeveloperDocsReceiptOptions
): DavinciResolveDeveloperDocsReceipt {
  const workspaceRoot = resolve(root);
  const gateFailures = validateReleaseEvidenceGates(workspaceRoot);

  if (gateFailures.length > 0) {
    throw new Error(gateFailures.join("\n"));
  }

  const proof = validateProof(options.proof);
  const receiptPath = resolve(
    options.receiptPath ?? join(workspaceRoot, ...defaultReceiptRelativePath.split("/"))
  );

  validateReleaseGateMapping(workspaceRoot, receiptPath);

  const packageOutputReceiptBytes = readFileSync(proof.packageOutputReceiptPath);
  const packageOutput = verifyPackageOutputReceipt(
    adapterId,
    JSON.parse(packageOutputReceiptBytes.toString("utf8"))
  );
  const proofFileBytes = readFileSync(proof.proofFilePath);
  const docsFiles = readDocsFiles(proof.docsRoot, proof.docsFiles);

  const receipt: DavinciResolveDeveloperDocsReceipt = {
    receipt: "dx.extension.davinci_resolve.developer_docs",
    adapterId,
    host: "davinci-resolve",
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand:
      options.verificationCommand ?? "npm run smoke:davinci-resolve-developer-docs:j1",
    receiptPath,
    packageOutput: {
      receiptPath: proof.packageOutputReceiptPath,
      receiptSha256: sha256(packageOutputReceiptBytes),
      packageSha256: packageOutput.sha256,
      filesVerified: packageOutput.filesVerified
    },
    documentation: {
      docsRoot: proof.docsRoot,
      docsSource: proof.docsSource,
      resolveVersion: proof.resolveVersion,
      developerDocsVersion: proof.developerDocsVersion,
      fileCount: docsFiles.length,
      files: docsFiles,
      metadataOnly: true
    },
    manualProof: {
      proofFilePath: proof.proofFilePath,
      proofFileSha256: sha256(proofFileBytes)
    },
    releaseClaims: {
      packageOutputVerified: true,
      developerDocsVersionVerified: true,
      loadedResolveVerified: false,
      workflowIntegrationVerified: false,
      localServiceVerified: false,
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
    const proofPath = process.env.DX_DAVINCI_RESOLVE_DEVELOPER_DOCS_PROOF_JSON;

    if (!proofPath) {
      throw new Error(
        "DX_DAVINCI_RESOLVE_DEVELOPER_DOCS_PROOF_JSON must point to a DaVinci Resolve developer documentation proof JSON file."
      );
    }

    assertExistingAbsoluteFile(proofPath, "developer documentation proof JSON");
    const proof = JSON.parse(readFileSync(proofPath, "utf8")) as DavinciResolveDeveloperDocsProof;
    const receipt = writeDavinciResolveDeveloperDocsReceipt(process.cwd(), {
      proof,
      verificationCommand:
        process.env.DX_VERIFICATION_COMMAND ?? "npm run smoke:davinci-resolve-developer-docs:j1"
    });

    console.log(`DaVinci Resolve developer documentation receipt written: ${receipt.receiptPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function validateProof(proof: DavinciResolveDeveloperDocsProof): DavinciResolveDeveloperDocsProof {
  if (!proof || typeof proof !== "object") {
    throw new Error("DaVinci Resolve developer documentation proof must be an object.");
  }

  assertExistingAbsoluteFile(proof.packageOutputReceiptPath, "package-output receipt");
  assertExistingAbsoluteFile(proof.proofFilePath, "manual proof file");
  assertExistingDirectory(proof.docsRoot, "developer documentation root");

  if (!Array.isArray(proof.docsFiles) || proof.docsFiles.length === 0) {
    throw new Error("DaVinci Resolve developer documentation proof requires at least one documentation file.");
  }

  if (!["installed-developer-documentation", "developer-documentation-export"].includes(proof.docsSource)) {
    throw new Error("DaVinci Resolve developer documentation source is unsupported.");
  }

  assertNonEmptyString(proof.resolveVersion, "Resolve version");
  assertNonEmptyString(proof.developerDocsVersion, "developer documentation version");

  return {
    ...proof,
    docsRoot: resolve(proof.docsRoot),
    docsFiles: proof.docsFiles.map((path) => resolve(path)),
    packageOutputReceiptPath: resolve(proof.packageOutputReceiptPath),
    proofFilePath: resolve(proof.proofFilePath),
    resolveVersion: proof.resolveVersion.trim(),
    developerDocsVersion: proof.developerDocsVersion.trim()
  };
}

function readDocsFiles(docsRoot: string, docsFiles: string[]): DavinciResolveDeveloperDocsFile[] {
  return docsFiles
    .map((absolutePath) => {
      assertExistingAbsoluteFile(absolutePath, "developer documentation file");
      const relativePath = relative(docsRoot, absolutePath).split(sep).join("/");

      if (relativePath.startsWith("../") || relativePath === ".." || isAbsolute(relativePath)) {
        throw new Error("DaVinci Resolve documentation files must stay under the documentation root.");
      }

      const bytes = readFileSync(absolutePath);

      if (bytes.length <= 0) {
        throw new Error(`DaVinci Resolve documentation file is empty: ${relativePath}`);
      }

      return {
        relativePath,
        bytes: bytes.length,
        sha256: sha256(bytes)
      };
    })
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function validateReleaseGateMapping(workspaceRoot: string, receiptPath: string): void {
  const releaseGatesPath = join(workspaceRoot, releaseGatesRelativePath);
  const releaseGates = parseTomlDocument(readFileSync(releaseGatesPath, "utf8"));
  const gate = (releaseGates.arrays.extensions ?? []).find((entry) => entry.id === adapterId);
  const expectedRequirement = `developer_docs=${defaultReceiptRelativePath}`;

  if (!gate) {
    throw new Error("DaVinci Resolve developer documentation proof has no release evidence gate.");
  }

  if (!Array.isArray(gate.evidence_receipt_requirements) || !gate.evidence_receipt_requirements.includes(expectedRequirement)) {
    throw new Error("DaVinci Resolve release gate must map developer_docs to the developer-docs receipt.");
  }

  if (resolve(workspaceRoot, ...defaultReceiptRelativePath.split("/")) !== receiptPath) {
    throw new Error("DaVinci Resolve developer documentation receipt path must match the release evidence gate.");
  }
}

function assertExistingAbsoluteFile(path: string, label: string): void {
  if (!isAbsolute(path)) {
    throw new Error(`DaVinci Resolve ${label} path must be absolute.`);
  }

  if (!existsSync(path)) {
    throw new Error(`DaVinci Resolve ${label} does not exist: ${path}`);
  }
}

function assertExistingDirectory(path: string, label: string): void {
  if (!isAbsolute(path)) {
    throw new Error(`DaVinci Resolve ${label} path must be absolute.`);
  }

  if (!existsSync(path)) {
    throw new Error(`DaVinci Resolve ${label} does not exist: ${path}`);
  }
}

function assertNonEmptyString(value: unknown, label: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`DaVinci Resolve ${label} must be a non-empty string.`);
  }
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
