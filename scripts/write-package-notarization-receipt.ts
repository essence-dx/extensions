import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  type PackageNotarizationProof,
  assertExistingPackageNotarizationFile,
  readPackageNotarizationSigningLink,
  validatePackageNotarizationProof
} from "./lib/package-notarization-proof.ts";
import {
  classifyPackageSigningReceiptWeakness,
  classifyReleasePackageChecksumReceiptWeakness
} from "./lib/release-evidence-signed-package-classifier.ts";
import type { ReceiptRecord } from "./lib/release-evidence-receipt-primitives.ts";

export type { PackageNotarizationProof };

export interface PackageNotarizationReceiptOptions {
  generatedAt?: Date | string;
  verificationCommand?: string;
  proof: PackageNotarizationProof;
}

export interface PackageNotarizationReceipt {
  receipt: "dx.extension.package.notarization";
  adapterId: "dx.sketch.command-center";
  host: "sketch";
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  signingReceiptPath: string;
  signingReceiptSha256: string;
  checksumReceiptPath: string;
  checksumReceiptSha256: string;
  signedArtifact: {
    path: string;
    sha256: string;
  };
  notarization: {
    toolName: string;
    command: string;
    outputPath: string;
    outputSha256: string;
    ticketIdSha256: string;
    artifactSha256: string;
    verified: true;
  };
  releaseClaims: {
    publicReleasePackageVerified: true;
    signingVerified: true;
    releaseChecksumVerified: true;
    notarizationVerified: true;
    loadedHostVerified: false;
    distributionVerified: false;
  };
}

export function writePackageNotarizationReceipt(
  root = process.cwd(),
  options: PackageNotarizationReceiptOptions
): PackageNotarizationReceipt {
  const workspaceRoot = resolve(root);
  const proof = validatePackageNotarizationProof(options.proof);
  const signingReceiptBytes = readFileSync(proof.signingReceiptPath);
  const signingReceipt = JSON.parse(signingReceiptBytes.toString("utf8"));
  const notarizationOutputBytes = readFileSync(proof.notarizationOutputPath);
  const signingLink = readPackageNotarizationSigningLink(signingReceipt, proof);

  const checksumReceiptBytes = readFileSync(signingLink.checksumReceiptPath);
  const checksumReceipt = JSON.parse(checksumReceiptBytes.toString("utf8"));
  const checksumReceiptSha256 = sha256(checksumReceiptBytes);

  if (checksumReceiptSha256 !== signingLink.checksumReceiptSha256) {
    throw new Error("Package notarization checksum receipt hash mismatch.");
  }

  const signingReceiptWeakness = classifyPackageSigningReceiptWeakness(signingReceipt as ReceiptRecord, {
    expectedAdapterId: proof.adapterId,
    expectedHost: proof.host,
    expectedArtifactSha256: proof.artifactSha256
  });

  if (signingReceiptWeakness) {
    throw new Error(`Package notarization signing receipt is weak: ${signingReceiptWeakness}`);
  }

  const checksumReceiptWeakness = classifyReleasePackageChecksumReceiptWeakness(checksumReceipt as ReceiptRecord, {
    expectedAdapterId: proof.adapterId,
    expectedHost: proof.host,
    expectedArtifactSha256: proof.artifactSha256
  });

  if (checksumReceiptWeakness) {
    throw new Error(`Package notarization checksum receipt is weak: ${checksumReceiptWeakness}`);
  }

  const receiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    proof.adapterId,
    "notarization-latest.json"
  );
  const receipt: PackageNotarizationReceipt = {
    receipt: "dx.extension.package.notarization",
    adapterId: proof.adapterId,
    host: proof.host,
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand: options.verificationCommand ?? "npm run smoke:package-notarization:j1",
    receiptPath,
    signingReceiptPath: proof.signingReceiptPath,
    signingReceiptSha256: sha256(signingReceiptBytes),
    checksumReceiptPath: signingLink.checksumReceiptPath,
    checksumReceiptSha256,
    signedArtifact: {
      path: signingLink.signedArtifactPath,
      sha256: proof.artifactSha256
    },
    notarization: {
      toolName: proof.notarizationToolName.trim(),
      command: proof.notarizationCommand.trim(),
      outputPath: proof.notarizationOutputPath,
      outputSha256: sha256(notarizationOutputBytes),
      ticketIdSha256: proof.ticketIdSha256,
      artifactSha256: proof.artifactSha256,
      verified: true
    },
    releaseClaims: {
      publicReleasePackageVerified: true,
      signingVerified: true,
      releaseChecksumVerified: true,
      notarizationVerified: true,
      loadedHostVerified: false,
      distributionVerified: false
    }
  };

  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

  return receipt;
}

if (isDirectRun()) {
  try {
    const proofPath = process.env.DX_PACKAGE_NOTARIZATION_PROOF_JSON;

    if (!proofPath) {
      throw new Error("DX_PACKAGE_NOTARIZATION_PROOF_JSON must point to a package notarization proof JSON file.");
    }

    assertExistingPackageNotarizationFile(proofPath, "proof JSON");
    const proofSource = JSON.parse(readFileSync(proofPath, "utf8")) as
      | PackageNotarizationProof
      | PackageNotarizationProof[];
    const proofs = Array.isArray(proofSource) ? proofSource : [proofSource];

    for (const proof of proofs) {
      const receipt = writePackageNotarizationReceipt(process.cwd(), {
        proof,
        verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run smoke:package-notarization:j1"
      });

      console.log(`Package notarization receipt written: ${receipt.receiptPath}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
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
