import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyPackageOutputReceipt } from "./lib/package-output-proof.ts";
import { classifyPackageOutputWeakness } from "./lib/release-evidence-package-output-classifier.ts";
import type { ReceiptRecord } from "./lib/release-evidence-receipt-primitives.ts";
import { writeStoredZip } from "./lib/stored-zip-writer.ts";
import type { ReleasePackageChecksumProof } from "./write-release-package-checksum-receipts.ts";

export interface PackageOutputReleasePackageTarget {
  adapterId: string;
  host: string;
  artifactName: string;
}

export interface PackageOutputReleasePackageOptions {
  artifactRoot?: string;
  proofPath?: string;
  adapterIds?: string[];
}

export interface PackageOutputReleasePackageResult {
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
  bundle?: {
    files?: unknown;
  };
}

interface PackageOutputFile {
  relativePath: string;
}

export const packageOutputReleasePackageTargets: PackageOutputReleasePackageTarget[] = [
  {
    adapterId: "dx.blender.command-center",
    host: "blender",
    artifactName: "dx-blender-command-center"
  },
  {
    adapterId: "dx.browser.command-center",
    host: "browser",
    artifactName: "dx-browser-command-center"
  },
  {
    adapterId: "dx.canva.command-center",
    host: "canva",
    artifactName: "dx-canva-command-center"
  },
  {
    adapterId: "dx.davinci-resolve.command-center",
    host: "davinci-resolve",
    artifactName: "dx-davinci-resolve-command-center"
  },
  {
    adapterId: "dx.figma.command-center",
    host: "figma",
    artifactName: "dx-figma-command-center"
  },
  {
    adapterId: "dx.indesign.command-center",
    host: "indesign",
    artifactName: "dx-indesign-command-center"
  },
  {
    adapterId: "dx.intellij-platform.command-center",
    host: "intellij-platform",
    artifactName: "dx-intellij-platform-command-center"
  },
  {
    adapterId: "dx.obsidian.command-center",
    host: "obsidian",
    artifactName: "dx-obsidian-command-center"
  },
  {
    adapterId: "dx.photoshop.command-center",
    host: "photoshop",
    artifactName: "dx-photoshop-command-center"
  },
  {
    adapterId: "dx.premiere-pro.command-center",
    host: "premiere-pro",
    artifactName: "dx-premiere-pro-command-center"
  },
  {
    adapterId: "dx.sketch.command-center",
    host: "sketch",
    artifactName: "dx-sketch-command-center"
  },
  {
    adapterId: "dx.unity-editor.command-center",
    host: "unity-editor",
    artifactName: "dx-unity-editor-command-center"
  },
  {
    adapterId: "dx.unreal-engine.command-center",
    host: "unreal-engine",
    artifactName: "dx-unreal-engine-command-center"
  },
  {
    adapterId: "dx.visual-studio.command-center",
    host: "visual-studio",
    artifactName: "dx-visual-studio-command-center"
  },
  {
    adapterId: "dx.vscode.command-center",
    host: "vscode",
    artifactName: "dx-vscode-command-center"
  },
  {
    adapterId: "dx.zed.command-center",
    host: "zed",
    artifactName: "dx-zed-command-center"
  }
];

export function buildPackageOutputReleasePackages(
  root = process.cwd(),
  options: PackageOutputReleasePackageOptions = {}
): PackageOutputReleasePackageResult {
  const workspaceRoot = resolve(root);
  const artifactRoot = resolve(
    workspaceRoot,
    options.artifactRoot ?? join(".tmp", "release-packages", "package-output")
  );
  const proofPath = resolve(
    workspaceRoot,
    options.proofPath ?? join(".tmp", "proofs", "package-output-release-package-checksums.json")
  );
  const artifacts: PackageOutputReleasePackageResult["artifacts"] = [];
  const proofs: ReleasePackageChecksumProof[] = [];
  const targets = selectPackageOutputReleasePackageTargets(options.adapterIds);

  for (const target of targets) {
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
    const weakness = classifyPackageOutputWeakness("package_output", receipt as ReceiptRecord);

    if (weakness) {
      throw new Error(
        `Package-output release package target ${target.adapterId} is not release-valid: ${weakness}`
      );
    }

    const packageOutputProof = verifyPackageOutputReceipt(target.adapterId, receipt);

    if (packageOutputProof.host !== target.host) {
      throw new Error(`Package-output release package host mismatch for ${target.adapterId}.`);
    }

    const files = readPackageOutputFiles(target.adapterId, receipt);
    const zip = writeStoredZip(
      join(artifactRoot, `${target.artifactName}.zip`),
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
    const result = buildPackageOutputReleasePackages(process.cwd(), parseOptions(process.argv.slice(2)));
    console.log(`Package-output release package proof written: ${result.proofPath}`);

    for (const artifact of result.artifacts) {
      console.log(`Package-output release package artifact written: ${artifact.path}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function readPackageOutputFiles(adapterId: string, receipt: PackageOutputReceipt): PackageOutputFile[] {
  const files = receipt.package?.files ?? receipt.bundle?.files;

  if (!Array.isArray(files)) {
    throw new Error(`Package-output release package files are missing for ${adapterId}.`);
  }

  const seen = new Set<string>();

  return files.map((file) => {
    const relativePath = normalizeRelativePath(adapterId, file?.relativePath);

    if (seen.has(relativePath)) {
      throw new Error(`Package-output release package duplicate file for ${adapterId}: ${relativePath}`);
    }

    seen.add(relativePath);
    return { relativePath };
  });
}

function normalizeRelativePath(adapterId: string, value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Package-output release package file path is missing for ${adapterId}.`);
  }

  const relativePath = value.replaceAll("\\", "/");
  const parts = relativePath.split("/");

  if (
    relativePath.startsWith("/") ||
    relativePath.startsWith("~") ||
    relativePath.includes("://") ||
    parts.some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(`Package-output release package file path is unsafe for ${adapterId}: ${value}`);
  }

  return relativePath;
}

function parseOptions(args: string[]): PackageOutputReleasePackageOptions {
  const options: PackageOutputReleasePackageOptions = {};
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

    throw new Error(`Unsupported package-output release package argument: ${argument}`);
  }

  if (adapterIds.length > 0) {
    options.adapterIds = adapterIds;
  }

  return options;
}

function selectPackageOutputReleasePackageTargets(
  adapterIds: string[] | undefined
): PackageOutputReleasePackageTarget[] {
  if (!adapterIds || adapterIds.length === 0) {
    return packageOutputReleasePackageTargets;
  }

  const requestedIds = new Set<string>();

  for (const adapterId of adapterIds) {
    const normalizedAdapterId = adapterId.trim();

    if (!isSafeAdapterId(normalizedAdapterId)) {
      throw new Error(`Package-output release package adapter id is unsafe: ${adapterId}`);
    }

    requestedIds.add(normalizedAdapterId);
  }

  const selectedTargets = packageOutputReleasePackageTargets.filter((target) =>
    requestedIds.has(target.adapterId)
  );
  const selectedIds = new Set(selectedTargets.map((target) => target.adapterId));
  const missingIds = [...requestedIds].filter((adapterId) => !selectedIds.has(adapterId));

  if (missingIds.length > 0) {
    throw new Error(`Package-output release package target is not configured: ${missingIds.join(", ")}`);
  }

  return selectedTargets;
}

function isSafeAdapterId(value: string): boolean {
  return /^dx\.[a-z0-9][a-z0-9.-]*$/.test(value) && !value.includes("..");
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
