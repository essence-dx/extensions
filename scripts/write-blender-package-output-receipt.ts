import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { hashSourceInputs, readSourceInputProofs, type SourceInputProof } from "./lib/source-input-proof.ts";

export interface BlenderPackageOutputReceiptOptions {
  adapterRoot?: string;
  packageRoot?: string;
  receiptPath?: string;
  generatedAt?: Date | string;
  verificationCommand?: string;
}

export interface BlenderPackageOutputReceipt {
  receipt: "dx.extension.blender.package_output";
  adapterId: "dx.blender.command-center";
  host: "blender";
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  package: {
    root: string;
    fileCount: number;
    sha256: string;
    files: BlenderPackageOutputFile[];
  };
  manifest: {
    id: "dx_blender_command_center";
    type: "add-on";
    blenderVersionMin: "4.2.0";
  };
  inputs: string[];
  sourceRoot: string;
  sourceInputs: SourceInputProof[];
  sourceSha256: string;
  releaseClaims: {
    loadedHostVerified: false;
    installedAddonVerified: false;
    packageArchiveVerified: false;
    signingVerified: false;
    releaseChecksumVerified: false;
    distributionVerified: false;
  };
}

export interface BlenderPackageOutputFile {
  relativePath: string;
  bytes: number;
  sha256: string;
}

const adapterId = "dx.blender.command-center";
const expectedPackageFiles = ["__init__.py", "blender_manifest.toml"];
const blenderPackageInputs = ["__init__.py", "blender_manifest.toml"];

export function writeBlenderPackageOutputReceipt(
  options: BlenderPackageOutputReceiptOptions = {}
): BlenderPackageOutputReceipt {
  const adapterRoot = resolve(options.adapterRoot ?? join(process.cwd(), "hosts", "blender", "dx-blender"));
  const packageRoot = resolve(options.packageRoot ?? join(adapterRoot, "dist"));
  const receiptPath = resolve(
    options.receiptPath ??
      join(process.cwd(), ".dx", "receipts", "extensions", adapterId, "package-output-latest.json")
  );
  const files = readPackageFiles(packageRoot);
  const manifest = readManifestProof(packageRoot);
  const sourceInputs = readSourceInputProofs(adapterRoot, blenderPackageInputs);

  const receipt: BlenderPackageOutputReceipt = {
    receipt: "dx.extension.blender.package_output",
    adapterId,
    host: "blender",
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand: options.verificationCommand ?? "npm run build:blender:j1",
    receiptPath,
    package: {
      root: packageRoot,
      fileCount: files.length,
      sha256: hashPackageFiles(files),
      files
    },
    manifest,
    inputs: [...blenderPackageInputs],
    sourceRoot: adapterRoot,
    sourceInputs,
    sourceSha256: hashSourceInputs(sourceInputs),
    releaseClaims: {
      loadedHostVerified: false,
      installedAddonVerified: false,
      packageArchiveVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      distributionVerified: false
    }
  };

  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

  return receipt;
}

if (isDirectRun()) {
  const receipt = writeBlenderPackageOutputReceipt({
    verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run build:blender:j1"
  });

  console.log(`Blender package output receipt written: ${receipt.receiptPath}`);
}

function readPackageFiles(packageRoot: string): BlenderPackageOutputFile[] {
  return expectedPackageFiles.map((relativePath) => {
    const bytes = readFileSync(join(packageRoot, relativePath));

    if (bytes.length <= 0) {
      throw new Error(`Blender package output file is empty: ${relativePath}`);
    }

    return {
      relativePath,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex")
    };
  });
}

function readManifestProof(packageRoot: string): BlenderPackageOutputReceipt["manifest"] {
  const manifest = readFileSync(join(packageRoot, "blender_manifest.toml"), "utf8");

  if (!/id = "dx_blender_command_center"/.test(manifest)) {
    throw new Error("Blender package manifest must keep the DX extension id.");
  }

  if (!/type = "add-on"/.test(manifest)) {
    throw new Error("Blender package manifest must declare add-on type.");
  }

  if (!/blender_version_min = "4\.2\.0"/.test(manifest)) {
    throw new Error("Blender package manifest must keep Blender 4.2 minimum.");
  }

  return {
    id: "dx_blender_command_center",
    type: "add-on",
    blenderVersionMin: "4.2.0"
  };
}

function hashPackageFiles(files: BlenderPackageOutputFile[]): string {
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
