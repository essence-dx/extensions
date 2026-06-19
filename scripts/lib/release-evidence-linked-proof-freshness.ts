import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { verifyPackageOutputReceipt } from "./package-output-proof.ts";
import { classifyPackageOutputWeakness } from "./release-evidence-package-output-classifier.ts";
import {
  type ReceiptRecord,
  isNonEmptyString,
  isPositiveInteger,
  isSha256,
  readRecordField
} from "./release-evidence-receipt-primitives.ts";

export function classifyLinkedPackageOutputWeakness(
  receipt: ReceiptRecord,
  label: string
): string | undefined {
  return classifyLinkedPackageReceiptWeakness(
    readRecordField(receipt, "packageOutput"),
    receipt.adapterId,
    label,
    "package_output",
    "package-output"
  );
}

export function classifyLinkedPackageReceiptWeakness(
  packageOutput: ReceiptRecord | undefined,
  adapterId: unknown,
  label: string,
  kind: "package_output" | "content_package",
  linkLabel = "package"
): string | undefined {
  if (
    !isNonEmptyString(packageOutput?.receiptPath) ||
    !isSha256(packageOutput.receiptSha256) ||
    !isSha256(packageOutput.packageSha256)
  ) {
    return `${label} receipt is missing ${linkLabel} linkage`;
  }

  if (!existsSync(packageOutput.receiptPath)) {
    return `${label} linked ${linkLabel} receipt does not exist: ${packageOutput.receiptPath}`;
  }

  const receiptBytes = readFileSync(packageOutput.receiptPath);

  if (sha256(receiptBytes) !== packageOutput.receiptSha256) {
    return `${label} linked ${linkLabel} receipt hash changed`;
  }

  let packageOutputReceipt: ReceiptRecord;

  try {
    const parsedReceipt = JSON.parse(receiptBytes.toString("utf8"));

    if (!isRecord(parsedReceipt)) {
      return `${label} linked ${linkLabel} receipt is not a JSON object`;
    }

    packageOutputReceipt = parsedReceipt;
  } catch {
    return `${label} linked ${linkLabel} receipt is not readable JSON`;
  }

  const packageOutputWeakness = classifyPackageOutputWeakness(kind, packageOutputReceipt);

  if (packageOutputWeakness) {
    return `${label} linked ${linkLabel} receipt is weak: ${packageOutputWeakness}`;
  }

  let packageOutputProof;

  try {
    packageOutputProof = verifyPackageOutputReceipt(String(adapterId), packageOutputReceipt);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return `${label} linked ${linkLabel} receipt is invalid: ${message}`;
  }

  if (packageOutputProof.sha256 !== packageOutput.packageSha256) {
    return `${label} linked ${linkLabel} aggregate hash changed`;
  }

  return undefined;
}

export function classifyManualProofWeakness(
  receipt: ReceiptRecord,
  label: string
): string | undefined {
  const manualProof = readRecordField(receipt, "manualProof");

  if (!isNonEmptyString(manualProof?.proofFilePath) || !isSha256(manualProof.proofFileSha256)) {
    return `${label} receipt is missing manual proof linkage`;
  }

  if (!existsSync(manualProof.proofFilePath)) {
    return `${label} manual proof file does not exist: ${manualProof.proofFilePath}`;
  }

  const proofBytes = readFileSync(manualProof.proofFilePath);

  if (sha256(proofBytes) !== manualProof.proofFileSha256) {
    return `${label} manual proof file hash changed`;
  }

  return undefined;
}

export function classifyLinkedReceiptWeakness(
  link: ReceiptRecord | undefined,
  label: string
): string | undefined {
  if (!isNonEmptyString(link?.receiptPath) || !isSha256(link.receiptSha256)) {
    return `${label} receipt is missing receipt linkage`;
  }

  if (!existsSync(link.receiptPath)) {
    return `${label} receipt does not exist: ${link.receiptPath}`;
  }

  const receiptBytes = readFileSync(link.receiptPath);

  if (sha256(receiptBytes) !== link.receiptSha256) {
    return `${label} receipt hash changed`;
  }

  return undefined;
}

export function classifyCurrentFileProofWeakness(
  filePath: unknown,
  expectedBytes: unknown,
  expectedSha256: unknown,
  label: string
): string | undefined {
  if (!isNonEmptyString(filePath) || !isPositiveInteger(expectedBytes) || !isSha256(expectedSha256)) {
    return `${label} receipt is missing current file proof`;
  }

  if (!existsSync(filePath)) {
    return `${label} file does not exist: ${filePath}`;
  }

  const bytes = readFileSync(filePath);

  if (bytes.length !== expectedBytes) {
    return `${label} file size changed`;
  }

  if (sha256(bytes) !== expectedSha256) {
    return `${label} file hash changed`;
  }

  return undefined;
}

export function classifyCurrentSha256FileProofWeakness(
  filePath: unknown,
  expectedSha256: unknown,
  label: string
): string | undefined {
  if (!isNonEmptyString(filePath) || !isSha256(expectedSha256)) {
    return `${label} receipt is missing current file proof`;
  }

  if (!existsSync(filePath)) {
    return `${label} file does not exist: ${filePath}`;
  }

  if (sha256(readFileSync(filePath)) !== expectedSha256) {
    return `${label} file hash changed`;
  }

  return undefined;
}

function isRecord(value: unknown): value is ReceiptRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
