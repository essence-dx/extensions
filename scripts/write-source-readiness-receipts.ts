import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import { parseTomlDocument } from "./lib/toml-lite.ts";
import { releaseBlockerEvidenceKind } from "./lib/release-evidence-blocker-mapping.ts";
import { readReleaseEvidenceById } from "./lib/extension-progress-release-evidence.ts";
import { validateExtensionReadiness } from "./validate-extension-readiness.ts";
import type { ReleaseEvidenceGapEntry } from "./write-release-evidence-gap-report.ts";

const readinessRelativePath = "registry/extension-readiness.toml";
const receiptSchema = "dx.extension_readiness.receipt";
const deferredReleaseProofFlags = [
  "loaded_host_verified",
  "signing_verified",
  "distribution_verified"
];

export interface SourceReadinessReceiptOptions {
  dryRun?: boolean;
  generatedAt?: string;
  verificationCommand?: string;
}

export interface WrittenReadinessReceipt {
  id: string;
  path: string;
}

export interface SourceReadinessReceiptResult {
  dryRun: boolean;
  written: WrittenReadinessReceipt[];
}

interface ReadinessEntry {
  id: string;
  stage: string;
  manifest: string;
  source_guard: string;
  latest_readiness_receipt: string;
  next_proof: string;
  blocked_by: string[];
}

export function writeSourceReadinessReceipts(
  root = process.cwd(),
  options: SourceReadinessReceiptOptions = {}
): SourceReadinessReceiptResult {
  const dryRun = options.dryRun === true;
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const verificationCommand = options.verificationCommand?.trim();
  const entries = readSourceLevelEntries(root);
  const releaseEvidenceById = dryRun ? new Map<string, ReleaseEvidenceGapEntry>() : readReleaseEvidenceById(root, generatedAt);
  const written: WrittenReadinessReceipt[] = [];

  if (!dryRun && !verificationCommand) {
    throw new Error("source readiness receipts require --verification-command");
  }

  for (const entry of entries) {
    const receipt = createSourceReadinessReceipt(entry, {
      generatedAt,
      verificationCommand: verificationCommand ?? "dry-run"
    }, releaseEvidenceById.get(entry.id));
    written.push({
      id: entry.id,
      path: entry.latest_readiness_receipt
    });

    if (dryRun) {
      continue;
    }

    const absolutePath = join(root, ...entry.latest_readiness_receipt.split("/"));
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, `${JSON.stringify(receipt, null, 2)}\n`);
  }

  if (!dryRun) {
    const failures = validateSourceReadinessReceiptFiles(root);
    if (failures.length > 0) {
      throw new Error(failures.join("\n"));
    }
  }

  return {
    dryRun,
    written
  };
}

export function validateSourceReadinessReceiptFiles(root = process.cwd()): string[] {
  const failures: string[] = [];
  const entries = readSourceLevelEntries(root, failures);
  const releaseEvidenceById = readReleaseEvidenceById(root, new Date().toISOString());

  for (const entry of entries) {
    const receiptPath = join(root, ...entry.latest_readiness_receipt.split("/"));
    if (!existsSync(receiptPath)) {
      failures.push(
        `source readiness receipt for ${entry.id} is missing: ${entry.latest_readiness_receipt}`
      );
      continue;
    }

    let receipt: Record<string, unknown>;
    try {
      receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
    } catch (error) {
      failures.push(`source readiness receipt for ${entry.id} must be valid JSON: ${formatError(error)}`);
      continue;
    }

    validateReceipt(entry, receipt, failures, releaseEvidenceById.get(entry.id));
  }

  return failures;
}

function createSourceReadinessReceipt(
  entry: ReadinessEntry,
  options: Required<Pick<SourceReadinessReceiptOptions, "generatedAt" | "verificationCommand">>,
  releaseEvidence: ReleaseEvidenceGapEntry | undefined
): Record<string, unknown> {
  const packageEvidenceKind = packageEvidenceKindFor(releaseEvidence);
  const blockedBy = unresolvedSourceReadinessBlockers(entry.blocked_by, releaseEvidence, packageEvidenceKind);

  return {
    schema: receiptSchema,
    manifest_version: 1,
    extension_id: entry.id,
    readiness_stage: "source-level",
    manifest: entry.manifest,
    source_guard: entry.source_guard,
    source_guard_status: "covered-by-verification-command",
    verification_command: options.verificationCommand,
    generated_at: options.generatedAt,
    receipt_path: entry.latest_readiness_receipt,
    release_ready: false,
    loaded_host_verified: false,
    package_verified: hasExistingEvidence(releaseEvidence, packageEvidenceKind),
    signing_verified: false,
    checksum_verified: hasExistingEvidence(releaseEvidence, "checksum"),
    distribution_verified: false,
    next_proof: entry.next_proof,
    blocked_by: blockedBy
  };
}

function validateReceipt(
  entry: ReadinessEntry,
  receipt: Record<string, unknown>,
  failures: string[],
  releaseEvidence: ReleaseEvidenceGapEntry | undefined
): void {
  const packageEvidenceKind = packageEvidenceKindFor(releaseEvidence);

  expectEqual(receipt.schema, receiptSchema, `source readiness receipt schema for ${entry.id}`, failures);
  expectEqual(receipt.manifest_version, 1, `source readiness receipt manifest_version for ${entry.id}`, failures);
  expectEqual(receipt.extension_id, entry.id, `source readiness receipt extension_id for ${entry.id}`, failures);
  expectEqual(receipt.readiness_stage, "source-level", `source readiness receipt stage for ${entry.id}`, failures);
  expectEqual(receipt.manifest, entry.manifest, `source readiness receipt manifest for ${entry.id}`, failures);
  expectEqual(receipt.source_guard, entry.source_guard, `source readiness receipt source_guard for ${entry.id}`, failures);
  expectEqual(
    receipt.receipt_path,
    entry.latest_readiness_receipt,
    `source readiness receipt path for ${entry.id}`,
    failures
  );
  expectNonEmptyString(
    receipt.verification_command,
    `source readiness receipt verification_command for ${entry.id}`,
    failures
  );
  expectNonEmptyString(
    receipt.generated_at,
    `source readiness receipt generated_at for ${entry.id}`,
    failures
  );
  expectEqual(
    receipt.release_ready,
    false,
    `source readiness receipt release_ready for ${entry.id}`,
    failures,
    `source readiness receipt for ${entry.id} must not claim release readiness`
  );

  expectEqual(
    receipt.package_verified,
    hasExistingEvidence(releaseEvidence, packageEvidenceKind),
    `source readiness receipt package_verified for ${entry.id}`,
    failures
  );
  expectEqual(
    receipt.checksum_verified,
    hasExistingEvidence(releaseEvidence, "checksum"),
    `source readiness receipt checksum_verified for ${entry.id}`,
    failures
  );

  for (const flag of deferredReleaseProofFlags) {
    expectEqual(
      receipt[flag],
      false,
      `source readiness receipt ${flag} for ${entry.id}`,
      failures
    );
  }

  if (!Array.isArray(receipt.blocked_by) || receipt.blocked_by.length === 0) {
    failures.push(
      `source readiness receipt blocked_by for ${entry.id} must include at least one deferred proof`
    );
  } else if (!stringArraysEqual(
    receipt.blocked_by,
    unresolvedSourceReadinessBlockers(entry.blocked_by, releaseEvidence, packageEvidenceKind)
  )) {
    failures.push(`source readiness receipt blocked_by for ${entry.id} must list unresolved release blockers`);
  }
}

function unresolvedSourceReadinessBlockers(
  blockers: string[],
  releaseEvidence: ReleaseEvidenceGapEntry | undefined,
  packageEvidenceKind: string
): string[] {
  const releaseValidEvidenceKinds = new Set(releaseEvidence?.existingEvidence ?? []);

  return blockers.filter((blocker) => {
    const evidenceKind = releaseBlockerEvidenceKind(blocker, {
      packageEvidenceKind: packageEvidenceKind === "content_package" ? "content_package" : "package_output"
    });

    return !evidenceKind || !releaseValidEvidenceKinds.has(evidenceKind);
  });
}

function packageEvidenceKindFor(releaseEvidence: ReleaseEvidenceGapEntry | undefined): string {
  return releaseEvidence?.requiredEvidence.includes("content_package") ? "content_package" : "package_output";
}

function hasExistingEvidence(
  releaseEvidence: ReleaseEvidenceGapEntry | undefined,
  evidenceKind: string
): boolean {
  return releaseEvidence?.existingEvidence.includes(evidenceKind) === true;
}

function stringArraysEqual(left: unknown, right: string[]): boolean {
  return (
    Array.isArray(left) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function readSourceLevelEntries(root: string, failures: string[] = []): ReadinessEntry[] {
  const readinessFailures = validateExtensionReadiness(root);
  failures.push(...readinessFailures);

  if (readinessFailures.length > 0) {
    return [];
  }

  const readinessPath = join(root, readinessRelativePath);
  const readiness = parseTomlDocument(readFileSync(readinessPath, "utf8"));
  return (readiness.arrays.extensions ?? [])
    .filter((entry) => entry.stage === "source-level")
    .map((entry) => ({
      id: entry.id,
      stage: entry.stage,
      manifest: entry.manifest,
      source_guard: entry.source_guard,
      latest_readiness_receipt: entry.latest_readiness_receipt,
      next_proof: entry.next_proof,
      blocked_by: entry.blocked_by
    }));
}

function expectEqual(
  actual: unknown,
  expected: unknown,
  label: string,
  failures: string[],
  customMessage?: string
): void {
  if (actual !== expected) {
    failures.push(customMessage ?? `${label} must be ${JSON.stringify(expected)}`);
  }
}

function expectNonEmptyString(value: unknown, label: string, failures: string[]): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    failures.push(`${label} must be a non-empty string`);
  }
}

function parseCliOptions(args: string[]): SourceReadinessReceiptOptions {
  const options: SourceReadinessReceiptOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (argument === "--verification-command" && index + 1 < args.length) {
      options.verificationCommand = args[index + 1];
      index += 1;
      continue;
    }

    if (argument === "--generated-at" && index + 1 < args.length) {
      options.generatedAt = args[index + 1];
      index += 1;
      continue;
    }

    throw new Error(`Unsupported source readiness receipt argument: ${argument}`);
  }

  return options;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (process.argv[1] && normalize(process.argv[1]) === normalize(fileURLToPath(import.meta.url))) {
  try {
    const result = writeSourceReadinessReceipts(process.cwd(), parseCliOptions(process.argv.slice(2)));
    const mode = result.dryRun ? "source readiness receipt dry run verified" : "source readiness receipts written";
    console.log(`${mode}: ${result.written.length}`);
  } catch (error) {
    console.error(formatError(error));
    process.exit(1);
  }
}
