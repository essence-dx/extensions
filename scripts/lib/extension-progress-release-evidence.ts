import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  type ReleaseEvidenceGapReport,
  type ReleaseEvidenceGapEntry,
  writeReleaseEvidenceGapReport
} from "../write-release-evidence-gap-report.ts";

const releaseGatesRelativePath = "registry/release-evidence-gates.toml";

export interface ExtensionProgressReleaseEvidenceSummary {
  gate: boolean;
  ready: boolean;
  missingEvidence: string[];
  weakEvidence: string[];
  missingReceiptCount: number;
  weakReceiptCount: number;
}

export interface ExtensionProgressReleaseEvidenceSnapshot {
  generatedAt: string;
  releaseGateEntries: number;
  expectedReceiptCount: number;
  existingReceiptCount: number;
  missingReceiptCount: number;
  weakReceiptCount: number;
  missingEvidenceCount: number;
  weakEvidenceCount: number;
  environmentBlockerCount: number;
  releaseReady: number;
}

export interface ExtensionProgressReleaseEvidenceReport {
  byId: Map<string, ReleaseEvidenceGapEntry>;
  snapshot: ExtensionProgressReleaseEvidenceSnapshot | null;
}

export function readReleaseEvidenceReport(
  workspaceRoot: string,
  generatedAt: string
): ExtensionProgressReleaseEvidenceReport {
  const releaseGatesPath = join(workspaceRoot, releaseGatesRelativePath);

  if (!existsSync(releaseGatesPath)) {
    return {
      byId: new Map(),
      snapshot: null
    };
  }

  const releaseEvidence = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt,
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });

  return {
    byId: new Map(releaseEvidence.extensions.map((extension) => [extension.id, extension])),
    snapshot: createReleaseEvidenceSnapshot(releaseEvidence)
  };
}

export function readReleaseEvidenceById(
  workspaceRoot: string,
  generatedAt: string
): Map<string, ReleaseEvidenceGapEntry> {
  return readReleaseEvidenceReport(workspaceRoot, generatedAt).byId;
}

export function createReleaseEvidenceSummary(
  releaseEvidence: ReleaseEvidenceGapEntry | undefined
): ExtensionProgressReleaseEvidenceSummary {
  if (!releaseEvidence) {
    return {
      gate: false,
      ready: false,
      missingEvidence: [],
      weakEvidence: [],
      missingReceiptCount: 0,
      weakReceiptCount: 0
    };
  }

  return {
    gate: true,
    ready: releaseEvidence.releaseReady,
    missingEvidence: [...releaseEvidence.missingEvidence],
    weakEvidence: [...releaseEvidence.weakEvidence],
    missingReceiptCount: releaseEvidence.missingReceiptCount,
    weakReceiptCount: releaseEvidence.weakReceiptCount
  };
}

function createReleaseEvidenceSnapshot(
  report: ReleaseEvidenceGapReport
): ExtensionProgressReleaseEvidenceSnapshot {
  return {
    generatedAt: report.generatedAt,
    releaseGateEntries: report.summary.releaseGateEntries,
    expectedReceiptCount: report.summary.expectedReceiptCount,
    existingReceiptCount: report.summary.existingReceiptCount,
    missingReceiptCount: report.summary.missingReceiptCount,
    weakReceiptCount: report.summary.weakReceiptCount,
    missingEvidenceCount: report.summary.missingEvidenceCount,
    weakEvidenceCount: report.summary.weakEvidenceCount,
    environmentBlockerCount: report.summary.environmentBlockerCount,
    releaseReady: report.summary.releaseReady
  };
}
