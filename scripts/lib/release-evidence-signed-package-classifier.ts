import { readFileSync } from "node:fs";

import {
  classifyCurrentFileProofWeakness,
  classifyCurrentSha256FileProofWeakness,
  classifyLinkedReceiptWeakness
} from "./release-evidence-linked-proof-freshness.ts";
import { classifyPackageOutputWeakness } from "./release-evidence-package-output-classifier.ts";
import {
  type ReceiptRecord,
  isNonEmptyString,
  isPositiveInteger,
  isSha256,
  readRecordField
} from "./release-evidence-receipt-primitives.ts";
import { verifyPackageOutputReceipt } from "./package-output-proof.ts";

export interface SignedPackageEvidenceContext {
  expectedAdapterId?: unknown;
  expectedHost?: unknown;
  expectedArtifactSha256?: unknown;
}

export function classifyPackageSigningReceiptWeakness(
  receipt: ReceiptRecord | undefined,
  context: SignedPackageEvidenceContext = {}
): string | undefined {
  if (receipt?.receipt !== "dx.extension.package.signing") {
    return "signing receipt is not a package signing receipt";
  }

  const identityWeakness = classifySignedPackageIdentityWeakness(receipt, context, "signing receipt");

  if (identityWeakness) {
    return identityWeakness;
  }

  const releaseClaims = readRecordField(receipt, "releaseClaims");

  if (
    releaseClaims?.publicReleasePackageVerified !== true ||
    releaseClaims.releaseChecksumVerified !== true ||
    releaseClaims.signingVerified !== true
  ) {
    return "signing receipt is not linked to a public release package";
  }

  const packageOutput = readRecordField(receipt, "packageOutput");
  const signedArtifact = readRecordField(receipt, "signedArtifact");
  const signature = readRecordField(receipt, "signature");

  if (
    !isNonEmptyString(packageOutput?.receiptPath) ||
    !isSha256(packageOutput.receiptSha256) ||
    !isSha256(packageOutput.packageOutputSha256)
  ) {
    return "signing receipt is missing package output checksum linkage";
  }

  if (!isNonEmptyString(packageOutput.checksumReceiptPath) || !isSha256(packageOutput.checksumReceiptSha256)) {
    return "signing receipt is missing release checksum receipt linkage";
  }

  if (!isNonEmptyString(signedArtifact?.path) || !isSha256(signedArtifact.sha256)) {
    return "signing receipt is missing signed artifact checksum";
  }

  if (isSha256(context.expectedArtifactSha256) && signedArtifact.sha256 !== context.expectedArtifactSha256) {
    return "signing signed artifact checksum does not match expected artifact proof";
  }

  if (
    signature?.verified !== true ||
    !isNonEmptyString(signature.path) ||
    !isSha256(signature.sha256) ||
    !isNonEmptyString(signature.verificationOutputPath) ||
    !isSha256(signature.verificationOutputSha256)
  ) {
    return "signing receipt is missing verified signature proof";
  }

  return (
    classifyLinkedReceiptWeakness(
      {
        receiptPath: packageOutput.receiptPath,
        receiptSha256: packageOutput.receiptSha256
      },
      "signing package-output"
    ) ??
    classifyLinkedReceiptWeakness(
      {
        receiptPath: packageOutput.checksumReceiptPath,
        receiptSha256: packageOutput.checksumReceiptSha256
      },
      "signing checksum"
    ) ??
    classifyCurrentSha256FileProofWeakness(
      signedArtifact.path,
      signedArtifact.sha256,
      "signing signed artifact"
    ) ??
    classifyCurrentSha256FileProofWeakness(signature.path, signature.sha256, "signing signature") ??
    classifyCurrentSha256FileProofWeakness(
      signature.verificationOutputPath,
      signature.verificationOutputSha256,
      "signing signature verification output"
    ) ??
    classifyLinkedChecksumReceiptContentWeakness(
      packageOutput.checksumReceiptPath,
      signedArtifact.sha256,
      context
    )
  );
}

export function classifyReleasePackageChecksumReceiptWeakness(
  receipt: ReceiptRecord | undefined,
  context: SignedPackageEvidenceContext = {}
): string | undefined {
  if (receipt?.receipt !== "dx.extension.release_package.checksum") {
    return "checksum receipt is not a release package checksum receipt";
  }

  const checksum = readRecordField(receipt, "checksum");

  if (checksum?.scope === "package-output") {
    return "package-output checksum is not public release artifact checksum";
  }

  const identityWeakness = classifySignedPackageIdentityWeakness(receipt, context, "checksum receipt");

  if (identityWeakness) {
    return identityWeakness;
  }

  if (checksum?.algorithm !== "sha256") {
    return "checksum receipt does not use sha256";
  }

  if (checksum.scope !== "public-release-package") {
    return "checksum receipt does not verify a public release package";
  }

  const releaseClaims = readRecordField(receipt, "releaseClaims");

  if (
    releaseClaims?.publicReleasePackageVerified !== true ||
    releaseClaims.releaseChecksumVerified !== true
  ) {
    return "checksum receipt does not verify a public release package";
  }

  const packageOutput = readRecordField(receipt, "packageOutput");
  const releaseArtifact = readRecordField(receipt, "releaseArtifact");

  if (!isSha256(packageOutput?.packageOutputSha256)) {
    return "checksum receipt is missing package output checksum linkage";
  }

  const linkedPackageOutputWeakness = classifyChecksumLinkedPackageOutputWeakness(packageOutput);

  if (linkedPackageOutputWeakness) {
    return linkedPackageOutputWeakness;
  }

  if (releaseArtifact?.createdFromPackageOutput !== true) {
    return "checksum receipt does not link release artifact to package output";
  }

  if (
    !isNonEmptyString(releaseArtifact.path) ||
    !isPositiveInteger(releaseArtifact.bytes) ||
    !isPositiveInteger(checksum.bytes) ||
    !isSha256(releaseArtifact.sha256) ||
    !isSha256(checksum.sha256)
  ) {
    return "checksum receipt is missing public release artifact checksum";
  }

  if (releaseArtifact.bytes !== checksum.bytes) {
    return "checksum receipt release artifact byte count does not match checksum proof";
  }

  if (releaseArtifact.sha256 !== checksum.sha256) {
    return "checksum receipt release artifact checksum does not match checksum proof";
  }

  if (isSha256(context.expectedArtifactSha256) && releaseArtifact.sha256 !== context.expectedArtifactSha256) {
    return "checksum release artifact checksum does not match expected artifact proof";
  }

  return classifyCurrentFileProofWeakness(
    releaseArtifact.path,
    releaseArtifact.bytes,
    releaseArtifact.sha256,
    "checksum release artifact"
  );
}

function classifySignedPackageIdentityWeakness(
  receipt: ReceiptRecord,
  context: SignedPackageEvidenceContext,
  label: string
): string | undefined {
  if (
    isNonEmptyString(context.expectedAdapterId) &&
    isNonEmptyString(context.expectedHost) &&
    (receipt.adapterId !== context.expectedAdapterId || receipt.host !== context.expectedHost)
  ) {
    return `${label} is not linked to the expected adapter`;
  }

  return undefined;
}

function classifyChecksumLinkedPackageOutputWeakness(
  packageOutput: ReceiptRecord | undefined
): string | undefined {
  if (
    !isNonEmptyString(packageOutput?.receiptPath) ||
    !isSha256(packageOutput.receiptSha256) ||
    !isPositiveInteger(packageOutput.fileCount) ||
    !isPositiveInteger(packageOutput.filesVerified)
  ) {
    return "checksum receipt is missing package-output receipt linkage";
  }

  const receiptWeakness = classifyLinkedReceiptWeakness(
    {
      receiptPath: packageOutput.receiptPath,
      receiptSha256: packageOutput.receiptSha256
    },
    "checksum linked package-output"
  );

  if (receiptWeakness) {
    return receiptWeakness;
  }

  let receipt: ReceiptRecord;

  try {
    const parsedReceipt = JSON.parse(readFileSync(packageOutput.receiptPath, "utf8"));

    if (!isReceiptRecord(parsedReceipt)) {
      return "checksum linked package-output receipt is not a JSON object";
    }

    receipt = parsedReceipt;
  } catch {
    return "checksum linked package-output receipt is not readable JSON";
  }

  const packageOutputWeakness = classifyPackageOutputWeakness("package_output", receipt);

  if (packageOutputWeakness) {
    return `checksum linked package-output receipt is weak: ${packageOutputWeakness}`;
  }

  let proof;

  try {
    proof = verifyPackageOutputReceipt(String(receipt.adapterId), receipt);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return `checksum linked package-output receipt is invalid: ${message}`;
  }

  if (proof.sha256 !== packageOutput.packageOutputSha256) {
    return "checksum linked package-output aggregate hash changed";
  }

  if (proof.filesVerified !== packageOutput.filesVerified || proof.filesVerified !== packageOutput.fileCount) {
    return "checksum linked package-output file count changed";
  }

  return undefined;
}

function classifyLinkedChecksumReceiptContentWeakness(
  checksumReceiptPath: string,
  signedArtifactSha256: string,
  context: SignedPackageEvidenceContext
): string | undefined {
  let receipt: ReceiptRecord;

  try {
    const parsedReceipt = JSON.parse(readFileSync(checksumReceiptPath, "utf8"));

    if (!isReceiptRecord(parsedReceipt)) {
      return "signing checksum receipt is weak: checksum receipt is not a JSON object";
    }

    receipt = parsedReceipt;
  } catch {
    return "signing checksum receipt is weak: checksum receipt is not readable JSON";
  }

  const checksumReceiptWeakness = classifyReleasePackageChecksumReceiptWeakness(receipt, {
    ...context,
    expectedArtifactSha256: signedArtifactSha256
  });

  return checksumReceiptWeakness ? `signing checksum receipt is weak: ${checksumReceiptWeakness}` : undefined;
}

function isReceiptRecord(value: unknown): value is ReceiptRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
