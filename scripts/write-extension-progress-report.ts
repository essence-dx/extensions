import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createReleaseEvidenceSummary,
  readReleaseEvidenceReport,
  type ExtensionProgressReleaseEvidenceSnapshot
} from "./lib/extension-progress-release-evidence.ts";
import {
  readPackageEvidenceReceiptPaths,
  resolvePackageEvidenceReceiptPath
} from "./lib/package-evidence-receipt-paths.ts";
import { staleLoadedHostPreflightPackageLinkReason } from "./lib/loaded-host-preflight-package-link.ts";
import { releaseBlockerEvidenceKind } from "./lib/release-evidence-blocker-mapping.ts";
import {
  releaseEvidenceRemediationProofSources,
  type ReleaseEvidenceRemediationProofSource
} from "./lib/release-evidence-remediation.ts";
import { parseTomlDocument } from "./lib/toml-lite.ts";
import { validateExtensionReadiness } from "./validate-extension-readiness.ts";
import type { ReleaseEvidenceGapEntry } from "./write-release-evidence-gap-report.ts";

export interface ExtensionProgressReportOptions {
  generatedAt?: Date | string;
  verificationCommand?: string;
}

export interface ExtensionProgressReport {
  receipt: "dx.extension.progress_report";
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  summary: {
    officialExtensions: number;
    sourceLevel: number;
    loadedHost: number;
    packageProof: number;
    releaseReady: number;
    releaseEvidenceGates: number;
    releaseEvidenceSnapshot: ExtensionProgressReleaseEvidenceSnapshot | null;
    packageOutputProofs: number;
    loadedHostPreflights: number;
    hostDiscoveryReceipts: number;
    hostDiscoveryCandidateFound: number;
    hostDiscoveryMissing: number;
    hostDiscoveryManualOnly: number;
    hostDiscoveryCloudService: number;
    releaseEvidenceReady: number;
    missingReleaseEvidenceCount: number;
    weakReleaseEvidenceCount: number;
    missingReleaseReceiptCount: number;
    weakReleaseReceiptCount: number;
    staleReadinessReceipts: number;
    remainingProofSourceCounts: Record<ReleaseEvidenceRemediationProofSource, number>;
  };
  extensions: ExtensionProgressEntry[];
}

export interface ExtensionProgressEntry {
  id: string;
  stage: string;
  manifest: string;
  sourceGuard: string;
  nextProof: string;
  blockedByCount: number;
  readinessReceipt: boolean;
  readinessReceiptStale: boolean;
  staleReadinessReasons: string[];
  packageOutputReceipt: boolean;
  loadedHostPreflightReceipt: boolean;
  hostDiscoveryReceipt: boolean;
  hostDiscoveryMode: string | null;
  hostDiscoveryStatus: string | null;
  releaseEvidenceGate: boolean;
  releaseEvidenceReady: boolean;
  missingReleaseEvidence: string[];
  weakReleaseEvidence: string[];
  missingReleaseReceiptCount: number;
  weakReleaseReceiptCount: number;
  remainingProofSources: ReleaseEvidenceRemediationProofSource[];
  remainingProofSourceCounts: Record<ReleaseEvidenceRemediationProofSource, number>;
  releaseReady: boolean;
}

interface ReadinessEntry {
  id: string;
  stage: string;
  manifest: string;
  source_guard: string;
  next_proof: string;
  blocked_by: string[];
  latest_readiness_receipt: string;
}

interface ReadinessReceiptSummary {
  exists: boolean;
  stale: boolean;
  staleReasons: string[];
}

const readinessRelativePath = "registry/extension-readiness.toml";
const releaseGatesRelativePath = "registry/release-evidence-gates.toml";
const receiptDirectory = ".dx/receipts/extensions";
const progressReceiptPath = ".dx/receipts/extensions/progress-latest.json";

export function writeExtensionProgressReport(
  root = process.cwd(),
  options: ExtensionProgressReportOptions = {}
): ExtensionProgressReport {
  const workspaceRoot = resolve(root);
  const generatedAt = normalizeGeneratedAt(options.generatedAt);
  const verificationCommand = options.verificationCommand ?? "npm run report:extension-progress:j1";
  const entries = readReadinessEntries(workspaceRoot);
  const releaseEvidenceReport = readReleaseEvidenceReport(workspaceRoot, generatedAt);
  const releaseEvidenceById = releaseEvidenceReport.byId;
  const packageEvidenceReceiptById = readPackageEvidenceReceiptPaths(workspaceRoot);
  const extensions = entries.map((entry) =>
    createProgressEntry(workspaceRoot, entry, releaseEvidenceById.get(entry.id), packageEvidenceReceiptById)
  );
  const remainingProofSourceCounts = sumRemainingProofSourceCounts(extensions);
  const receiptPath = join(workspaceRoot, ...progressReceiptPath.split("/"));
  const report: ExtensionProgressReport = {
    receipt: "dx.extension.progress_report",
    generatedAt,
    verificationCommand,
    receiptPath,
    summary: {
      officialExtensions: extensions.length,
      sourceLevel: countStage(extensions, "source-level"),
      loadedHost: countStage(extensions, "loaded-host"),
      packageProof: countStage(extensions, "package-proof"),
      releaseReady: countTrue(extensions, "releaseReady"),
      releaseEvidenceGates: countReleaseEvidenceGates(workspaceRoot),
      packageOutputProofs: countTrue(extensions, "packageOutputReceipt"),
      loadedHostPreflights: countTrue(extensions, "loadedHostPreflightReceipt"),
      hostDiscoveryReceipts: countTrue(extensions, "hostDiscoveryReceipt"),
      hostDiscoveryCandidateFound: countHostDiscoveryStatus(extensions, "candidate-found"),
      hostDiscoveryMissing: countHostDiscoveryStatus(extensions, "missing"),
      hostDiscoveryManualOnly: countHostDiscoveryStatus(extensions, "manual-only"),
      hostDiscoveryCloudService: countHostDiscoveryStatus(extensions, "cloud-service"),
      releaseEvidenceSnapshot: releaseEvidenceReport.snapshot,
      releaseEvidenceReady: countTrue(extensions, "releaseEvidenceReady"),
      missingReleaseEvidenceCount: sumProgressEntries(extensions, "missingReleaseEvidenceCount"),
      weakReleaseEvidenceCount: sumProgressEntries(extensions, "weakReleaseEvidenceCount"),
      missingReleaseReceiptCount: sumProgressEntries(extensions, "missingReleaseReceiptCount"),
      weakReleaseReceiptCount: sumProgressEntries(extensions, "weakReleaseReceiptCount"),
      staleReadinessReceipts: countTrue(extensions, "readinessReceiptStale"),
      remainingProofSourceCounts
    },
    extensions
  };

  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(report, null, 2)}\n`);

  return report;
}

if (isDirectRun()) {
  const report = writeExtensionProgressReport(process.cwd(), {
    verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run report:extension-progress:j1"
  });

  console.log(
    `Extension progress report written: ${report.summary.officialExtensions} official extensions`
  );
}

function readReadinessEntries(workspaceRoot: string): ReadinessEntry[] {
  const failures = validateExtensionReadiness(workspaceRoot);
  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }

  const readinessPath = join(workspaceRoot, readinessRelativePath);
  const readiness = parseTomlDocument(readFileSync(readinessPath, "utf8"));

  return (readiness.arrays.extensions ?? [])
    .map((entry) => ({
      id: entry.id,
      stage: entry.stage,
      manifest: entry.manifest,
      source_guard: entry.source_guard,
      next_proof: entry.next_proof,
      blocked_by: entry.blocked_by,
      latest_readiness_receipt: entry.latest_readiness_receipt
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function countReleaseEvidenceGates(workspaceRoot: string): number {
  const releaseGatesPath = join(workspaceRoot, releaseGatesRelativePath);

  if (!existsSync(releaseGatesPath)) {
    return 0;
  }

  const releaseGates = parseTomlDocument(readFileSync(releaseGatesPath, "utf8"));
  return (releaseGates.arrays.extensions ?? []).length;
}

function createProgressEntry(
  workspaceRoot: string,
  entry: ReadinessEntry,
  releaseEvidence: ReleaseEvidenceGapEntry | undefined,
  packageEvidenceReceiptById: Map<string, string>
): ExtensionProgressEntry {
  const hostDiscovery = readReceiptSummary(workspaceRoot, entry.id, "host-discovery-latest.json");
  const releaseEvidenceSummary = createReleaseEvidenceSummary(releaseEvidence);
  const readinessReceipt = readReadinessReceiptSummary(workspaceRoot, entry, releaseEvidence);
  const remainingProofSourceCounts = remainingProofSourceCountsFor(releaseEvidence);

  return {
    id: entry.id,
    stage: entry.stage,
    manifest: entry.manifest,
    sourceGuard: entry.source_guard,
    nextProof: entry.next_proof,
    blockedByCount: unresolvedProgressBlockers(entry.blocked_by, releaseEvidence).length,
    readinessReceipt: readinessReceipt.exists,
    readinessReceiptStale: readinessReceipt.stale,
    staleReadinessReasons: readinessReceipt.staleReasons,
    packageOutputReceipt: packageOutputReceiptExists(workspaceRoot, entry.id, packageEvidenceReceiptById),
    loadedHostPreflightReceipt: receiptExists(
      workspaceRoot,
      entry.id,
      "loaded-host-preflight-latest.json"
    ),
    hostDiscoveryReceipt: hostDiscovery.exists,
    hostDiscoveryMode: hostDiscovery.discoveryMode,
    hostDiscoveryStatus: hostDiscovery.status,
    releaseEvidenceGate: releaseEvidenceSummary.gate,
    releaseEvidenceReady: releaseEvidenceSummary.ready,
    missingReleaseEvidence: releaseEvidenceSummary.missingEvidence,
    weakReleaseEvidence: releaseEvidenceSummary.weakEvidence,
    missingReleaseEvidenceCount: releaseEvidenceSummary.missingEvidence.length,
    weakReleaseEvidenceCount: releaseEvidenceSummary.weakEvidence.length,
    missingReleaseReceiptCount: releaseEvidenceSummary.missingReceiptCount,
    weakReleaseReceiptCount: releaseEvidenceSummary.weakReceiptCount,
    remainingProofSources: remainingProofSourcesFromCounts(remainingProofSourceCounts),
    remainingProofSourceCounts,
    releaseReady: entry.stage === "release-ready" && releaseEvidenceSummary.ready && !readinessReceipt.stale
  };
}

function remainingProofSourceCountsFor(
  releaseEvidence: ReleaseEvidenceGapEntry | undefined
): Record<ReleaseEvidenceRemediationProofSource, number> {
  const counts = createEmptyProofSourceCounts();

  for (const requirement of releaseEvidence?.evidenceRequirements ?? []) {
    if (!requirement.releaseValid && requirement.remediation) {
      counts[requirement.remediation.proofSource] += 1;
    }
  }

  return counts;
}

function remainingProofSourcesFromCounts(
  counts: Record<ReleaseEvidenceRemediationProofSource, number>
): ReleaseEvidenceRemediationProofSource[] {
  return releaseEvidenceRemediationProofSources.filter((proofSource) => counts[proofSource] > 0);
}

function sumRemainingProofSourceCounts(
  extensions: ExtensionProgressEntry[]
): Record<ReleaseEvidenceRemediationProofSource, number> {
  const counts = createEmptyProofSourceCounts();

  for (const extension of extensions) {
    for (const proofSource of releaseEvidenceRemediationProofSources) {
      counts[proofSource] += extension.remainingProofSourceCounts[proofSource];
    }
  }

  return counts;
}

function createEmptyProofSourceCounts(): Record<ReleaseEvidenceRemediationProofSource, number> {
  return Object.fromEntries(releaseEvidenceRemediationProofSources.map((proofSource) => [proofSource, 0])) as Record<
    ReleaseEvidenceRemediationProofSource,
    number
  >;
}

function unresolvedProgressBlockers(
  blockers: string[],
  releaseEvidence: ReleaseEvidenceGapEntry | undefined
): string[] {
  const releaseValidEvidenceKinds = new Set(releaseEvidence?.existingEvidence ?? []);
  const packageEvidenceKind = releaseEvidence?.requiredEvidence.includes("content_package")
    ? "content_package"
    : "package_output";

  return blockers.filter((blocker) => {
    const evidenceKind = releaseBlockerEvidenceKind(blocker, {
      packageEvidenceKind
    });

    return !evidenceKind || !releaseValidEvidenceKinds.has(evidenceKind);
  });
}

function readReceiptSummary(
  workspaceRoot: string,
  adapterId: string,
  receiptName: string
): { exists: boolean; discoveryMode: string | null; status: string | null } {
  const receiptPath = join(workspaceRoot, receiptDirectory, adapterId, receiptName);

  if (!existsSync(receiptPath)) {
    return {
      exists: false,
      discoveryMode: null,
      status: null
    };
  }

  const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));

  return {
    exists: true,
    discoveryMode: typeof receipt.discoveryMode === "string" ? receipt.discoveryMode : null,
    status: typeof receipt.status === "string" ? receipt.status : null
  };
}

function readReadinessReceiptSummary(
  workspaceRoot: string,
  entry: ReadinessEntry,
  releaseEvidence: ReleaseEvidenceGapEntry | undefined
): ReadinessReceiptSummary {
  const receiptPath = join(workspaceRoot, ...entry.latest_readiness_receipt.split("/"));

  if (!existsSync(receiptPath)) {
    return {
      exists: false,
      stale: false,
      staleReasons: []
    };
  }

  const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
  const readinessGeneratedAt = readGeneratedAt(receipt);

  if (!releaseEvidence || !readinessGeneratedAt) {
    return {
      exists: true,
      stale: false,
      staleReasons: []
    };
  }

  const staleReasons = [
    staleReasonForEvidenceKind(workspaceRoot, releaseEvidence, receipt, readinessGeneratedAt, {
      claimKey: "package_verified",
      evidenceKind: releaseEvidence.requiredEvidence.includes("content_package") ? "content_package" : "package_output",
      label: "package evidence"
    }),
    staleReasonForEvidenceKind(workspaceRoot, releaseEvidence, receipt, readinessGeneratedAt, {
      claimKey: "checksum_verified",
      evidenceKind: "checksum",
      label: "checksum evidence"
    }),
    staleReasonForEvidenceKind(workspaceRoot, releaseEvidence, receipt, readinessGeneratedAt, {
      claimKey: "loaded_host_verified",
      evidenceKind: "host_execution",
      label: "host execution evidence"
    }),
    staleReasonForEvidenceKind(workspaceRoot, releaseEvidence, receipt, readinessGeneratedAt, {
      claimKey: "signing_verified",
      evidenceKind: "signing",
      label: "signing evidence"
    }),
    staleReasonForEvidenceKind(workspaceRoot, releaseEvidence, receipt, readinessGeneratedAt, {
      claimKey: "distribution_verified",
      evidenceKind: "distribution_review",
      label: "distribution review evidence"
    }),
    staleLoadedHostPreflightPackageLinkReason(workspaceRoot, entry.id)
  ].filter((reason): reason is string => Boolean(reason));

  return {
    exists: true,
    stale: staleReasons.length > 0,
    staleReasons
  };
}

function staleReasonForEvidenceKind(
  workspaceRoot: string,
  releaseEvidence: ReleaseEvidenceGapEntry,
  readinessReceipt: Record<string, unknown>,
  readinessGeneratedAt: Date,
  options: { claimKey: string; evidenceKind: string; label: string }
): string | undefined {
  if (readinessReceipt[options.claimKey] !== false || !releaseEvidence.existingEvidence.includes(options.evidenceKind)) {
    return undefined;
  }

  const evidenceReceiptGeneratedAt = latestValidEvidenceReceiptGeneratedAt(
    workspaceRoot,
    releaseEvidence,
    options.evidenceKind
  );

  if (!evidenceReceiptGeneratedAt || evidenceReceiptGeneratedAt <= readinessGeneratedAt) {
    return undefined;
  }

  return `${options.label} is newer than the source-readiness receipt`;
}

function latestValidEvidenceReceiptGeneratedAt(
  workspaceRoot: string,
  releaseEvidence: ReleaseEvidenceGapEntry,
  evidenceKind: string
): Date | undefined {
  const generatedAtValues = releaseEvidence.evidenceRequirements
    .filter((requirement) => requirement.kind === evidenceKind && requirement.releaseValid)
    .map((requirement) => readReceiptGeneratedAt(workspaceRoot, requirement.receiptPath))
    .filter((generatedAt): generatedAt is Date => Boolean(generatedAt));

  return generatedAtValues.sort((left, right) => right.getTime() - left.getTime())[0];
}

function readReceiptGeneratedAt(workspaceRoot: string, receiptPath: string): Date | undefined {
  const absolutePath = join(workspaceRoot, ...receiptPath.split("/"));

  if (!existsSync(absolutePath)) {
    return undefined;
  }

  return readGeneratedAt(JSON.parse(readFileSync(absolutePath, "utf8")));
}

function readGeneratedAt(receipt: Record<string, unknown>): Date | undefined {
  const value = receipt.generatedAt ?? receipt.generated_at;

  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function receiptExists(workspaceRoot: string, adapterId: string, receiptName: string): boolean {
  return existsSync(join(workspaceRoot, receiptDirectory, adapterId, receiptName));
}

function packageOutputReceiptExists(
  workspaceRoot: string,
  adapterId: string,
  packageEvidenceReceiptById: Map<string, string>
): boolean {
  return existsSync(resolvePackageEvidenceReceiptPath(workspaceRoot, adapterId, packageEvidenceReceiptById));
}

function countStage(extensions: ExtensionProgressEntry[], stage: string): number {
  return extensions.filter((extension) => extension.stage === stage).length;
}

function countTrue(extensions: ExtensionProgressEntry[], key: keyof ExtensionProgressEntry): number {
  return extensions.filter((extension) => extension[key] === true).length;
}

function sumProgressEntries(
  extensions: ExtensionProgressEntry[],
  key: keyof ExtensionProgressEntry
): number {
  return extensions.reduce((total, extension) => {
    const value = extension[key];

    return typeof value === "number" ? total + value : total;
  }, 0);
}

function countHostDiscoveryStatus(
  extensions: ExtensionProgressEntry[],
  status: string
): number {
  return extensions.filter((extension) => extension.hostDiscoveryStatus === status).length;
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
