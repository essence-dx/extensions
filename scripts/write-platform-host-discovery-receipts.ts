import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defaultPlatformHostDiscoveryTargets } from "./platform-host-discovery-targets.ts";

import type {
  PlatformHostDiscoveryMode,
  PlatformHostDiscoveryPointer,
  PlatformHostDiscoveryResult,
  PlatformHostDiscoveryStatus,
  PlatformHostDiscoveryTarget,
  PlatformHostToolDiscovery,
  PlatformHostToolRequirement
} from "./platform-host-discovery-model.ts";

export { defaultPlatformHostDiscoveryTargets };
export type {
  PlatformHostDiscoveryMode,
  PlatformHostDiscoveryPointer,
  PlatformHostDiscoveryResult,
  PlatformHostDiscoveryStatus,
  PlatformHostDiscoveryTarget,
  PlatformHostToolDiscovery,
  PlatformHostToolRequirement
} from "./platform-host-discovery-model.ts";

export interface PlatformHostDiscoveryOptions {
  targets?: PlatformHostDiscoveryTarget[];
  generatedAt?: Date | string;
  verificationCommand?: string;
}

const receiptDirectory = ".dx/receipts/extensions";
const receiptName = "host-discovery-latest.json";

export function writePlatformHostDiscoveryReceipts(
  root = process.cwd(),
  options: PlatformHostDiscoveryOptions = {}
): PlatformHostDiscoveryResult {
  const workspaceRoot = resolve(root);
  const generatedAt = normalizeGeneratedAt(options.generatedAt);
  const verificationCommand = options.verificationCommand ?? "npm run preflight:platform-host-discovery:j1";
  const targets = [...(options.targets ?? defaultPlatformHostDiscoveryTargets)].sort((left, right) =>
    left.adapterId.localeCompare(right.adapterId)
  );
  const written: PlatformHostDiscoveryPointer[] = [];

  for (const target of targets) {
    const discoveryMode = target.discoveryMode ?? "local-tooling";
    const tools = target.tools.map((tool) => discoverTool(tool));
    const missingRequiredTools = tools
      .filter((tool) => tool.required && !tool.found)
      .map((tool) => tool.id);
    const discoveryStatus = resolveDiscoveryStatus(target, discoveryMode, missingRequiredTools);
    const receiptPath = join(workspaceRoot, receiptDirectory, target.adapterId, receiptName);
    const receipt = {
      receipt: "dx.extension.platform_host_discovery",
      adapterId: target.adapterId,
      discoveryMode,
      host: target.host,
      generatedAt,
      verificationCommand,
      receiptPath,
      status: discoveryStatus.status,
      reason: discoveryStatus.reason,
      notes: target.notes ?? [],
      candidateFound: discoveryStatus.status === "candidate-found",
      missingRequiredTools,
      tools,
      preflightClaims: {
        hostExecuted: false,
        loadedHostVerified: false,
        releaseReady: false
      }
    };

    mkdirSync(dirname(receiptPath), { recursive: true });
    writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
    written.push({
      adapterId: target.adapterId,
      path: receiptPath
    });
  }

  return { written };
}

if (isDirectRun()) {
  const result = writePlatformHostDiscoveryReceipts(process.cwd(), {
    verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run preflight:platform-host-discovery:j1"
  });

  console.log(`Platform host discovery receipts written: ${result.written.length}`);
}

function resolveDiscoveryStatus(
  target: PlatformHostDiscoveryTarget,
  discoveryMode: PlatformHostDiscoveryMode,
  missingRequiredTools: string[]
): { status: PlatformHostDiscoveryStatus; reason: string } {
  if (discoveryMode === "manual-only") {
    return {
      status: "manual-only",
      reason: target.readyReason ?? "manual_proof_required"
    };
  }

  if (discoveryMode === "cloud-service") {
    return {
      status: "cloud-service",
      reason: target.readyReason ?? "cloud_service_proof_required"
    };
  }

  const requiredToolsFound = missingRequiredTools.length === 0;

  return {
    status: requiredToolsFound ? "candidate-found" : "missing",
    reason: requiredToolsFound ? target.readyReason ?? "required_tools_found" : target.unavailableReason
  };
}

function discoverTool(requirement: PlatformHostToolRequirement): PlatformHostToolDiscovery {
  const candidatePaths = [
    ...(requirement.candidatePaths ?? []),
    ...resolvePathCandidates(requirement.executableNames ?? [])
  ];
  const foundPath = candidatePaths.find((candidatePath) => existsSync(candidatePath));

  return {
    id: requirement.id,
    label: requirement.label,
    required: requirement.required,
    found: Boolean(foundPath),
    path: foundPath ?? null,
    candidatesChecked: candidatePaths.length
  };
}

function resolvePathCandidates(executableNames: string[]): string[] {
  const pathEntries = (process.env.PATH ?? "")
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);

  return pathEntries.flatMap((entry) => executableNames.map((name) => join(entry, name)));
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
