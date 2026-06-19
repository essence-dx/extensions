import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyPackageOutputReceipt } from "./lib/package-output-proof.ts";

export interface ReleasePackageChecksumReceiptOptions {
  generatedAt?: Date | string;
  verificationCommand?: string;
  proof: ReleasePackageChecksumProof;
}

export interface ReleasePackageChecksumProof {
  adapterId: string;
  host: string;
  packageOutputReceiptPath: string;
  packageOutputSha256: string;
  releaseArtifactPath: string;
  releaseArtifactSha256: string;
  releaseArtifactKind: string;
  artifactCreatedFromPackageOutput: boolean;
}

export interface ReleasePackageChecksumReceipt {
  receipt: "dx.extension.release_package.checksum";
  adapterId: string;
  host: string;
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  packageOutput: {
    receiptPath: string;
    receiptSha256: string;
    packageOutputSha256: string;
    fileCount: number;
    filesVerified: number;
  };
  releaseArtifact: {
    path: string;
    kind: string;
    bytes: number;
    sha256: string;
    createdFromPackageOutput: true;
  };
  checksum: {
    algorithm: "sha256";
    scope: "public-release-package";
    sha256: string;
    bytes: number;
  };
  releaseClaims: {
    packageOutputVerified: true;
    publicReleasePackageVerified: true;
    releaseChecksumVerified: true;
    loadedHostVerified: false;
    signingVerified: false;
    distributionVerified: false;
  };
}

const proofKeys = new Set([
  "adapterId",
  "host",
  "packageOutputReceiptPath",
  "packageOutputSha256",
  "releaseArtifactPath",
  "releaseArtifactSha256",
  "releaseArtifactKind",
  "artifactCreatedFromPackageOutput"
]);

const privacySensitiveProofKeys = new Set([
  "accessToken",
  "apiKey",
  "certificatePassword",
  "clientSecret",
  "password",
  "privateKey",
  "secret",
  "token"
]);

export function writeReleasePackageChecksumReceipt(
  root = process.cwd(),
  options: ReleasePackageChecksumReceiptOptions
): ReleasePackageChecksumReceipt {
  const workspaceRoot = resolve(root);
  const proof = validateProof(options.proof);
  const packageOutputReceiptBytes = readFileSync(proof.packageOutputReceiptPath);
  const releaseArtifactBytes = readFileSync(proof.releaseArtifactPath);
  const packageOutputProof = verifyPackageOutputReceipt(
    proof.adapterId,
    JSON.parse(packageOutputReceiptBytes.toString("utf8"))
  );

  if (packageOutputProof.host !== proof.host) {
    throw new Error(`Release package checksum host mismatch for ${proof.adapterId}.`);
  }

  if (packageOutputProof.sha256 !== proof.packageOutputSha256) {
    throw new Error(`Release package checksum package output hash mismatch for ${proof.adapterId}.`);
  }

  if (sha256(releaseArtifactBytes) !== proof.releaseArtifactSha256) {
    throw new Error("Release package checksum release artifact hash mismatch.");
  }

  const receiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    proof.adapterId,
    "checksum-latest.json"
  );
  const receipt: ReleasePackageChecksumReceipt = {
    receipt: "dx.extension.release_package.checksum",
    adapterId: proof.adapterId,
    host: proof.host,
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand: options.verificationCommand ?? "npm run smoke:release-package-checksum:j1",
    receiptPath,
    packageOutput: {
      receiptPath: proof.packageOutputReceiptPath,
      receiptSha256: sha256(packageOutputReceiptBytes),
      packageOutputSha256: proof.packageOutputSha256,
      fileCount: packageOutputProof.fileCount,
      filesVerified: packageOutputProof.filesVerified
    },
    releaseArtifact: {
      path: proof.releaseArtifactPath,
      kind: proof.releaseArtifactKind,
      bytes: releaseArtifactBytes.length,
      sha256: proof.releaseArtifactSha256,
      createdFromPackageOutput: true
    },
    checksum: {
      algorithm: "sha256",
      scope: "public-release-package",
      sha256: proof.releaseArtifactSha256,
      bytes: releaseArtifactBytes.length
    },
    releaseClaims: {
      packageOutputVerified: true,
      publicReleasePackageVerified: true,
      releaseChecksumVerified: true,
      loadedHostVerified: false,
      signingVerified: false,
      distributionVerified: false
    }
  };

  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

  return receipt;
}

if (isDirectRun()) {
  try {
    const proofPath = process.env.DX_RELEASE_PACKAGE_CHECKSUM_PROOF_JSON;

    if (!proofPath) {
      throw new Error("DX_RELEASE_PACKAGE_CHECKSUM_PROOF_JSON must point to a release package checksum proof JSON file.");
    }

    assertExistingAbsoluteFile(proofPath, "proof JSON");
    const proofSource = JSON.parse(readFileSync(proofPath, "utf8")) as
      | ReleasePackageChecksumProof
      | ReleasePackageChecksumProof[];
    const proofs = Array.isArray(proofSource) ? proofSource : [proofSource];

    for (const proof of proofs) {
      const receipt = writeReleasePackageChecksumReceipt(process.cwd(), {
        proof,
        verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run smoke:release-package-checksum:j1"
      });

      console.log(`Release package checksum receipt written: ${receipt.receiptPath}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function validateProof(proof: ReleasePackageChecksumProof): ReleasePackageChecksumProof {
  rejectUnexpectedProofKeys(proof);
  assertSafeAdapterId(proof.adapterId);
  assertNonEmpty(proof.host, "host");
  assertExistingAbsoluteFile(proof.packageOutputReceiptPath, "package output receipt");
  assertSha256(proof.packageOutputSha256, "package output SHA-256");
  assertExistingAbsoluteFile(proof.releaseArtifactPath, "release artifact");
  assertSha256(proof.releaseArtifactSha256, "release artifact SHA-256");
  assertSafeArtifactKind(proof.releaseArtifactKind);

  if (proof.artifactCreatedFromPackageOutput !== true) {
    throw new Error("Release package checksum proof must verify the release artifact was created from package output.");
  }

  return proof;
}

function rejectUnexpectedProofKeys(proof: ReleasePackageChecksumProof): void {
  for (const key of Object.keys(proof)) {
    if (privacySensitiveProofKeys.has(key)) {
      throw new Error(`Release package checksum proof contains a privacy-sensitive release package checksum proof field: ${key}`);
    }

    if (!proofKeys.has(key)) {
      throw new Error(`Release package checksum proof contains an unsupported field: ${key}`);
    }
  }
}

function assertExistingAbsoluteFile(path: string, label: string): void {
  if (!isAbsolute(path)) {
    throw new Error(`Release package checksum ${label} must be an absolute path.`);
  }

  if (!existsSync(path)) {
    throw new Error(`Release package checksum ${label} does not exist: ${path}`);
  }
}

function assertNonEmpty(value: string, label: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Release package checksum ${label} is required.`);
  }
}

function assertSafeAdapterId(adapterId: string): void {
  if (!/^dx\.[a-z0-9][a-z0-9.-]*$/.test(adapterId) || adapterId.includes("..")) {
    throw new Error(`Release package checksum adapter id is unsafe: ${adapterId}`);
  }
}

function assertSafeArtifactKind(kind: string): void {
  if (!/^[a-z][a-z0-9.-]*$/.test(kind)) {
    throw new Error(`Release package checksum artifact kind is unsafe: ${kind}`);
  }
}

function assertSha256(value: string, label: string): void {
  assertNonEmpty(value, label);

  if (!/^[0-9a-f]{64}$/.test(value)) {
    throw new Error(`Release package checksum ${label} must be a SHA-256 hex digest.`);
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
