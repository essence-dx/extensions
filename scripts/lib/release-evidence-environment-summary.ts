import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { staleLoadedHostPreflightPackageLinkReason } from "./loaded-host-preflight-package-link.ts";
import { releaseBlockerEvidenceKind } from "./release-evidence-blocker-mapping.ts";

export interface ReleaseEvidenceEnvironmentSummary {
  hostDiscovery: ReleaseEvidenceHostDiscoverySummary | null;
  loadedHostPreflight: ReleaseEvidenceLoadedHostPreflightSummary | null;
  blockers: string[];
}

export interface ReleaseEvidenceEnvironmentSummaryOptions {
  releaseValidEvidenceKinds?: Iterable<string>;
}

export interface ReleaseEvidenceHostDiscoverySummary {
  receiptPath: string;
  status: string | null;
  reason: string | null;
  foundRequiredTools: string[];
  missingRequiredTools: string[];
}

export interface ReleaseEvidenceLoadedHostPreflightSummary {
  receiptPath: string;
  nextProof: string | null;
  blockedBy: string[];
  packageLinkProblem: string | null;
  preflightClaims: Record<string, boolean>;
}

const receiptRoot = ".dx/receipts/extensions";
const hostDiscoveryReceiptName = "host-discovery-latest.json";
const loadedHostPreflightReceiptName = "loaded-host-preflight-latest.json";

export function readReleaseEvidenceEnvironmentSummary(
  workspaceRoot: string,
  adapterId: string,
  options: ReleaseEvidenceEnvironmentSummaryOptions = {}
): ReleaseEvidenceEnvironmentSummary {
  const hostDiscovery = readHostDiscoverySummary(workspaceRoot, adapterId);
  const loadedHostPreflight = readLoadedHostPreflightSummary(workspaceRoot, adapterId);
  const releaseValidEvidenceKinds = new Set(options.releaseValidEvidenceKinds ?? []);
  const blockers = [
    ...hostDiscoveryBlockers(hostDiscovery),
    ...loadedHostPreflightBlockers(loadedHostPreflight, releaseValidEvidenceKinds)
  ];

  return {
    hostDiscovery,
    loadedHostPreflight,
    blockers
  };
}

function readHostDiscoverySummary(
  workspaceRoot: string,
  adapterId: string
): ReleaseEvidenceHostDiscoverySummary | null {
  const receiptPath = `${receiptRoot}/${adapterId}/${hostDiscoveryReceiptName}`;
  const receipt = readReceipt(workspaceRoot, receiptPath);

  if (receipt?.receipt !== "dx.extension.platform_host_discovery" || receipt.adapterId !== adapterId) {
    return null;
  }

  return {
    receiptPath,
    status: readString(receipt.status),
    reason: readString(receipt.reason),
    foundRequiredTools: readFoundRequiredTools(receipt.tools),
    missingRequiredTools: readStringArray(receipt.missingRequiredTools)
  };
}

function readLoadedHostPreflightSummary(
  workspaceRoot: string,
  adapterId: string
): ReleaseEvidenceLoadedHostPreflightSummary | null {
  const receiptPath = `${receiptRoot}/${adapterId}/${loadedHostPreflightReceiptName}`;
  const receipt = readReceipt(workspaceRoot, receiptPath);

  if (receipt?.receipt !== "dx.extension.loaded_host_preflight" || receipt.adapterId !== adapterId) {
    return null;
  }

  const readiness = readRecord(receipt.readiness);

  return {
    receiptPath,
    nextProof: readString(readiness?.nextProof),
    blockedBy: readStringArray(readiness?.blockedBy),
    packageLinkProblem: staleLoadedHostPreflightPackageLinkReason(workspaceRoot, adapterId) ?? null,
    preflightClaims: readBooleanRecord(receipt.preflightClaims)
  };
}

function hostDiscoveryBlockers(summary: ReleaseEvidenceHostDiscoverySummary | null): string[] {
  if (!summary) {
    return [];
  }

  const blockers = summary.status === "candidate-found" || !summary.reason
    ? []
    : [`host discovery: ${summary.reason}`];

  return [
    ...blockers,
    ...summary.missingRequiredTools.map((tool) => `missing required tool: ${tool}`)
  ];
}

function loadedHostPreflightBlockers(
  summary: ReleaseEvidenceLoadedHostPreflightSummary | null,
  releaseValidEvidenceKinds: Set<string>
): string[] {
  if (summary?.packageLinkProblem) {
    return [`loaded-host preflight: ${summary.packageLinkProblem}`];
  }

  return (
    summary?.blockedBy
      .filter((blocker) => {
        const evidenceKind = releaseBlockerEvidenceKind(blocker);

        return !evidenceKind || !releaseValidEvidenceKinds.has(evidenceKind);
      })
      .map((blocker) => `loaded-host preflight: ${blocker}`) ?? []
  );
}

function readReceipt(workspaceRoot: string, relativePath: string): Record<string, unknown> | null {
  const absolutePath = join(workspaceRoot, ...relativePath.split("/"));

  if (!existsSync(absolutePath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(absolutePath, "utf8"));
    return readRecord(parsed) ?? null;
  } catch {
    return null;
  }
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim())
    ? [...value]
    : [];
}

function readFoundRequiredTools(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((tool) => {
    const record = readRecord(tool);
    const id = readString(record?.id);

    return record?.required === true && record.found === true && id ? [id] : [];
  });
}

function readBooleanRecord(value: unknown): Record<string, boolean> {
  const record = readRecord(value);

  if (!record) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(record).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean")
  );
}
