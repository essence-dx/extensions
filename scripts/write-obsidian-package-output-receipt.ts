import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { hashSourceInputs, readSourceInputProofs, type SourceInputProof } from "./lib/source-input-proof.ts";

export interface ObsidianPackageOutputReceiptOptions {
  adapterRoot?: string;
  packageRoot?: string;
  receiptPath?: string;
  generatedAt?: Date | string;
  verificationCommand?: string;
}

export interface ObsidianPackageOutputReceipt {
  receipt: "dx.extension.obsidian.package_output";
  adapterId: "dx.obsidian.command-center";
  host: "obsidian";
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  package: {
    root: string;
    fileCount: number;
    sha256: string;
    files: ObsidianPackageOutputFile[];
  };
  manifest: {
    id: "dx-command-center";
    version: "0.1.0";
    desktopOnly: true;
  };
  inputs: string[];
  sourceRoot: string;
  sourceInputs: SourceInputProof[];
  sourceSha256: string;
  externalModules: string[];
  releaseClaims: {
    loadedVaultVerified: false;
    releaseAssetsVerified: false;
    signingVerified: false;
    releaseChecksumVerified: false;
    communityReviewVerified: false;
    distributionVerified: false;
  };
}

export interface ObsidianPackageOutputFile {
  relativePath: string;
  bytes: number;
  sha256: string;
}

const adapterId = "dx.obsidian.command-center";
const expectedPackageFiles = ["main.js", "main.js.map", "manifest.json"];
const obsidianBuildInputs = ["src/dxCommandRunner.ts", "src/main.ts"];
const obsidianSourceInputs = ["manifest.json", ...obsidianBuildInputs];
const obsidianExternalModules = ["obsidian"];

export function writeObsidianPackageOutputReceipt(
  options: ObsidianPackageOutputReceiptOptions = {}
): ObsidianPackageOutputReceipt {
  const adapterRoot = resolve(
    options.adapterRoot ?? join(process.cwd(), "hosts", "obsidian", "dx-command-center")
  );
  const packageRoot = resolve(options.packageRoot ?? adapterRoot);
  const receiptPath = resolve(
    options.receiptPath ??
      join(process.cwd(), ".dx", "receipts", "extensions", adapterId, "package-output-latest.json")
  );
  const files = readPackageFiles(packageRoot);
  const manifest = readManifestProof(packageRoot);
  const sourceInputs = readSourceInputProofs(adapterRoot, obsidianSourceInputs);

  const receipt: ObsidianPackageOutputReceipt = {
    receipt: "dx.extension.obsidian.package_output",
    adapterId,
    host: "obsidian",
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand: options.verificationCommand ?? "npm run build:obsidian:j1",
    receiptPath,
    package: {
      root: packageRoot,
      fileCount: files.length,
      sha256: hashPackageFiles(files),
      files
    },
    manifest,
    inputs: [...obsidianBuildInputs],
    sourceRoot: adapterRoot,
    sourceInputs,
    sourceSha256: hashSourceInputs(sourceInputs),
    externalModules: [...obsidianExternalModules],
    releaseClaims: {
      loadedVaultVerified: false,
      releaseAssetsVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      communityReviewVerified: false,
      distributionVerified: false
    }
  };

  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

  return receipt;
}

if (isDirectRun()) {
  const receipt = writeObsidianPackageOutputReceipt({
    verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run build:obsidian:j1"
  });

  console.log(`Obsidian package output receipt written: ${receipt.receiptPath}`);
}

function readPackageFiles(packageRoot: string): ObsidianPackageOutputFile[] {
  return expectedPackageFiles.map((relativePath) => {
    const bytes = readFileSync(join(packageRoot, relativePath));

    if (bytes.length <= 0) {
      throw new Error(`Obsidian package output file is empty: ${relativePath}`);
    }

    return {
      relativePath,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex")
    };
  });
}

function readManifestProof(packageRoot: string): ObsidianPackageOutputReceipt["manifest"] {
  const manifest = JSON.parse(readFileSync(join(packageRoot, "manifest.json"), "utf8"));

  if (manifest.id !== "dx-command-center") {
    throw new Error("Obsidian package manifest must keep id dx-command-center.");
  }

  if (manifest.version !== "0.1.0") {
    throw new Error("Obsidian package manifest must keep version 0.1.0.");
  }

  if (manifest.isDesktopOnly !== true) {
    throw new Error("Obsidian package manifest must remain desktop-only.");
  }

  return {
    id: "dx-command-center",
    version: "0.1.0",
    desktopOnly: true
  };
}

function hashPackageFiles(files: ObsidianPackageOutputFile[]): string {
  const hash = createHash("sha256");

  for (const file of files) {
    hash.update(file.relativePath);
    hash.update("\0");
    hash.update(file.sha256);
    hash.update("\0");
    hash.update(String(file.bytes));
    hash.update("\n");
  }

  return hash.digest("hex");
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
