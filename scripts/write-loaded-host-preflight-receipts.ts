import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyPackageOutputReceipt } from "./lib/package-output-proof.ts";
import { readReleaseEvidenceById } from "./lib/extension-progress-release-evidence.ts";
import { releaseBlockerEvidenceKind } from "./lib/release-evidence-blocker-mapping.ts";
import { parseTomlDocument } from "./lib/toml-lite.ts";
import {
  readPackageEvidenceReceiptPaths,
  resolvePackageEvidenceReceiptPath
} from "./lib/package-evidence-receipt-paths.ts";
import { validateExtensionReadiness } from "./validate-extension-readiness.ts";
import type { ReleaseEvidenceGapEntry } from "./write-release-evidence-gap-report.ts";

export interface LoadedHostPreflightReceiptOptions {
  adapterIds?: string[];
  generatedAt?: Date | string;
  verificationCommand?: string;
}

export interface LoadedHostPreflightReceiptResult {
  written: LoadedHostPreflightReceiptPointer[];
}

export interface LoadedHostPreflightReceiptPointer {
  adapterId: string;
  path: string;
}

export interface LoadedHostPreflightReceipt {
  receipt: "dx.extension.loaded_host_preflight";
  adapterId: string;
  host: string;
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  packageOutputReceiptPath: string;
  packageOutputReceiptSha256: string;
  readiness: {
    stage: "source-level";
    manifest: string;
    sourceGuard: string;
    nextProof: string;
    blockedBy: string[];
  };
  packageOutput: {
    payloadKind: "package" | "bundle";
    root: string;
    fileCount: number;
    filesVerified: number;
    sha256: string;
  };
  releaseClaims: {
    keys: string[];
    allFalse: true;
  };
  preflightClaims: {
    hostExecuted: false;
    loadedHostVerified: false;
    releaseReady: false;
    marketplaceOrStoreVerified: false;
  };
}

interface ReadinessEntry {
  id: string;
  stage: string;
  manifest: string;
  source_guard: string;
  next_proof: string;
  blocked_by: string[];
}

const readinessRelativePath = "registry/extension-readiness.toml";
const receiptDirectory = ".dx/receipts/extensions";
const loadedHostPreflightReceiptName = "loaded-host-preflight-latest.json";

export function writeLoadedHostPreflightReceipts(
  root = process.cwd(),
  options: LoadedHostPreflightReceiptOptions = {}
): LoadedHostPreflightReceiptResult {
  const workspaceRoot = resolve(root);
  const generatedAt = normalizeGeneratedAt(options.generatedAt);
  const verificationCommand = options.verificationCommand ?? "npm run preflight:loaded-host-targets:j1";
  const readinessById = readSourceLevelReadinessEntries(workspaceRoot);
  const releaseEvidenceById = readReleaseEvidenceById(workspaceRoot, generatedAt);
  const packageEvidenceReceiptById = readPackageEvidenceReceiptPaths(workspaceRoot);
  const adapterIds = resolveAdapterIds(workspaceRoot, readinessById, options.adapterIds, packageEvidenceReceiptById);
  const written: LoadedHostPreflightReceiptPointer[] = [];

  for (const adapterId of adapterIds) {
    const readiness = readinessById.get(adapterId);

    if (!readiness) {
      throw new Error(`loaded-host preflight adapter is missing source-level readiness: ${adapterId}`);
    }

    const packageOutputReceiptPath = resolvePackageEvidenceReceiptPath(
      workspaceRoot,
      adapterId,
      packageEvidenceReceiptById
    );
    const packageOutputReceiptSource = readFileSync(packageOutputReceiptPath);
    const packageOutputReceipt = JSON.parse(packageOutputReceiptSource.toString("utf8"));
    const packageProof = verifyPackageOutputReceipt(adapterId, packageOutputReceipt);
    const receiptPath = join(workspaceRoot, receiptDirectory, adapterId, loadedHostPreflightReceiptName);
    const receipt: LoadedHostPreflightReceipt = {
      receipt: "dx.extension.loaded_host_preflight",
      adapterId,
      host: packageProof.host,
      generatedAt,
      verificationCommand,
      receiptPath,
      packageOutputReceiptPath,
      packageOutputReceiptSha256: createHash("sha256").update(packageOutputReceiptSource).digest("hex"),
      readiness: {
        stage: "source-level",
        manifest: readiness.manifest,
        sourceGuard: readiness.source_guard,
        nextProof: readiness.next_proof,
        blockedBy: unresolvedLoadedHostPreflightBlockers(
          readiness.blocked_by,
          releaseEvidenceById.get(adapterId)
        )
      },
      packageOutput: {
        payloadKind: packageProof.payloadKind,
        root: packageProof.root,
        fileCount: packageProof.fileCount,
        filesVerified: packageProof.filesVerified,
        sha256: packageProof.sha256
      },
      releaseClaims: {
        keys: packageProof.releaseClaimKeys,
        allFalse: true
      },
      preflightClaims: {
        hostExecuted: false,
        loadedHostVerified: false,
        releaseReady: false,
        marketplaceOrStoreVerified: false
      }
    };

    mkdirSync(dirname(receiptPath), { recursive: true });
    writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
    written.push({
      adapterId,
      path: receiptPath
    });
  }

  return { written };
}

if (isDirectRun()) {
  const result = writeLoadedHostPreflightReceipts(process.cwd(), parseCliOptions(process.argv.slice(2)));

  console.log(`Loaded-host preflight receipts written: ${result.written.length}`);
}

function parseCliOptions(args: string[]): LoadedHostPreflightReceiptOptions {
  const options: LoadedHostPreflightReceiptOptions = {
    verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run preflight:loaded-host-targets:j1"
  };
  const adapterIds: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--adapter-id" && index + 1 < args.length) {
      adapterIds.push(args[index + 1]);
      index += 1;
      continue;
    }

    if (argument === "--generated-at" && index + 1 < args.length) {
      options.generatedAt = args[index + 1];
      index += 1;
      continue;
    }

    if (argument === "--verification-command" && index + 1 < args.length) {
      options.verificationCommand = args[index + 1];
      index += 1;
      continue;
    }

    throw new Error(`Unsupported loaded-host preflight receipt argument: ${argument}`);
  }

  if (adapterIds.length > 0) {
    options.adapterIds = adapterIds;
  }

  return options;
}

function resolveAdapterIds(
  workspaceRoot: string,
  readinessById: Map<string, ReadinessEntry>,
  adapterIds: string[] | undefined,
  packageEvidenceReceiptById: Map<string, string>
): string[] {
  if (adapterIds) {
    return adapterIds.map((id) => id.trim()).filter(Boolean).sort();
  }

  const receiptsRoot = join(workspaceRoot, receiptDirectory);
  if (!existsSync(receiptsRoot)) {
    return [];
  }

  return readdirSync(receiptsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((adapterId) => readinessById.has(adapterId))
    .filter((adapterId) =>
      existsSync(resolvePackageEvidenceReceiptPath(workspaceRoot, adapterId, packageEvidenceReceiptById))
    )
    .sort();
}

function unresolvedLoadedHostPreflightBlockers(
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

function readSourceLevelReadinessEntries(workspaceRoot: string): Map<string, ReadinessEntry> {
  const readinessFailures = validateExtensionReadiness(workspaceRoot);

  if (readinessFailures.length > 0) {
    throw new Error(readinessFailures.join("\n"));
  }

  const readinessPath = join(workspaceRoot, readinessRelativePath);
  const readiness = parseTomlDocument(readFileSync(readinessPath, "utf8"));
  const entries = new Map<string, ReadinessEntry>();

  for (const entry of readiness.arrays.extensions ?? []) {
    if (entry.stage !== "source-level") {
      continue;
    }

    entries.set(entry.id, {
      id: entry.id,
      stage: entry.stage,
      manifest: entry.manifest,
      source_guard: entry.source_guard,
      next_proof: entry.next_proof,
      blocked_by: entry.blocked_by
    });
  }

  return entries;
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
