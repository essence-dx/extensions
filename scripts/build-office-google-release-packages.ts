import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyPackageOutputReceipt } from "./lib/package-output-proof.ts";
import { writeStoredZip } from "./lib/stored-zip-writer.ts";
import type { ReleasePackageChecksumProof } from "./write-release-package-checksum-receipts.ts";

export interface OfficeGoogleReleasePackageTarget {
  adapterId: string;
  host: string;
  artifactName: string;
}

export interface OfficeGoogleReleasePackageOptions {
  artifactRoot?: string;
  proofPath?: string;
}

export interface OfficeGoogleReleasePackageResult {
  proofPath: string;
  artifacts: Array<{
    adapterId: string;
    path: string;
    bytes: number;
    sha256: string;
    entries: number;
  }>;
  proofs: ReleasePackageChecksumProof[];
}

interface PackageOutputReceipt {
  package?: {
    files?: unknown;
  };
}

interface PackageOutputFile {
  relativePath: string;
}

export const officeGoogleReleasePackageTargets: OfficeGoogleReleasePackageTarget[] = [
  {
    adapterId: "dx.excel.command-center",
    host: "excel",
    artifactName: "dx-excel-command-center"
  },
  {
    adapterId: "dx.powerpoint.command-center",
    host: "powerpoint",
    artifactName: "dx-powerpoint-command-center"
  },
  {
    adapterId: "dx.word.command-center",
    host: "word",
    artifactName: "dx-word-command-center"
  },
  {
    adapterId: "dx.google-workspace.command-center",
    host: "google-workspace",
    artifactName: "dx-google-workspace-command-center"
  }
];

export function buildOfficeGoogleReleasePackages(
  root = process.cwd(),
  options: OfficeGoogleReleasePackageOptions = {}
): OfficeGoogleReleasePackageResult {
  const workspaceRoot = resolve(root);
  const artifactRoot = resolve(
    workspaceRoot,
    options.artifactRoot ?? join(".tmp", "release-packages", "office-google")
  );
  const proofPath = resolve(
    workspaceRoot,
    options.proofPath ?? join(".tmp", "proofs", "office-google-release-package-checksums.json")
  );
  const artifacts: OfficeGoogleReleasePackageResult["artifacts"] = [];
  const proofs: ReleasePackageChecksumProof[] = [];

  for (const target of officeGoogleReleasePackageTargets) {
    const packageOutputReceiptPath = join(
      workspaceRoot,
      ".dx",
      "receipts",
      "extensions",
      target.adapterId,
      "package-output-latest.json"
    );
    const receiptBytes = readFileSync(packageOutputReceiptPath);
    const receipt = JSON.parse(receiptBytes.toString("utf8")) as PackageOutputReceipt;
    const packageOutputProof = verifyPackageOutputReceipt(target.adapterId, receipt);

    if (packageOutputProof.host !== target.host) {
      throw new Error(`Office/Google release package host mismatch for ${target.adapterId}.`);
    }

    const files = readPackageOutputFiles(target.adapterId, receipt);
    const artifactPath = join(artifactRoot, `${target.artifactName}.zip`);
    const zip = writeStoredZip(
      artifactPath,
      files.map((file) => ({
        relativePath: file.relativePath,
        sourcePath: join(packageOutputProof.root, ...file.relativePath.split("/"))
      }))
    );

    artifacts.push({
      adapterId: target.adapterId,
      path: zip.path,
      bytes: zip.bytes,
      sha256: zip.sha256,
      entries: zip.entries.length
    });
    proofs.push({
      adapterId: target.adapterId,
      host: target.host,
      packageOutputReceiptPath,
      packageOutputSha256: packageOutputProof.sha256,
      releaseArtifactPath: zip.path,
      releaseArtifactSha256: zip.sha256,
      releaseArtifactKind: "zip",
      artifactCreatedFromPackageOutput: true
    });
  }

  mkdirSync(dirname(proofPath), { recursive: true });
  writeFileSync(proofPath, `${JSON.stringify(proofs, null, 2)}\n`);

  return {
    proofPath,
    artifacts,
    proofs
  };
}

if (isDirectRun()) {
  try {
    const result = buildOfficeGoogleReleasePackages(process.cwd(), parseOptions(process.argv.slice(2)));
    console.log(`Office/Google release package proof written: ${result.proofPath}`);

    for (const artifact of result.artifacts) {
      console.log(`Office/Google release package artifact written: ${artifact.path}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function readPackageOutputFiles(adapterId: string, receipt: PackageOutputReceipt): PackageOutputFile[] {
  const files = receipt.package?.files;

  if (!Array.isArray(files)) {
    throw new Error(`Office/Google release package files are missing for ${adapterId}.`);
  }

  const seen = new Set<string>();

  return files.map((file) => {
    const relativePath = normalizeRelativePath(adapterId, file?.relativePath);

    if (seen.has(relativePath)) {
      throw new Error(`Office/Google release package duplicate file for ${adapterId}: ${relativePath}`);
    }

    seen.add(relativePath);
    return { relativePath };
  });
}

function normalizeRelativePath(adapterId: string, value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Office/Google release package file path is missing for ${adapterId}.`);
  }

  const relativePath = value.replaceAll("\\", "/");
  const parts = relativePath.split("/");

  if (
    relativePath.startsWith("/") ||
    relativePath.startsWith("~") ||
    relativePath.includes("://") ||
    parts.some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(`Office/Google release package file path is unsafe for ${adapterId}: ${value}`);
  }

  return relativePath;
}

function parseOptions(args: string[]): OfficeGoogleReleasePackageOptions {
  const options: OfficeGoogleReleasePackageOptions = {};

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

    throw new Error(`Unsupported Office/Google release package argument: ${argument}`);
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
