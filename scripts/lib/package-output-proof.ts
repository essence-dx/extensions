import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, sep } from "node:path";

import {
  classifyPackageSourceInputWeakness
} from "./source-input-proof.ts";

export interface PackageOutputProof {
  host: string;
  payloadKind: "package" | "bundle";
  root: string;
  fileCount: number;
  filesVerified: number;
  sha256: string;
  releaseClaimKeys: string[];
}

interface PackageOutputReceipt {
  receipt?: unknown;
  adapterId?: unknown;
  host?: unknown;
  package?: unknown;
  bundle?: unknown;
  sourceRoot?: unknown;
  sourceInputs?: unknown;
  sourceSha256?: unknown;
  releaseClaims?: unknown;
}

interface PackagePayload {
  root?: unknown;
  fileCount?: unknown;
  sha256?: unknown;
  files?: unknown;
}

interface PackageOutputFile {
  relativePath: string;
  bytes: number;
  sha256: string;
}

export function verifyPackageOutputReceipt(
  adapterId: string,
  receipt: PackageOutputReceipt
): PackageOutputProof {
  if (receipt.adapterId !== adapterId) {
    throw new Error(`package output receipt adapter mismatch for ${adapterId}`);
  }

  const host = expectNonEmptyString(receipt.host, `package output receipt host for ${adapterId}`);
  const payloadKind = receipt.package ? "package" : receipt.bundle ? "bundle" : undefined;

  if (!payloadKind) {
    throw new Error(`package output receipt for ${adapterId} must contain package or bundle payload`);
  }

  const payload = (payloadKind === "package" ? receipt.package : receipt.bundle) as PackagePayload;
  const root = expectNonEmptyString(payload.root, `package output root for ${adapterId}`);
  const fileCount = expectPositiveInteger(payload.fileCount, `package output fileCount for ${adapterId}`);
  const sha256 = expectSha256(payload.sha256, `package output sha256 for ${adapterId}`);
  const files = readReceiptFiles(adapterId, payload.files);

  if (fileCount !== files.length) {
    throw new Error(`package output fileCount mismatch for ${adapterId}`);
  }

  const verifiedFiles = files.map((file) => verifyPackageOutputFile(adapterId, root, file));
  const actualSha256 = hashPackageFiles(verifiedFiles);

  if (actualSha256 !== sha256) {
    throw new Error(`package output aggregate hash changed for ${adapterId}`);
  }

  validatePackageOutputSourceInputs(adapterId, receipt);

  return {
    host,
    payloadKind,
    root,
    fileCount,
    filesVerified: verifiedFiles.length,
    sha256,
    releaseClaimKeys: validateReleaseClaims(adapterId, receipt.releaseClaims)
  };
}

function validatePackageOutputSourceInputs(adapterId: string, receipt: PackageOutputReceipt): void {
  const weakness = classifyPackageOutputSourceInputWeakness(adapterId, receipt);

  if (weakness) {
    throw new Error(weakness);
  }
}

function classifyPackageOutputSourceInputWeakness(
  adapterId: string,
  receipt: PackageOutputReceipt
): string | undefined {
  return classifyPackageSourceInputWeakness(adapterId, receipt);
}

function validateReleaseClaims(adapterId: string, claims: unknown): string[] {
  if (!claims || typeof claims !== "object" || Array.isArray(claims)) {
    throw new Error(`package output receipt for ${adapterId} must contain release claims`);
  }

  const claimEntries = Object.entries(claims);
  if (claimEntries.length === 0) {
    throw new Error(`package output receipt for ${adapterId} must contain release claims`);
  }

  const trueClaims = claimEntries
    .filter(([, value]) => value === true)
    .map(([key]) => key);

  if (trueClaims.length > 0) {
    throw new Error(
      `package output receipt for ${adapterId} must not contain true release claims: ${trueClaims.join(", ")}`
    );
  }

  for (const [key, value] of claimEntries) {
    if (value !== false) {
      throw new Error(`package output release claim for ${adapterId} must be false: ${key}`);
    }
  }

  return claimEntries.map(([key]) => key).sort();
}

function readReceiptFiles(adapterId: string, value: unknown): PackageOutputFile[] {
  if (!Array.isArray(value)) {
    throw new Error(`package output files for ${adapterId} must be an array`);
  }

  return value.map((file) => ({
    relativePath: expectSafeRelativePath(file?.relativePath, `package output relativePath for ${adapterId}`),
    bytes: expectPositiveInteger(file?.bytes, `package output bytes for ${adapterId}`),
    sha256: expectSha256(file?.sha256, `package output file sha256 for ${adapterId}`)
  }));
}

function verifyPackageOutputFile(
  adapterId: string,
  packageRoot: string,
  file: PackageOutputFile
): PackageOutputFile {
  const bytes = readFileSync(join(packageRoot, ...file.relativePath.split("/")));
  const actualSha256 = createHash("sha256").update(bytes).digest("hex");

  if (actualSha256 !== file.sha256) {
    throw new Error(`package output file hash changed for ${adapterId}: ${file.relativePath}`);
  }

  if (bytes.length !== file.bytes) {
    throw new Error(`package output file size changed for ${adapterId}: ${file.relativePath}`);
  }

  return {
    relativePath: file.relativePath,
    bytes: bytes.length,
    sha256: actualSha256
  };
}

function hashPackageFiles(files: PackageOutputFile[]): string {
  const hash = createHash("sha256");

  for (const file of files) {
    hash.update(file.relativePath);
    hash.update("\0");
    hash.update(file.sha256);
    hash.update("\0");
    hash.update(String(file.bytes));
    hash.update("\n");
  }

  return hash.digest("hex");
}

function expectNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }

  return value;
}

function expectPositiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }

  return value;
}

function expectSha256(value: unknown, label: string): string {
  const hash = expectNonEmptyString(value, label);

  if (!/^[0-9a-f]{64}$/.test(hash)) {
    throw new Error(`${label} must be a SHA-256 hex digest`);
  }

  return hash;
}

function expectSafeRelativePath(value: unknown, label: string): string {
  const relativePath = expectNonEmptyString(value, label).split(sep).join("/");

  if (
    relativePath.includes(":") ||
    relativePath.includes("\\") ||
    relativePath.includes("://") ||
    relativePath.startsWith("/") ||
    relativePath.startsWith("~") ||
    relativePath.split("/").includes("..")
  ) {
    throw new Error(`${label} must be a safe relative path`);
  }

  return relativePath;
}
