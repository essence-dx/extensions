import { basename, dirname, join, normalize, resolve } from "node:path";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { readZipArchiveEntryProofs } from "./lib/package-artifact-content-proof.ts";
import {
  hashSourceInputs,
  readSourceInputProofs,
  type SourceInputProof,
  vsCodePackageSourceInputs
} from "./lib/source-input-proof.ts";

export interface VsCodePackageOutputReceiptOptions {
  adapterRoot?: string;
  packageRoot?: string;
  vsixPath?: string;
  receiptPath?: string;
  generatedAt?: Date | string;
  verificationCommand?: string;
}

export interface VsCodePackageOutputReceipt {
  receipt: "dx.extension.vscode.package_output";
  adapterId: "dx.vscode.command-center";
  host: "vscode";
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  package: {
    root: string;
    format: "vscode-vsix-package-layout";
    fileCount: number;
    sha256: string;
    files: VsCodePackageOutputFile[];
  };
  inputs: string[];
  sourceRoot: string;
  sourceInputs: SourceInputProof[];
  sourceSha256: string;
  packageManifest: {
    name: string;
    displayName: string;
    version: string;
    publisher: string;
    main: string;
    commandCount: number;
    activationEventCount: number;
  };
  vsix: {
    path: string;
    fileName: string;
    bytes: number;
    sha256: string;
    zipHeaderVerified: true;
  };
  releaseClaims: {
    loadedExtensionHostVerified: false;
    localServiceVerified: false;
    signingVerified: false;
    releaseChecksumVerified: false;
    marketplaceReviewVerified: false;
    distributionVerified: false;
  };
}

export interface VsCodePackageOutputFile {
  relativePath: string;
  bytes: number;
  sha256: string;
}

const adapterId = "dx.vscode.command-center";
const zipHeader = [0x50, 0x4b, 0x03, 0x04];
const vsixExtensionPrefix = "extension/";

export function writeVsCodePackageOutputReceipt(
  options: VsCodePackageOutputReceiptOptions = {}
): VsCodePackageOutputReceipt {
  const adapterRoot = resolve(
    options.adapterRoot ?? join(process.cwd(), "hosts", "vscode", "dx-vscode")
  );
  const packageRoot = resolve(options.packageRoot ?? adapterRoot);
  const packageManifest = readPackageManifestProof(packageRoot);
  const vsixPath = resolve(
    options.vsixPath ?? join(packageRoot, `${packageManifest.name}-${packageManifest.version}.vsix`)
  );
  const receiptPath = resolve(
    options.receiptPath ??
      join(process.cwd(), ".dx", "receipts", "extensions", adapterId, "package-output-latest.json")
  );
  const files = readPackageFiles(packageRoot, vsixPath);
  const sourceInputs = readSourceInputProofs(adapterRoot, vsCodePackageSourceInputs);

  const receipt: VsCodePackageOutputReceipt = {
    receipt: "dx.extension.vscode.package_output",
    adapterId,
    host: "vscode",
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand: options.verificationCommand ?? "npm run package:vscode:j1",
    receiptPath,
    package: {
      root: packageRoot,
      format: "vscode-vsix-package-layout",
      fileCount: files.length,
      sha256: hashPackageFiles(files),
      files
    },
    inputs: [...vsCodePackageSourceInputs],
    sourceRoot: adapterRoot,
    sourceInputs,
    sourceSha256: hashSourceInputs(sourceInputs),
    packageManifest,
    vsix: readVsixProof(vsixPath),
    releaseClaims: {
      loadedExtensionHostVerified: false,
      localServiceVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      marketplaceReviewVerified: false,
      distributionVerified: false
    }
  };

  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

  return receipt;
}

if (isDirectRun()) {
  const receipt = writeVsCodePackageOutputReceipt({
    verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run package:vscode:j1"
  });

  console.log(`VS Code package output receipt written: ${receipt.receiptPath}`);
}

function readPackageFiles(packageRoot: string, vsixPath: string): VsCodePackageOutputFile[] {
  const archiveEntries = readZipArchiveEntryProofs(readFileSync(vsixPath));

  if (typeof archiveEntries === "string") {
    throw new Error(`VS Code VSIX output ${archiveEntries}.`);
  }

  const packageEntries = archiveEntries
    .filter((entry) => entry.relativePath.startsWith(vsixExtensionPrefix))
    .map((entry) => ({
      ...entry,
      relativePath: entry.relativePath.slice(vsixExtensionPrefix.length)
    }))
    .filter((entry) => entry.relativePath.trim() !== "");

  if (packageEntries.length === 0) {
    throw new Error("VS Code VSIX output must contain extension package files.");
  }

  return packageEntries
    .map((entry) => {
      const bytes = readFileSync(join(packageRoot, ...entry.relativePath.split("/")));
      const sha256 = createHash("sha256").update(bytes).digest("hex");

      if (bytes.length <= 0) {
        throw new Error(`VS Code package output file is empty: ${entry.relativePath}`);
      }

      if (bytes.length !== entry.bytes || sha256 !== entry.sha256) {
        throw new Error(`VS Code VSIX package entry does not match source file: ${entry.relativePath}`);
      }

      return {
        relativePath: entry.relativePath,
        bytes: bytes.length,
        sha256
      };
    })
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function readPackageManifestProof(
  packageRoot: string
): VsCodePackageOutputReceipt["packageManifest"] {
  const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
  const commandCount = manifest.contributes?.commands?.length ?? 0;
  const activationEventCount = manifest.activationEvents?.length ?? 0;

  for (const field of ["name", "displayName", "version", "publisher", "main"]) {
    if (typeof manifest[field] !== "string" || manifest[field].trim() === "") {
      throw new Error(`VS Code package manifest must define ${field}.`);
    }
  }

  if (commandCount !== 10 || activationEventCount !== 10) {
    throw new Error("VS Code package manifest must expose all ten DX commands and activation events.");
  }

  return {
    name: manifest.name,
    displayName: manifest.displayName,
    version: manifest.version,
    publisher: manifest.publisher,
    main: manifest.main,
    commandCount,
    activationEventCount
  };
}

function readVsixProof(vsixPath: string): VsCodePackageOutputReceipt["vsix"] {
  const bytes = readFileSync(vsixPath);
  const header = Array.from(bytes.subarray(0, zipHeader.length));

  if (bytes.length <= zipHeader.length || !headersEqual(header, zipHeader)) {
    throw new Error("VS Code VSIX output must be a ZIP archive.");
  }

  return {
    path: vsixPath,
    fileName: basename(vsixPath),
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    zipHeaderVerified: true
  };
}

function headersEqual(actual: number[], expected: number[]): boolean {
  return expected.every((value, index) => actual[index] === value);
}

function hashPackageFiles(files: VsCodePackageOutputFile[]): string {
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
