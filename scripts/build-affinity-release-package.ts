import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyPackageOutputReceipt } from "./lib/package-output-proof.ts";
import {
  readPackageEvidenceReceiptPaths,
  resolvePackageEvidenceReceiptPath
} from "./lib/package-evidence-receipt-paths.ts";
import { writeStoredZip } from "./lib/stored-zip-writer.ts";
import type { ReleasePackageChecksumProof } from "./write-release-package-checksum-receipts.ts";

export interface AffinityReleasePackageOptions {
  artifactRoot?: string;
  proofPath?: string;
}

export interface AffinityReleasePackageResult {
  proofPath: string;
  artifact: {
    path: string;
    bytes: number;
    sha256: string;
    entries: number;
  };
  proof: ReleasePackageChecksumProof;
}

interface AffinityContentPackageReceipt {
  package?: {
    files?: unknown;
  };
  contentArtifacts?: unknown;
}

interface AffinityContentPackageFile {
  relativePath: string;
}

const adapterId = "dx.affinity-content.bridge";
const host = "affinity";
const artifactName = "dx-affinity-content-bridge.zip";

export function buildAffinityReleasePackage(
  root = process.cwd(),
  options: AffinityReleasePackageOptions = {}
): AffinityReleasePackageResult {
  const workspaceRoot = resolve(root);
  const artifactRoot = resolve(
    workspaceRoot,
    options.artifactRoot ?? join(".tmp", "release-packages", "affinity")
  );
  const proofPath = resolve(
    workspaceRoot,
    options.proofPath ?? join(".tmp", "proofs", "affinity-release-package-checksum.json")
  );
  const packageOutputReceiptPath = resolvePackageEvidenceReceiptPath(
    workspaceRoot,
    adapterId,
    readPackageEvidenceReceiptPaths(workspaceRoot),
    "content-package-latest.json"
  );
  const receiptBytes = readFileSync(packageOutputReceiptPath);
  const receipt = JSON.parse(receiptBytes.toString("utf8")) as AffinityContentPackageReceipt;
  const packageOutputProof = verifyPackageOutputReceipt(adapterId, receipt);

  if (packageOutputProof.host !== host) {
    throw new Error("Affinity release package host mismatch.");
  }

  assertImportableContentPackage(receipt);
  const files = readPackageFiles(receipt);
  const zip = writeStoredZip(
    join(artifactRoot, artifactName),
    files.map((file) => ({
      relativePath: file.relativePath,
      sourcePath: join(packageOutputProof.root, ...file.relativePath.split("/"))
    }))
  );
  const proof: ReleasePackageChecksumProof = {
    adapterId,
    host,
    packageOutputReceiptPath,
    packageOutputSha256: packageOutputProof.sha256,
    releaseArtifactPath: zip.path,
    releaseArtifactSha256: zip.sha256,
    releaseArtifactKind: "zip",
    artifactCreatedFromPackageOutput: true
  };

  mkdirSync(dirname(proofPath), { recursive: true });
  writeFileSync(proofPath, `${JSON.stringify(proof, null, 2)}\n`);

  return {
    proofPath,
    artifact: {
      path: zip.path,
      bytes: zip.bytes,
      sha256: zip.sha256,
      entries: zip.entries.length
    },
    proof
  };
}

if (isDirectRun()) {
  try {
    const result = buildAffinityReleasePackage(process.cwd(), parseOptions(process.argv.slice(2)));
    console.log(`Affinity release package proof written: ${result.proofPath}`);
    console.log(`Affinity release package artifact written: ${result.artifact.path}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function assertImportableContentPackage(receipt: AffinityContentPackageReceipt): void {
  if (!Array.isArray(receipt.contentArtifacts) || receipt.contentArtifacts.length === 0) {
    throw new Error("Affinity release package must include importable content artifacts.");
  }
}

function readPackageFiles(receipt: AffinityContentPackageReceipt): AffinityContentPackageFile[] {
  const files = receipt.package?.files;

  if (!Array.isArray(files)) {
    throw new Error("Affinity release package files are missing.");
  }

  const seen = new Set<string>();

  return files.map((file) => {
    const relativePath = normalizeRelativePath(file?.relativePath);

    if (seen.has(relativePath)) {
      throw new Error(`Affinity release package duplicate file: ${relativePath}`);
    }

    seen.add(relativePath);
    return { relativePath };
  });
}

function normalizeRelativePath(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("Affinity release package file path is missing.");
  }

  const relativePath = value.replaceAll("\\", "/");
  const parts = relativePath.split("/");

  if (
    relativePath.startsWith("/") ||
    relativePath.startsWith("~") ||
    relativePath.includes("://") ||
    parts.some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(`Affinity release package file path is unsafe: ${value}`);
  }

  return relativePath;
}

function parseOptions(args: string[]): AffinityReleasePackageOptions {
  const options: AffinityReleasePackageOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--artifact-root") {
      options.artifactRoot = readOptionValue(args, index, argument);
      index += 1;
      continue;
    }

    if (argument === "--proof-json") {
      options.proofPath = readOptionValue(args, index, argument);
      index += 1;
      continue;
    }

    throw new Error(`Unsupported Affinity release package argument: ${argument}`);
  }

  return options;
}

function readOptionValue(args: string[], index: number, optionName: string): string {
  const value = args[index + 1];

  if (!value) {
    throw new Error(`${optionName} requires a path value.`);
  }

  return value;
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
