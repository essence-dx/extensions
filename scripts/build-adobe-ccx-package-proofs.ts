import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyPackageOutputReceipt } from "./lib/package-output-proof.ts";
import { classifyPackageOutputWeakness } from "./lib/release-evidence-package-output-classifier.ts";
import type { ReceiptRecord } from "./lib/release-evidence-receipt-primitives.ts";
import { writeStoredZip } from "./lib/stored-zip-writer.ts";
import type { AdobeCcxPackageProof } from "./write-adobe-ccx-package-receipts.ts";

interface AdobeCcxPackageTarget {
  adapterId: AdobeCcxPackageProof["adapterId"];
  host: AdobeCcxPackageProof["host"];
}

interface PackageOutputReceipt {
  package?: {
    files?: unknown;
  };
}

interface PackageOutputFile {
  relativePath: string;
}

export interface AdobeCcxPackageProofOptions {
  artifactRoot?: string;
  proofPath?: string;
  adapterIds?: string[];
}

export interface AdobeCcxPackageProofResult {
  proofPath: string;
  artifacts: Array<{
    adapterId: AdobeCcxPackageProof["adapterId"];
    path: string;
    bytes: number;
    sha256: string;
    entries: number;
  }>;
  proofs: AdobeCcxPackageProof[];
}

export const adobeCcxPackageTargets: AdobeCcxPackageTarget[] = [
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

const packagingToolVersion = "0.1.0";

export function buildAdobeCcxPackageProofs(
  root = process.cwd(),
  options: AdobeCcxPackageProofOptions = {}
): AdobeCcxPackageProofResult {
  const workspaceRoot = resolve(root);
  const artifactRoot = resolve(workspaceRoot, options.artifactRoot ?? join(".tmp", "release-packages", "adobe-ccx"));
  const proofPath = resolve(workspaceRoot, options.proofPath ?? join(".tmp", "proofs", "adobe-ccx-package-proofs.json"));
  const targets = selectAdobeCcxPackageTargets(options.adapterIds);
  const artifacts: AdobeCcxPackageProofResult["artifacts"] = [];
  const proofs: AdobeCcxPackageProof[] = [];

  for (const target of targets) {
    const packageOutputReceiptPath = join(
      workspaceRoot,
      ".dx",
      "receipts",
      "extensions",
      target.adapterId,
      "package-output-latest.json"
    );
    const receipt = JSON.parse(readFileSync(packageOutputReceiptPath, "utf8")) as PackageOutputReceipt;
    const weakness = classifyPackageOutputWeakness("package_output", receipt as ReceiptRecord);

    if (weakness) {
      throw new Error(`Adobe CCX package target ${target.adapterId} is not package-output valid: ${weakness}`);
    }

    const packageOutput = verifyPackageOutputReceipt(target.adapterId, receipt);

    if (packageOutput.host !== target.host) {
      throw new Error(`Adobe CCX package host mismatch for ${target.adapterId}.`);
    }

    const files = readPackageOutputFiles(target.adapterId, receipt);
    const ccx = writeStoredZip(
      join(artifactRoot, target.host, "dx-command-center.ccx"),
      files.map((file) => ({
        relativePath: file.relativePath,
        sourcePath: join(packageOutput.root, ...file.relativePath.split("/"))
      }))
    );

    artifacts.push({
      adapterId: target.adapterId,
      path: ccx.path,
      bytes: ccx.bytes,
      sha256: ccx.sha256,
      entries: ccx.entries.length
    });
    proofs.push({
      adapterId: target.adapterId,
      host: target.host,
      packageOutputReceiptPath,
      ccxArtifactPath: ccx.path,
      sourcePackageRoot: packageOutput.root,
      packagingTool: "dx-ccx-packager",
      packagingToolVersion
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
    const result = buildAdobeCcxPackageProofs(process.cwd(), parseOptions(process.argv.slice(2)));
    console.log(`Adobe CCX package proof written: ${result.proofPath}`);

    for (const artifact of result.artifacts) {
      console.log(`Adobe CCX package artifact written: ${artifact.path}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function readPackageOutputFiles(adapterId: string, receipt: PackageOutputReceipt): PackageOutputFile[] {
  const files = receipt.package?.files;

  if (!Array.isArray(files)) {
    throw new Error(`Adobe CCX package files are missing for ${adapterId}`);
  }

  const seen = new Set<string>();

  return files.map((file) => {
    const relativePath = normalizeRelativePath(adapterId, file?.relativePath);

    if (seen.has(relativePath)) {
      throw new Error(`Adobe CCX package duplicate file for ${adapterId}: ${relativePath}`);
    }

    seen.add(relativePath);
    return { relativePath };
  });
}

function normalizeRelativePath(adapterId: string, value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Adobe CCX package file path is missing for ${adapterId}`);
  }

  const relativePath = normalize(value).replaceAll("\\", "/");
  const parts = relativePath.split("/");

  if (
    relativePath.startsWith("/") ||
    relativePath.startsWith("~") ||
    relativePath.includes("://") ||
    parts.some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(`Adobe CCX package file path is unsafe for ${adapterId}: ${value}`);
  }

  return relativePath;
}

function parseOptions(args: string[]): AdobeCcxPackageProofOptions {
  const options: AdobeCcxPackageProofOptions = {};
  const adapterIds: string[] = [];

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

    if (argument === "--adapter-id") {
      adapterIds.push(readOptionValue(args, index, argument));
      index += 1;
      continue;
    }

    throw new Error(`Unsupported Adobe CCX package proof argument: ${argument}`);
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

function selectAdobeCcxPackageTargets(adapterIds: string[] | undefined): AdobeCcxPackageTarget[] {
  if (!adapterIds || adapterIds.length === 0) {
    return adobeCcxPackageTargets;
  }

  const requestedIds = new Set<string>();

  for (const adapterId of adapterIds) {
    const normalizedAdapterId = adapterId.trim();

    if (!/^[a-z0-9.-]+$/.test(normalizedAdapterId)) {
      throw new Error(`Adobe CCX package adapter id is unsafe: ${adapterId}`);
    }

    requestedIds.add(normalizedAdapterId);
  }

  const selectedTargets = adobeCcxPackageTargets.filter((target) => requestedIds.has(target.adapterId));
  const selectedIds = new Set(selectedTargets.map((target) => target.adapterId));
  const unsupportedIds = [...requestedIds].filter((adapterId) => !selectedIds.has(adapterId));

  if (unsupportedIds.length > 0) {
    throw new Error(`Adobe CCX package adapter id is unsupported: ${unsupportedIds.join(", ")}`);
  }

  return selectedTargets;
}

function isDirectRun(): boolean {
  return process.argv[1] ? normalize(process.argv[1]) === normalize(fileURLToPath(import.meta.url)) : false;
}
