import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyPackageOutputReceipt } from "./lib/package-output-proof.ts";
import { parseTomlDocument } from "./lib/toml-lite.ts";
import {
  type EvidenceReceiptRequirement,
  parseEvidenceReceiptRequirement
} from "./release-evidence-requirements.ts";
import { validateReleaseEvidenceGates } from "./validate-release-evidence-gates.ts";

export type DistributionReviewKind =
  | "distribution_review"
  | "marketplace_review"
  | "community_review"
  | "canva_review"
  | "appsource_review"
  | "gallery_review"
  | "oauth_review";

export type BrowserStoreTarget =
  | "chrome_web_store"
  | "edge_add_ons"
  | "firefox_amo";

export interface DistributionReviewProof {
  adapterId: string;
  host: string;
  reviewKind: DistributionReviewKind;
  receiptPath: string;
  proofFilePath: string;
  signingReceiptPath?: string;
  checksumReceiptPath?: string;
  reviewSystem: string;
  reviewStatus: "approved";
  decidedAt: string;
  submissionIdSha256: string;
  reviewRecordSha256: string;
  publicListingHost?: string;
  browserStoreTargets?: BrowserStoreTarget[];
}

export interface DistributionReviewReceiptOptions {
  generatedAt?: Date | string;
  verificationCommand?: string;
  proof: DistributionReviewProof;
}

export interface DistributionReviewReceipt {
  receipt: "dx.extension.distribution_review";
  adapterId: string;
  host: string;
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  review: {
    reviewKind: DistributionReviewKind;
    reviewKinds: DistributionReviewKind[];
    reviewSystem: string;
    reviewStatus: "approved";
    decidedAt: string;
    submissionIdSha256: string;
    reviewRecordSha256: string;
    publicListingHost?: string;
    browserStoreTargets?: BrowserStoreTarget[];
  };
  manualProof: {
    proofFilePath: string;
    proofFileSha256: string;
  };
  linkedReceipts?: {
    signingReceiptPath: string;
    signingReceiptSha256: string;
    checksumReceiptPath: string;
    checksumReceiptSha256: string;
  };
  releaseClaims: {
    reviewVerified: true;
    distributionVerified: boolean;
    oauthReviewVerified: boolean;
    signingVerified: boolean;
    releaseChecksumVerified: boolean;
    publicReleasePackageVerified: boolean;
  };
}

interface ReleaseGateEntry {
  id: string;
  required_evidence: string[];
  evidence_receipt_requirements: string[];
}

interface LinkedReceipt {
  receipt?: unknown;
  adapterId?: unknown;
  host?: unknown;
  packageOutput?: unknown;
  releaseArtifact?: unknown;
  checksum?: unknown;
  signedArtifact?: unknown;
  signature?: unknown;
  releaseClaims?: {
    packageOutputVerified?: unknown;
    publicReleasePackageVerified?: unknown;
    releaseChecksumVerified?: unknown;
    signingVerified?: unknown;
  };
}

const releaseGatesRelativePath = "registry/release-evidence-gates.toml";
const reviewKinds = new Set<DistributionReviewKind>([
  "distribution_review",
  "marketplace_review",
  "community_review",
  "canva_review",
  "appsource_review",
  "gallery_review",
  "oauth_review"
]);
const releasePackageReviewKinds = new Set<DistributionReviewKind>([
  "distribution_review",
  "marketplace_review",
  "community_review",
  "canva_review",
  "appsource_review",
  "gallery_review"
]);
const browserCommandCenterAdapterId = "dx.browser.command-center";
const requiredBrowserStoreTargets: BrowserStoreTarget[] = [
  "chrome_web_store",
  "edge_add_ons",
  "firefox_amo"
];
const proofKeys = new Set([
  "adapterId",
  "host",
  "reviewKind",
  "receiptPath",
  "proofFilePath",
  "signingReceiptPath",
  "checksumReceiptPath",
  "reviewSystem",
  "reviewStatus",
  "decidedAt",
  "submissionIdSha256",
  "reviewRecordSha256",
  "publicListingHost",
  "browserStoreTargets"
]);
const privacySensitiveProofKeys = new Set([
  "accessToken",
  "apiKey",
  "approvalUrl",
  "authToken",
  "certificatePassword",
  "clientSecret",
  "email",
  "password",
  "privateKey",
  "rawReview",
  "secret",
  "token",
  "url",
  "userId"
]);

export function writeDistributionReviewReceipt(
  root = process.cwd(),
  options: DistributionReviewReceiptOptions
): DistributionReviewReceipt {
  const workspaceRoot = resolve(root);
  const gateFailures = validateReleaseEvidenceGates(workspaceRoot);

  if (gateFailures.length > 0) {
    throw new Error(gateFailures.join("\n"));
  }

  const proof = validateProof(options.proof);
  const browserStoreTargets = validateBrowserStoreTargets(proof);
  const reviewKindsForReceipt = resolveReviewKinds(workspaceRoot, proof);
  const proofFileBytes = readFileSync(proof.proofFilePath);
  validateProofFileBytes(proofFileBytes);
  const linkedReceipts = releasePackageReviewKinds.has(proof.reviewKind)
    ? validateLinkedReceipts(proof)
    : undefined;
  const receiptPath = join(workspaceRoot, ...proof.receiptPath.split("/"));
  const receipt: DistributionReviewReceipt = {
    receipt: "dx.extension.distribution_review",
    adapterId: proof.adapterId,
    host: proof.host,
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand: options.verificationCommand ?? "npm run smoke:distribution-review:j1",
    receiptPath,
    review: {
      reviewKind: proof.reviewKind,
      reviewKinds: reviewKindsForReceipt,
      reviewSystem: proof.reviewSystem.trim(),
      reviewStatus: "approved",
      decidedAt: proof.decidedAt,
      submissionIdSha256: proof.submissionIdSha256,
      reviewRecordSha256: proof.reviewRecordSha256,
      ...(proof.publicListingHost ? { publicListingHost: proof.publicListingHost.trim() } : {}),
      ...(browserStoreTargets.length > 0 ? { browserStoreTargets } : {})
    },
    manualProof: {
      proofFilePath: proof.proofFilePath,
      proofFileSha256: sha256(proofFileBytes)
    },
    ...(linkedReceipts ? { linkedReceipts } : {}),
    releaseClaims: {
      reviewVerified: true,
      distributionVerified: reviewKindsForReceipt.includes("distribution_review"),
      oauthReviewVerified: proof.reviewKind === "oauth_review",
      signingVerified: Boolean(linkedReceipts),
      releaseChecksumVerified: Boolean(linkedReceipts),
      publicReleasePackageVerified: Boolean(linkedReceipts)
    }
  };

  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

  return receipt;
}

if (isDirectRun()) {
  try {
    const proofPath = process.env.DX_DISTRIBUTION_REVIEW_PROOF_JSON;

    if (!proofPath) {
      throw new Error("DX_DISTRIBUTION_REVIEW_PROOF_JSON must point to a distribution review proof JSON file.");
    }

    assertExistingAbsoluteFile(proofPath, "proof JSON");
    const proofSource = JSON.parse(readFileSync(proofPath, "utf8")) as
      | DistributionReviewProof
      | DistributionReviewProof[];
    const proofs = Array.isArray(proofSource) ? proofSource : [proofSource];

    for (const proof of proofs) {
      const receipt = writeDistributionReviewReceipt(process.cwd(), {
        proof,
        verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run smoke:distribution-review:j1"
      });

      console.log(`Distribution review receipt written: ${receipt.receiptPath}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function validateProof(proof: DistributionReviewProof): DistributionReviewProof {
  if (!isRecord(proof)) {
    throw new Error("Distribution review proof must be an object.");
  }

  rejectPrivateProofKeys(proof);
  rejectUnexpectedProofKeys(proof);
  assertSafeAdapterId(proof.adapterId);
  assertNonEmpty(proof.host, "host");
  assertReviewKind(proof.reviewKind);
  assertSafeReceiptPath(proof.receiptPath);
  assertExistingAbsoluteFile(proof.proofFilePath, "proof file");
  assertNonEmpty(proof.reviewSystem, "review system");

  if (proof.reviewStatus !== "approved") {
    throw new Error("Distribution review proof status must be approved.");
  }

  assertIsoDate(proof.decidedAt, "decision timestamp");
  assertSha256(proof.submissionIdSha256, "submission id hash");
  assertSha256(proof.reviewRecordSha256, "review record hash");

  if (proof.publicListingHost !== undefined) {
    assertPublicListingHost(proof.publicListingHost);
  }

  if (releasePackageReviewKinds.has(proof.reviewKind)) {
    assertExistingAbsoluteFile(proof.signingReceiptPath, "signing receipt");
    assertExistingAbsoluteFile(proof.checksumReceiptPath, "checksum receipt");
  }

  return proof;
}

function resolveReviewKinds(workspaceRoot: string, proof: DistributionReviewProof): DistributionReviewKind[] {
  const gate = readReleaseGateEntries(workspaceRoot).find((entry) => entry.id === proof.adapterId);

  if (!gate) {
    throw new Error(`Distribution review proof has no release evidence gate for ${proof.adapterId}.`);
  }

  if (!gate.required_evidence.includes(proof.reviewKind)) {
    throw new Error(`Distribution review proof kind is not required for ${proof.adapterId}: ${proof.reviewKind}`);
  }

  const matchingKinds = gate.evidence_receipt_requirements
    .map((requirement) => parseEvidenceReceiptRequirement(requirement))
    .filter((requirement): requirement is EvidenceReceiptRequirement => Boolean(requirement))
    .filter((requirement) => requirement.receiptPath === proof.receiptPath)
    .map((requirement) => requirement.kind)
    .filter((kind): kind is DistributionReviewKind => isReviewKind(kind));

  if (!matchingKinds.includes(proof.reviewKind)) {
    throw new Error(`Distribution review proof receipt path must match a release evidence review receipt for ${proof.adapterId}.`);
  }

  return uniqueSortedReviewKinds(matchingKinds);
}

function readReleaseGateEntries(workspaceRoot: string): ReleaseGateEntry[] {
  const releaseGatesPath = join(workspaceRoot, releaseGatesRelativePath);
  const releaseGates = parseTomlDocument(readFileSync(releaseGatesPath, "utf8"));

  return (releaseGates.arrays.extensions ?? []).map((entry) => ({
    id: entry.id,
    required_evidence: entry.required_evidence,
    evidence_receipt_requirements: entry.evidence_receipt_requirements
  }));
}

function validateLinkedReceipts(proof: DistributionReviewProof): DistributionReviewReceipt["linkedReceipts"] {
  const signingReceiptBytes = readFileSync(proof.signingReceiptPath as string);
  const checksumReceiptBytes = readFileSync(proof.checksumReceiptPath as string);
  const signingReceipt = JSON.parse(signingReceiptBytes.toString("utf8")) as LinkedReceipt;
  const checksumReceipt = JSON.parse(checksumReceiptBytes.toString("utf8")) as LinkedReceipt;

  validateSigningReceipt(signingReceipt, proof);
  validateChecksumReceipt(checksumReceipt, proof);

  return {
    signingReceiptPath: proof.signingReceiptPath as string,
    signingReceiptSha256: sha256(signingReceiptBytes),
    checksumReceiptPath: proof.checksumReceiptPath as string,
    checksumReceiptSha256: sha256(checksumReceiptBytes)
  };
}

function validateSigningReceipt(receipt: LinkedReceipt, proof: DistributionReviewProof): void {
  if (receipt.receipt !== "dx.extension.package.signing") {
    throw new Error(`Distribution review signing receipt must be a package signing receipt for ${proof.adapterId}.`);
  }

  if (receipt.adapterId !== proof.adapterId || receipt.host !== proof.host) {
    throw new Error(`Distribution review signing receipt does not match ${proof.adapterId}.`);
  }

  if (
    receipt.releaseClaims?.publicReleasePackageVerified !== true ||
    receipt.releaseClaims.packageOutputVerified !== true ||
    receipt.releaseClaims.releaseChecksumVerified !== true ||
    receipt.releaseClaims.signingVerified !== true
  ) {
    throw new Error(`Distribution review signing receipt must verify signing and public release checksum for ${proof.adapterId}.`);
  }

  const packageOutput = readObjectField(receipt, "packageOutput");
  const signedArtifact = readObjectField(receipt, "signedArtifact");
  const signature = readObjectField(receipt, "signature");
  const packageOutputSha256 = validatePackageOutputLink(
    packageOutput,
    proof,
    "Distribution review signing receipt"
  );

  if (
    !isNonEmptyString(packageOutput?.checksumReceiptPath) ||
    !isSha256(packageOutput.checksumReceiptSha256)
  ) {
    throw new Error(`Distribution review signing receipt must include checksum linkage for ${proof.adapterId}.`);
  }

  if (packageOutput.checksumReceiptPath !== proof.checksumReceiptPath) {
    throw new Error(`Distribution review signing receipt checksum linkage does not match ${proof.adapterId}.`);
  }

  const checksumReceiptBytes = readFileSync(packageOutput.checksumReceiptPath);

  if (sha256(checksumReceiptBytes) !== packageOutput.checksumReceiptSha256) {
    throw new Error(`Distribution review signing receipt checksum linkage hash changed for ${proof.adapterId}.`);
  }

  const checksumReceipt = parseLinkedReceipt(checksumReceiptBytes, "checksum");
  validateChecksumReceipt(checksumReceipt, proof, packageOutputSha256);

  if (!isSha256(signedArtifact?.sha256)) {
    throw new Error(`Distribution review signing receipt must include signed artifact proof for ${proof.adapterId}.`);
  }

  validateCurrentSha256File(signedArtifact.path, signedArtifact.sha256, "signed artifact");

  if (
    signature?.verified !== true ||
    !isNonEmptyString(signature.path) ||
    !isSha256(signature.sha256) ||
    !isNonEmptyString(signature.verificationOutputPath) ||
    !isSha256(signature.verificationOutputSha256) ||
    !isNonEmptyString(signature.tool) ||
    !isNonEmptyString(signature.verificationCommand) ||
    !isNonEmptyString(signature.signerName) ||
    !isSha256(signature.certificateFingerprintSha256)
  ) {
    throw new Error(`Distribution review signing receipt must include verified signature proof for ${proof.adapterId}.`);
  }

  validateCurrentSha256File(signature.path, signature.sha256, "signature");
  validateCurrentSha256File(
    signature.verificationOutputPath,
    signature.verificationOutputSha256,
    "signature verification output"
  );
}

function validateChecksumReceipt(
  receipt: LinkedReceipt,
  proof: DistributionReviewProof,
  expectedPackageOutputSha256?: string
): void {
  if (receipt.receipt !== "dx.extension.release_package.checksum") {
    throw new Error(`Distribution review checksum receipt must be a release package checksum receipt for ${proof.adapterId}.`);
  }

  if (receipt.adapterId !== proof.adapterId || receipt.host !== proof.host) {
    throw new Error(`Distribution review checksum receipt does not match ${proof.adapterId}.`);
  }

  if (
    receipt.releaseClaims?.publicReleasePackageVerified !== true ||
    receipt.releaseClaims.packageOutputVerified !== true ||
    receipt.releaseClaims.releaseChecksumVerified !== true
  ) {
    throw new Error(`Distribution review checksum receipt must verify a public release package for ${proof.adapterId}.`);
  }

  const packageOutput = readObjectField(receipt, "packageOutput");
  const releaseArtifact = readObjectField(receipt, "releaseArtifact");
  const checksum = readObjectField(receipt, "checksum");
  const packageOutputSha256 = validatePackageOutputLink(
    packageOutput,
    proof,
    "Distribution review checksum receipt"
  );

  if (expectedPackageOutputSha256 && packageOutputSha256 !== expectedPackageOutputSha256) {
    throw new Error(`Distribution review checksum receipt package-output linkage does not match signing receipt for ${proof.adapterId}.`);
  }

  if (
    releaseArtifact?.createdFromPackageOutput !== true ||
    !isNonEmptyString(releaseArtifact.path) ||
    !isPositiveInteger(releaseArtifact.bytes) ||
    !isSha256(releaseArtifact.sha256) ||
    checksum?.algorithm !== "sha256" ||
    checksum.scope !== "public-release-package" ||
    !isPositiveInteger(checksum.bytes) ||
    !isSha256(checksum.sha256)
  ) {
    throw new Error(`Distribution review checksum receipt must include public release artifact proof for ${proof.adapterId}.`);
  }

  if (releaseArtifact.bytes !== checksum.bytes || releaseArtifact.sha256 !== checksum.sha256) {
    throw new Error(`Distribution review checksum receipt artifact proof does not match checksum proof for ${proof.adapterId}.`);
  }

  validateCurrentFile(releaseArtifact.path, releaseArtifact.bytes, releaseArtifact.sha256, "release artifact");
}

function validatePackageOutputLink(
  packageOutput: Record<string, unknown> | undefined,
  proof: DistributionReviewProof,
  label: string
): string {
  if (
    !isNonEmptyString(packageOutput?.receiptPath) ||
    !isSha256(packageOutput.receiptSha256) ||
    !isSha256(packageOutput.packageOutputSha256)
  ) {
    throw new Error(`${label} must include package-output linkage for ${proof.adapterId}.`);
  }

  const packageOutputReceiptBytes = readFileSync(packageOutput.receiptPath);

  if (sha256(packageOutputReceiptBytes) !== packageOutput.receiptSha256) {
    throw new Error(`${label} package-output receipt hash changed for ${proof.adapterId}.`);
  }

  let packageOutputProof: ReturnType<typeof verifyPackageOutputReceipt>;

  try {
    packageOutputProof = verifyPackageOutputReceipt(
      proof.adapterId,
      parseLinkedReceipt(packageOutputReceiptBytes, "package-output")
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(`${label} package-output receipt is invalid for ${proof.adapterId}: ${message}`);
  }

  if (packageOutputProof.host !== proof.host) {
    throw new Error(`${label} package-output receipt host mismatch for ${proof.adapterId}.`);
  }

  if (packageOutputProof.sha256 !== packageOutput.packageOutputSha256) {
    throw new Error(`${label} package-output aggregate hash changed for ${proof.adapterId}.`);
  }

  return packageOutputProof.sha256;
}

function validateCurrentFile(path: unknown, expectedBytes: unknown, expectedSha256: unknown, label: string): void {
  if (!isNonEmptyString(path) || !isPositiveInteger(expectedBytes) || !isSha256(expectedSha256)) {
    throw new Error(`Distribution review ${label} proof is incomplete.`);
  }

  assertExistingAbsoluteFile(path, label);
  const bytes = readFileSync(path);

  if (bytes.length !== expectedBytes || sha256(bytes) !== expectedSha256) {
    throw new Error(`Distribution review ${label} proof changed.`);
  }
}

function validateCurrentSha256File(path: unknown, expectedSha256: unknown, label: string): void {
  if (!isNonEmptyString(path) || !isSha256(expectedSha256)) {
    throw new Error(`Distribution review ${label} proof is incomplete.`);
  }

  assertExistingAbsoluteFile(path, label);

  if (sha256(readFileSync(path)) !== expectedSha256) {
    throw new Error(`Distribution review ${label} proof changed.`);
  }
}

function parseLinkedReceipt(bytes: Buffer, label: string): LinkedReceipt {
  const receipt = JSON.parse(bytes.toString("utf8"));

  if (!isRecord(receipt)) {
    throw new Error(`Distribution review linked ${label} receipt must be an object.`);
  }

  return receipt;
}

function readObjectField(record: LinkedReceipt, key: string): Record<string, unknown> | undefined {
  const value = (record as Record<string, unknown>)[key];

  return isRecord(value) ? value : undefined;
}

function validateProofFileBytes(bytes: Buffer): void {
  if (bytes.length === 0) {
    throw new Error("Distribution review proof file must not be empty.");
  }
}

function rejectUnexpectedProofKeys(proof: Record<string, unknown>): void {
  for (const key of Object.keys(proof)) {
    if (!proofKeys.has(key)) {
      throw new Error(`Distribution review proof contains an unsupported field: ${key}`);
    }
  }
}

function rejectPrivateProofKeys(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      rejectPrivateProofKeys(item);
    }

    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (privacySensitiveProofKeys.has(key)) {
      throw new Error(`Distribution review proof contains a privacy-sensitive distribution review proof field: ${key}`);
    }

    rejectPrivateProofKeys(child);
  }
}

function assertExistingAbsoluteFile(path: string | undefined, label: string): void {
  if (typeof path !== "string" || !isAbsolute(path)) {
    throw new Error(`Distribution review proof ${label} must be an absolute path.`);
  }

  if (!existsSync(path)) {
    throw new Error(`Distribution review proof ${label} does not exist: ${path}`);
  }
}

function assertReviewKind(value: string): asserts value is DistributionReviewKind {
  if (!isReviewKind(value)) {
    throw new Error(`Distribution review kind is unsupported: ${value}`);
  }
}

function assertSafeAdapterId(adapterId: string): void {
  if (!/^dx\.[a-z0-9][a-z0-9.-]*$/.test(adapterId) || adapterId.includes("..")) {
    throw new Error(`Distribution review adapter id is unsafe: ${adapterId}`);
  }
}

function assertSafeReceiptPath(path: string): void {
  if (
    typeof path !== "string" ||
    isAbsolute(path) ||
    path.includes("\\") ||
    path.includes("..") ||
    !path.startsWith(".dx/receipts/extensions/") ||
    !path.endsWith(".json")
  ) {
    throw new Error(`Distribution review receipt path is unsafe: ${path}`);
  }
}

function assertPublicListingHost(value: string): void {
  assertNonEmpty(value, "public listing host");

  if (value.includes("/") || value.includes("\\") || value.includes("@") || value.includes("?")) {
    throw new Error("Distribution review public listing proof must store only a host name.");
  }
}

function validateBrowserStoreTargets(proof: DistributionReviewProof): BrowserStoreTarget[] {
  const targets = proof.browserStoreTargets;

  if (targets === undefined) {
    if (isBrowserDistributionProof(proof)) {
      throw new Error(
        "Distribution review proof for dx.browser.command-center must cover Chrome Web Store, Microsoft Edge Add-ons, and Firefox AMO."
      );
    }

    return [];
  }

  if (!isBrowserDistributionProof(proof)) {
    throw new Error("Distribution review browser store targets are only supported for dx.browser.command-center.");
  }

  if (!Array.isArray(targets) || targets.length === 0 || !targets.every(isBrowserStoreTarget)) {
    throw new Error("Distribution review browser store targets are unsupported.");
  }

  const uniqueTargets = requiredBrowserStoreTargets.filter((target) => targets.includes(target));

  if (uniqueTargets.length !== targets.length) {
    throw new Error("Distribution review browser store targets must not contain duplicates.");
  }

  if (!hasSameStringSet(uniqueTargets, requiredBrowserStoreTargets)) {
    throw new Error(
      "Distribution review proof for dx.browser.command-center must cover Chrome Web Store, Microsoft Edge Add-ons, and Firefox AMO."
    );
  }

  return uniqueTargets;
}

function isBrowserDistributionProof(proof: DistributionReviewProof): boolean {
  return proof.adapterId === browserCommandCenterAdapterId && proof.reviewKind === "distribution_review";
}

function isBrowserStoreTarget(value: unknown): value is BrowserStoreTarget {
  return requiredBrowserStoreTargets.includes(value as BrowserStoreTarget);
}

function hasSameStringSet(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value));
}

function assertIsoDate(value: string, label: string): void {
  assertNonEmpty(value, label);

  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`Distribution review proof ${label} must be an ISO timestamp.`);
  }
}

function assertNonEmpty(value: string, label: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Distribution review proof ${label} is required.`);
  }
}

function assertSha256(value: string, label: string): void {
  assertNonEmpty(value, label);

  if (!/^[0-9a-f]{64}$/.test(value)) {
    throw new Error(`Distribution review proof ${label} must be a SHA-256 hex digest.`);
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && value > 0;
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function isReviewKind(value: string): value is DistributionReviewKind {
  return reviewKinds.has(value as DistributionReviewKind);
}

function uniqueSortedReviewKinds(values: DistributionReviewKind[]): DistributionReviewKind[] {
  return [...new Set(values)].sort();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
