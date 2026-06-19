import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { ReleasePackageChecksumProof } from "./write-release-package-checksum-receipts.ts";

interface AdobeCcxReleaseChecksumTarget {
  adapterId: string;
  host: string;
}

interface AdobeCcxPackageReceipt {
  receipt?: unknown;
  adapterId?: unknown;
  host?: unknown;
  packageOutput?: unknown;
  ccxPackage?: unknown;
  releaseClaims?: unknown;
}

interface CcxPackageProof {
  artifactPath?: unknown;
  sha256?: unknown;
}

interface PackageOutputLink {
  receiptPath?: unknown;
  packageSha256?: unknown;
}

interface ReleaseClaims {
  packageOutputVerified?: unknown;
  ccxPackaged?: unknown;
}

export interface AdobeCcxReleaseChecksumProofOptions {
  proofPath?: string;
  adapterIds?: string[];
}

export interface AdobeCcxReleaseChecksumProofResult {
  proofPath: string;
  proofs: ReleasePackageChecksumProof[];
}

export const adobeCcxReleaseChecksumTargets: AdobeCcxReleaseChecksumTarget[] = [
  {
    adapterId: "dx.photoshop.command-center",
    host: "photoshop"
  },
  {
    adapterId: "dx.premiere-pro.command-center",
    host: "premiere-pro"
  },
  {
    adapterId: "dx.indesign.command-center",
    host: "indesign"
  }
];

export function buildAdobeCcxReleaseChecksumProofs(
  root = process.cwd(),
  options: AdobeCcxReleaseChecksumProofOptions = {}
): AdobeCcxReleaseChecksumProofResult {
  const workspaceRoot = resolve(root);
  const proofPath = resolve(
    workspaceRoot,
    options.proofPath ?? join(".tmp", "proofs", "adobe-ccx-release-checksums.json")
  );
  const proofs = selectTargets(options.adapterIds).map((target) =>
    buildProofForTarget(workspaceRoot, target)
  );

  mkdirSync(dirname(proofPath), { recursive: true });
  writeFileSync(proofPath, `${JSON.stringify(proofs, null, 2)}\n`);

  return {
    proofPath,
    proofs
  };
}

if (isDirectRun()) {
  try {
    const result = buildAdobeCcxReleaseChecksumProofs(process.cwd(), parseOptions(process.argv.slice(2)));
    console.log(`Adobe CCX release checksum proof written: ${result.proofPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function buildProofForTarget(
  workspaceRoot: string,
  target: AdobeCcxReleaseChecksumTarget
): ReleasePackageChecksumProof {
  const receiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    target.adapterId,
    "ccx-package-latest.json"
  );
  const receipt = JSON.parse(readFileSync(receiptPath, "utf8")) as AdobeCcxPackageReceipt;

  validateCcxReceiptIdentity(target, receipt);

  const packageOutput = expectRecord<PackageOutputLink>(receipt.packageOutput, "package-output link");
  const ccxPackage = expectRecord<CcxPackageProof>(receipt.ccxPackage, "CCX package proof");
  const packageOutputReceiptPath = expectAbsoluteFilePath(packageOutput.receiptPath, "package-output receipt path");
  const releaseArtifactPath = expectAbsoluteFilePath(ccxPackage.artifactPath, "CCX artifact path");
  const releaseArtifactSha256 = expectSha256(ccxPackage.sha256, "CCX artifact SHA-256");

  if (sha256(readFileSync(releaseArtifactPath)) !== releaseArtifactSha256) {
    throw new Error(`Adobe CCX release checksum artifact hash changed for ${target.adapterId}.`);
  }

  return {
    adapterId: target.adapterId,
    host: target.host,
    packageOutputReceiptPath,
    packageOutputSha256: expectSha256(packageOutput.packageSha256, "package-output SHA-256"),
    releaseArtifactPath,
    releaseArtifactSha256,
    releaseArtifactKind: "ccx",
    artifactCreatedFromPackageOutput: true
  };
}

function validateCcxReceiptIdentity(
  target: AdobeCcxReleaseChecksumTarget,
  receipt: AdobeCcxPackageReceipt
): void {
  const releaseClaims = expectRecord<ReleaseClaims>(receipt.releaseClaims, "release claims");

  if (
    receipt.receipt !== "dx.extension.adobe_uxp.ccx_package" ||
    receipt.adapterId !== target.adapterId ||
    receipt.host !== target.host ||
    releaseClaims.packageOutputVerified !== true ||
    releaseClaims.ccxPackaged !== true
  ) {
    throw new Error(`Adobe CCX release checksum requires a valid CCX package receipt for ${target.adapterId}.`);
  }
}

function parseOptions(args: string[]): AdobeCcxReleaseChecksumProofOptions {
  const options: AdobeCcxReleaseChecksumProofOptions = {};
  const adapterIds: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--proof-json") {
      options.proofPath = readOptionValue(args, index, argument);
      index += 1;
      continue;
    }

    if (argument === "--adapter-id") {
      adapterIds.push(readOptionValue(args, index, argument));
      index += 1;
      continue;
    }

    throw new Error(`Unsupported Adobe CCX release checksum argument: ${argument}`);
  }

  if (adapterIds.length > 0) {
    options.adapterIds = adapterIds;
  }

  return options;
}

function readOptionValue(args: string[], index: number, argument: string): string {
  const value = args[index + 1];

  if (!value) {
    throw new Error(`${argument} requires a value`);
  }

  return value;
}

function selectTargets(adapterIds: string[] | undefined): AdobeCcxReleaseChecksumTarget[] {
  if (!adapterIds || adapterIds.length === 0) {
    return adobeCcxReleaseChecksumTargets;
  }

  const requestedIds = new Set<string>();

  for (const adapterId of adapterIds) {
    const normalizedAdapterId = adapterId.trim();

    if (!/^[a-z0-9.-]+$/.test(normalizedAdapterId)) {
      throw new Error(`Adobe CCX release checksum adapter id is unsafe: ${adapterId}`);
    }

    requestedIds.add(normalizedAdapterId);
  }

  const selectedTargets = adobeCcxReleaseChecksumTargets.filter((target) =>
    requestedIds.has(target.adapterId)
  );
  const selectedIds = new Set(selectedTargets.map((target) => target.adapterId));
  const unsupportedIds = [...requestedIds].filter((adapterId) => !selectedIds.has(adapterId));

  if (unsupportedIds.length > 0) {
    throw new Error(`Adobe CCX release checksum adapter id is unsupported: ${unsupportedIds.join(", ")}`);
  }

  return selectedTargets;
}

function expectRecord<T extends Record<string, unknown>>(value: unknown, label: string): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Adobe CCX release checksum receipt is missing ${label}.`);
  }

  return value as T;
}

function expectAbsoluteFilePath(value: unknown, label: string): string {
  if (typeof value !== "string" || !isAbsolute(value)) {
    throw new Error(`Adobe CCX release checksum ${label} must be an absolute path.`);
  }

  return value;
}

function expectSha256(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`Adobe CCX release checksum ${label} must be a SHA-256 hex digest.`);
  }

  return value;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function isDirectRun(): boolean {
  return process.argv[1] ? normalize(process.argv[1]) === normalize(fileURLToPath(import.meta.url)) : false;
}
