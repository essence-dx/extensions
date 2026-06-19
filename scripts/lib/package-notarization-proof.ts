import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";

export interface PackageNotarizationProof {
  adapterId: "dx.sketch.command-center";
  host: "sketch";
  signingReceiptPath: string;
  notarizationOutputPath: string;
  notarizationToolName: string;
  notarizationCommand: string;
  ticketIdSha256: string;
  artifactSha256: string;
  verified: boolean;
}

export interface PackageNotarizationSigningLink {
  checksumReceiptPath: string;
  checksumReceiptSha256: string;
  signedArtifactPath: string;
}

interface SigningReceipt {
  receipt?: unknown;
  adapterId?: unknown;
  host?: unknown;
  packageOutput?: {
    checksumReceiptPath?: unknown;
    checksumReceiptSha256?: unknown;
  };
  signedArtifact?: {
    path?: unknown;
    sha256?: unknown;
  };
  releaseClaims?: {
    signingVerified?: unknown;
    releaseChecksumVerified?: unknown;
    publicReleasePackageVerified?: unknown;
  };
}

const proofKeys = new Set([
  "adapterId",
  "host",
  "signingReceiptPath",
  "notarizationOutputPath",
  "notarizationToolName",
  "notarizationCommand",
  "ticketIdSha256",
  "artifactSha256",
  "verified"
]);
const privacySensitiveProofKeys = new Set([
  "accessToken",
  "apiKey",
  "appleId",
  "appleIdPassword",
  "clientSecret",
  "password",
  "secret",
  "teamId",
  "token"
]);

export function validatePackageNotarizationProof(
  proof: PackageNotarizationProof
): PackageNotarizationProof {
  rejectUnexpectedProofKeys(proof);

  if (proof.adapterId !== "dx.sketch.command-center" || proof.host !== "sketch") {
    throw new Error("Package notarization proof currently supports the Sketch adapter.");
  }

  assertExistingPackageNotarizationFile(proof.signingReceiptPath, "signing receipt");
  assertExistingPackageNotarizationFile(proof.notarizationOutputPath, "notarization output");
  assertNonEmpty(proof.notarizationToolName, "notarization tool name");
  assertNonEmpty(proof.notarizationCommand, "notarization command");
  assertSha256(proof.ticketIdSha256, "ticket id SHA-256");
  assertSha256(proof.artifactSha256, "artifact SHA-256");

  if (proof.verified !== true) {
    throw new Error("Package notarization proof must verify package notarization.");
  }

  return proof;
}

export function readPackageNotarizationSigningLink(
  receipt: unknown,
  proof: PackageNotarizationProof
): PackageNotarizationSigningLink {
  const signingReceipt = receipt as SigningReceipt;

  if (signingReceipt.receipt !== "dx.extension.package.signing") {
    throw new Error("Package notarization proof must link to a package signing receipt.");
  }

  if (signingReceipt.adapterId !== proof.adapterId || signingReceipt.host !== proof.host) {
    throw new Error("Package notarization signing receipt adapter or host mismatch.");
  }

  if (
    signingReceipt.releaseClaims?.signingVerified !== true ||
    signingReceipt.releaseClaims.releaseChecksumVerified !== true ||
    signingReceipt.releaseClaims.publicReleasePackageVerified !== true
  ) {
    throw new Error("Package notarization signing receipt must verify signing and release checksum claims.");
  }

  if (signingReceipt.signedArtifact?.sha256 !== proof.artifactSha256) {
    throw new Error("Package notarization artifact hash mismatch.");
  }

  if (typeof signingReceipt.signedArtifact.path !== "string" || signingReceipt.signedArtifact.path.trim() === "") {
    throw new Error("Package notarization signing receipt is missing signed artifact path.");
  }

  if (
    typeof signingReceipt.packageOutput?.checksumReceiptPath !== "string" ||
    typeof signingReceipt.packageOutput.checksumReceiptSha256 !== "string"
  ) {
    throw new Error("Package notarization signing receipt is missing checksum receipt linkage.");
  }

  assertExistingPackageNotarizationFile(signingReceipt.packageOutput.checksumReceiptPath, "checksum receipt");
  assertSha256(signingReceipt.packageOutput.checksumReceiptSha256, "checksum receipt SHA-256");

  return {
    checksumReceiptPath: signingReceipt.packageOutput.checksumReceiptPath,
    checksumReceiptSha256: signingReceipt.packageOutput.checksumReceiptSha256,
    signedArtifactPath: signingReceipt.signedArtifact.path
  };
}

export function assertExistingPackageNotarizationFile(
  path: unknown,
  label: string
): asserts path is string {
  if (typeof path !== "string" || !isAbsolute(path)) {
    throw new Error(`Package notarization ${label} must be an absolute path.`);
  }

  if (!existsSync(path)) {
    throw new Error(`Package notarization ${label} does not exist: ${path}`);
  }
}

function rejectUnexpectedProofKeys(proof: PackageNotarizationProof): void {
  for (const key of Object.keys(proof)) {
    if (privacySensitiveProofKeys.has(key)) {
      throw new Error(`Package notarization proof contains a privacy-sensitive package notarization proof field: ${key}`);
    }

    if (!proofKeys.has(key)) {
      throw new Error(`Package notarization proof contains an unsupported field: ${key}`);
    }
  }
}

function assertNonEmpty(value: unknown, label: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Package notarization ${label} is required.`);
  }
}

function assertSha256(value: unknown, label: string): void {
  assertNonEmpty(value, label);

  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
    throw new Error(`Package notarization ${label} must be a SHA-256 hex digest.`);
  }
}
