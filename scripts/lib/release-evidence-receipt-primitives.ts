export type ReceiptRecord = Record<string, unknown>;

export function readRecordField(
  value: ReceiptRecord | undefined,
  key: string
): ReceiptRecord | undefined {
  if (!value) {
    return undefined;
  }

  return isRecord(value[key]) ? value[key] : undefined;
}

export function readStringArrayField(value: ReceiptRecord, key: string): string[] {
  const field = value[key];

  return Array.isArray(field) && field.every((item) => typeof item === "string") ? field : [];
}

export function readRecordArray(value: unknown): ReceiptRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

export function hasReceiptShaLink(link: ReceiptRecord | undefined): boolean {
  return isNonEmptyString(link?.receiptPath) && isSha256(link.receiptSha256);
}

export function hasReleasePackageOutputLink(receipt: ReceiptRecord): boolean {
  const packageOutput = readRecordField(receipt, "packageOutput");

  return hasReceiptShaLink(packageOutput) && isSha256(packageOutput?.packageSha256);
}

export function hasManualProofLink(receipt: ReceiptRecord): boolean {
  const manualProof = readRecordField(receipt, "manualProof");

  return isNonEmptyString(manualProof?.proofFilePath) && isSha256(manualProof.proofFileSha256);
}

export function hasCommandResults(value: unknown): boolean {
  const results = readRecordArray(value);

  return (
    results.length > 0 &&
    results.every(
      (result) =>
        isNonEmptyString(result.commandId) &&
        ["clicked", "proof-blocked", "visible"].includes(String(result.status))
    )
  );
}

export function hasSafePackageFileProof(file: ReceiptRecord): boolean {
  return (
    isSafeRelativePath(file.relativePath) &&
    isPositiveInteger(file.bytes) &&
    isSha256(file.sha256)
  );
}

export function hasStringList(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && value.every((item) => isNonEmptyString(item));
}

export function hasOnlyFalseReleaseClaims(claims: ReceiptRecord | undefined): boolean {
  if (!claims) {
    return false;
  }

  const entries = Object.entries(claims);

  return entries.length > 0 && entries.every(([, value]) => value === false);
}

export function isAdapterId(value: unknown): value is string {
  return typeof value === "string" && /^dx\.[a-z0-9][a-z0-9.-]*$/.test(value) && !value.includes("..");
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

export function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && value > 0;
}

export function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

export function isRecord(value: unknown): value is ReceiptRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSafeRelativePath(value: unknown): boolean {
  if (typeof value !== "string" || value.trim() === "") {
    return false;
  }

  return (
    !value.includes("\\") &&
    !value.includes("://") &&
    !value.startsWith("/") &&
    !value.startsWith("~") &&
    !value.split("/").includes("..")
  );
}
