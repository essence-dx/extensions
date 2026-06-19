import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { hashSourceInputs, readSourceInputProofs, type SourceInputProof } from "./lib/source-input-proof.ts";

export interface SketchPackageOutputReceiptOptions {
  adapterRoot?: string;
  bundleRoot?: string;
  receiptPath?: string;
  generatedAt?: Date | string;
  verificationCommand?: string;
}

export interface SketchPackageOutputReceipt {
  receipt: "dx.extension.sketch.package_output";
  adapterId: "dx.sketch.command-center";
  host: "sketch";
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  bundle: {
    root: string;
    fileCount: number;
    sha256: string;
    files: SketchPackageOutputFile[];
  };
  inputs: string[];
  sourceRoot: string;
  sourceInputs: SourceInputProof[];
  sourceSha256: string;
  externalModules: string[];
  releaseClaims: {
    loadedHostVerified: false;
    sketchtoolVerified: false;
    localServiceVerified: false;
    signingVerified: false;
    notarizationVerified: false;
    distributionVerified: false;
  };
}

export interface SketchPackageOutputFile {
  relativePath: string;
  bytes: number;
  sha256: string;
}

const sketchAdapterId = "dx.sketch.command-center";
const sketchBundleName = "dx-sketch.sketchplugin";
const expectedSketchBundleFiles = [
  "Contents/Sketch/index.js",
  "Contents/Sketch/index.js.map",
  "Contents/Sketch/manifest.json"
];
const sketchBuildInputs = ["src/commandPlans.ts", "src/index.ts", "src/messages.ts"];
const sketchSourceInputs = ["manifest.json", ...sketchBuildInputs];

export function writeSketchPackageOutputReceipt(
  options: SketchPackageOutputReceiptOptions = {}
): SketchPackageOutputReceipt {
  const adapterRoot = resolve(options.adapterRoot ?? join(process.cwd(), "hosts", "sketch", "dx-sketch"));
  const bundleRoot = resolve(options.bundleRoot ?? join(adapterRoot, sketchBundleName));
  const receiptPath = resolve(
    options.receiptPath ??
      join(process.cwd(), ".dx", "receipts", "extensions", sketchAdapterId, "package-output-latest.json")
  );
  const files = readBundleFiles(bundleRoot);
  const sourceInputs = readSourceInputProofs(adapterRoot, sketchSourceInputs);

  assertExpectedBundleFiles(files);

  const receipt: SketchPackageOutputReceipt = {
    receipt: "dx.extension.sketch.package_output",
    adapterId: sketchAdapterId,
    host: "sketch",
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand: options.verificationCommand ?? "npm run build:sketch:j1",
    receiptPath,
    bundle: {
      root: bundleRoot,
      fileCount: files.length,
      sha256: hashBundleFiles(files),
      files
    },
    inputs: [...sketchBuildInputs],
    sourceRoot: adapterRoot,
    sourceInputs,
    sourceSha256: hashSourceInputs(sourceInputs),
    externalModules: [],
    releaseClaims: {
      loadedHostVerified: false,
      sketchtoolVerified: false,
      localServiceVerified: false,
      signingVerified: false,
      notarizationVerified: false,
      distributionVerified: false
    }
  };

  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

  return receipt;
}

if (isDirectRun()) {
  const receipt = writeSketchPackageOutputReceipt({
    verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run build:sketch:j1"
  });

  console.log(`Sketch package output receipt written: ${receipt.receiptPath}`);
}

function readBundleFiles(bundleRoot: string): SketchPackageOutputFile[] {
  const files: SketchPackageOutputFile[] = [];

  for (const absolutePath of walkFiles(bundleRoot)) {
    const bytes = readFileSync(absolutePath);

    files.push({
      relativePath: toPosixPath(relative(bundleRoot, absolutePath)),
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex")
    });
  }

  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function walkFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkFiles(absolutePath));
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }

  return files;
}

function assertExpectedBundleFiles(files: SketchPackageOutputFile[]): void {
  const actual = files.map((file) => file.relativePath);

  if (JSON.stringify(actual) !== JSON.stringify(expectedSketchBundleFiles)) {
    throw new Error(`Sketch package output must contain exactly: ${expectedSketchBundleFiles.join(", ")}`);
  }

  for (const file of files) {
    if (file.bytes <= 0) {
      throw new Error(`Sketch package output file is empty: ${file.relativePath}`);
    }
  }
}

function hashBundleFiles(files: SketchPackageOutputFile[]): string {
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

function toPosixPath(value: string): string {
  return value.replaceAll("\\", "/");
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
