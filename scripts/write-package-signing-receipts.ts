import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyPackageOutputReceipt } from "./lib/package-output-proof.ts";

export interface PackageSigningReceiptOptions {
  generatedAt?: Date | string;
  verificationCommand?: string;
  proof: PackageSigningProof;
}

export interface PackageSigningProof {
  adapterId: string;
  host: string;
  packageOutputReceiptPath: string;
  checksumReceiptPath: string;
  packageOutputSha256: string;
  signedArtifactPath: string;
  signedArtifactSha256: string;
  signatureFilePath: string;
  signatureSha256: string;
  verificationOutputPath: string;
  verificationTool: string;
  verificationCommand: string;
  signerName: string;
  certificateFingerprintSha256: string;
  verified: boolean;
}

export interface PackageSigningReceipt {
  receipt: "dx.extension.package.signing";
  adapterId: string;
  host: string;
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  packageOutput: {
    receiptPath: string;
    receiptSha256: string;
    checksumReceiptPath: string;
    checksumReceiptSha256: string;
    packageOutputSha256: string;
  };
  signedArtifact: {
    path: string;
    sha256: string;
  };
  signature: {
    path: string;
    sha256: string;
    tool: string;
    verificationCommand: string;
    verificationOutputPath: string;
    verificationOutputSha256: string;
    signerName: string;
    certificateFingerprintSha256: string;
    verified: true;
  };
  releaseClaims: {
    packageOutputVerified: true;
    releaseChecksumVerified: true;
    signingVerified: true;
    loadedHostVerified: false;
    distributionVerified: false;
    publicReleasePackageVerified: true;
  };
}

interface ChecksumReceipt {
  receipt?: unknown;
  adapterId?: unknown;
  host?: unknown;
  packageOutput?: {
    receiptPath?: unknown;
    receiptSha256?: unknown;
    packageOutputSha256?: unknown;
  };
  releaseArtifact?: {
    sha256?: unknown;
    createdFromPackageOutput?: unknown;
  };
  checksum?: {
    algorithm?: unknown;
    scope?: unknown;
    sha256?: unknown;
  };
  releaseClaims?: {
    publicReleasePackageVerified?: unknown;
    releaseChecksumVerified?: unknown;
  };
}

const proofKeys = new Set([
  "adapterId",
  "host",
  "packageOutputReceiptPath",
  "checksumReceiptPath",
  "packageOutputSha256",
  "signedArtifactPath",
  "signedArtifactSha256",
  "signatureFilePath",
  "signatureSha256",
  "verificationOutputPath",
  "verificationTool",
  "verificationCommand",
  "signerName",
  "certificateFingerprintSha256",
  "verified"
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

export function writePackageSigningReceipt(
  root = process.cwd(),
  options: PackageSigningReceiptOptions
): PackageSigningReceipt {
  const workspaceRoot = resolve(root);
  const proof = validateProof(options.proof);
  const packageOutputReceiptBytes = readFileSync(proof.packageOutputReceiptPath);
  const checksumReceiptBytes = readFileSync(proof.checksumReceiptPath);
  const signedArtifactBytes = readFileSync(proof.signedArtifactPath);
  const signatureFileBytes = readFileSync(proof.signatureFilePath);
  const verificationOutputBytes = readFileSync(proof.verificationOutputPath);
  const packageOutputReceiptSha256 = sha256(packageOutputReceiptBytes);
  const checksumReceiptSha256 = sha256(checksumReceiptBytes);
  const packageOutputProof = verifyPackageOutputReceipt(
    proof.adapterId,
    JSON.parse(packageOutputReceiptBytes.toString("utf8"))
  );
  const checksumReceipt = JSON.parse(checksumReceiptBytes.toString("utf8")) as ChecksumReceipt;

  validateFileHash(signedArtifactBytes, proof.signedArtifactSha256, "signed artifact");
  validateFileHash(signatureFileBytes, proof.signatureSha256, "signature file");
  validatePackageOutputProof(packageOutputProof, proof);
  validateChecksumReceipt(checksumReceipt, proof, packageOutputReceiptSha256);

  const receiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    proof.adapterId,
    "signing-latest.json"
  );
  const receipt: PackageSigningReceipt = {
    receipt: "dx.extension.package.signing",
    adapterId: proof.adapterId,
    host: proof.host,
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand: options.verificationCommand ?? "npm run smoke:package-signing:j1",
    receiptPath,
    packageOutput: {
      receiptPath: proof.packageOutputReceiptPath,
      receiptSha256: packageOutputReceiptSha256,
      checksumReceiptPath: proof.checksumReceiptPath,
      checksumReceiptSha256: checksumReceiptSha256,
      packageOutputSha256: proof.packageOutputSha256
    },
    signedArtifact: {
      path: proof.signedArtifactPath,
      sha256: proof.signedArtifactSha256
    },
    signature: {
      path: proof.signatureFilePath,
      sha256: proof.signatureSha256,
      tool: proof.verificationTool.trim(),
      verificationCommand: proof.verificationCommand.trim(),
      verificationOutputPath: proof.verificationOutputPath,
      verificationOutputSha256: sha256(verificationOutputBytes),
      signerName: proof.signerName.trim(),
      certificateFingerprintSha256: proof.certificateFingerprintSha256,
      verified: true
    },
    releaseClaims: {
      packageOutputVerified: true,
      releaseChecksumVerified: true,
      signingVerified: true,
      loadedHostVerified: false,
      distributionVerified: false,
      publicReleasePackageVerified: true
    }
  };

  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

  return receipt;
}

if (isDirectRun()) {
  try {
    const proofPath = process.env.DX_PACKAGE_SIGNING_PROOF_JSON;

    if (!proofPath) {
      throw new Error("DX_PACKAGE_SIGNING_PROOF_JSON must point to a package signing proof JSON file.");
    }

    const proofSource = JSON.parse(readFileSync(proofPath, "utf8")) as PackageSigningProof | PackageSigningProof[];
    const proofs = Array.isArray(proofSource) ? proofSource : [proofSource];

    for (const proof of proofs) {
      const receipt = writePackageSigningReceipt(process.cwd(), {
        proof,
        verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run smoke:package-signing:j1"
      });

      console.log(`Package signing receipt written: ${receipt.receiptPath}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function validateProof(proof: PackageSigningProof): PackageSigningProof {
  rejectUnexpectedProofKeys(proof);
  assertSafeAdapterId(proof.adapterId);
  assertNonEmpty(proof.host, "host");
  assertExistingAbsoluteFile(proof.packageOutputReceiptPath, "package output receipt");
  assertExistingAbsoluteFile(proof.checksumReceiptPath, "checksum receipt");
  assertSha256(proof.packageOutputSha256, "package output SHA-256");
  assertExistingAbsoluteFile(proof.signedArtifactPath, "signed artifact");
  assertSha256(proof.signedArtifactSha256, "signed artifact SHA-256");
  assertExistingAbsoluteFile(proof.signatureFilePath, "signature file");
  assertSha256(proof.signatureSha256, "signature SHA-256");
  assertExistingAbsoluteFile(proof.verificationOutputPath, "signature verification output");
  assertNonEmpty(proof.verificationTool, "verification tool");
  assertNonEmpty(proof.verificationCommand, "verification command");
  assertNonEmpty(proof.signerName, "signer name");
  assertSha256(proof.certificateFingerprintSha256, "certificate fingerprint SHA-256");

  if (proof.verified !== true) {
    throw new Error("Package signing proof must verify the package signature.");
  }

  return proof;
}

function rejectUnexpectedProofKeys(proof: PackageSigningProof): void {
  for (const key of Object.keys(proof)) {
    if (privacySensitiveProofKeys.has(key)) {
      throw new Error(`Package signing proof contains a privacy-sensitive package signing proof field: ${key}`);
    }

    if (!proofKeys.has(key)) {
      throw new Error(`Package signing proof contains an unsupported field: ${key}`);
    }
  }
}

function validatePackageOutputProof(
  packageOutputProof: ReturnType<typeof verifyPackageOutputReceipt>,
  proof: PackageSigningProof
): void {
  if (packageOutputProof.host !== proof.host) {
    throw new Error(`Package signing host mismatch for ${proof.adapterId}.`);
  }

  if (packageOutputProof.sha256 !== proof.packageOutputSha256) {
    throw new Error(`Package signing package output checksum mismatch for ${proof.adapterId}.`);
  }
}

function validateChecksumReceipt(
  checksumReceipt: ChecksumReceipt,
  proof: PackageSigningProof,
  packageOutputReceiptSha256: string
): void {
  if (checksumReceipt.receipt !== "dx.extension.release_package.checksum") {
    throw new Error(`Package signing checksum receipt must verify a release package checksum receipt for ${proof.adapterId}.`);
  }

  if (checksumReceipt.adapterId !== proof.adapterId) {
    throw new Error(`Package signing checksum receipt adapter mismatch for ${proof.adapterId}.`);
  }

  if (checksumReceipt.host !== proof.host) {
    throw new Error(`Package signing checksum receipt host mismatch for ${proof.adapterId}.`);
  }

  if (checksumReceipt.checksum?.algorithm !== "sha256") {
    throw new Error(`Package signing checksum receipt must use SHA-256 for ${proof.adapterId}.`);
  }

  if (checksumReceipt.checksum.scope !== "public-release-package") {
    throw new Error(`Package signing checksum receipt must verify a public release package checksum for ${proof.adapterId}.`);
  }

  const packageOutput = checksumReceipt.packageOutput;

  if (packageOutput?.packageOutputSha256 !== proof.packageOutputSha256) {
    throw new Error(`Package signing package output checksum mismatch for ${proof.adapterId}.`);
  }

  if (packageOutput.receiptPath !== proof.packageOutputReceiptPath) {
    throw new Error(`Package signing checksum receipt package-output receipt path mismatch for ${proof.adapterId}.`);
  }

  if (!isSha256(packageOutput.receiptSha256)) {
    throw new Error(`Package signing checksum receipt must link the package-output receipt hash for ${proof.adapterId}.`);
  }

  if (packageOutput.receiptSha256 !== packageOutputReceiptSha256) {
    throw new Error(`Package signing checksum receipt package-output receipt hash changed for ${proof.adapterId}.`);
  }

  if (checksumReceipt.releaseArtifact?.createdFromPackageOutput !== true) {
    throw new Error(`Package signing checksum receipt must link release artifact to package output for ${proof.adapterId}.`);
  }

  if (checksumReceipt.releaseArtifact.sha256 !== proof.signedArtifactSha256) {
    throw new Error(`Package signing release artifact checksum mismatch for ${proof.adapterId}.`);
  }

  if (checksumReceipt.checksum.sha256 !== proof.signedArtifactSha256) {
    throw new Error(`Package signing signed artifact checksum mismatch for ${proof.adapterId}.`);
  }

  if (
    checksumReceipt.releaseClaims?.publicReleasePackageVerified !== true ||
    checksumReceipt.releaseClaims.releaseChecksumVerified !== true
  ) {
    throw new Error(`Package signing checksum receipt must carry public release package claims for ${proof.adapterId}.`);
  }
}

function validateFileHash(bytes: Buffer, expectedSha256: string, label: string): void {
  if (sha256(bytes) !== expectedSha256) {
    throw new Error(`Package signing ${label} hash mismatch.`);
  }
}

function assertExistingAbsoluteFile(path: string, label: string): void {
  if (!isAbsolute(path)) {
    throw new Error(`Package signing ${label} must be an absolute path.`);
  }

  if (!existsSync(path)) {
    throw new Error(`Package signing ${label} does not exist: ${path}`);
  }
}

function assertNonEmpty(value: string, label: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Package signing ${label} is required.`);
  }
}

function assertSafeAdapterId(adapterId: string): void {
  if (!/^dx\.[a-z0-9][a-z0-9.-]*$/.test(adapterId) || adapterId.includes("..")) {
    throw new Error(`Package signing adapter id is unsafe: ${adapterId}`);
  }
}

function assertSha256(value: string, label: string): void {
  assertNonEmpty(value, label);

  if (!/^[0-9a-f]{64}$/.test(value)) {
    throw new Error(`Package signing ${label} must be a SHA-256 hex digest.`);
  }
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
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
