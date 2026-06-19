import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  hashSourceInputs,
  readSourceInputProofs,
  type SourceInputProof,
  zedPackageSourceInputs
} from "./lib/source-input-proof.ts";

export interface ZedPackageOutputReceiptOptions {
  adapterRoot?: string;
  packageRoot?: string;
  receiptPath?: string;
  generatedAt?: Date | string;
  verificationCommand?: string;
}

export interface ZedPackageOutputReceipt {
  receipt: "dx.extension.zed.package_output";
  adapterId: "dx.zed.command-center";
  host: "zed";
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  package: {
    root: string;
    format: "zed-extension-wasm-layout";
    fileCount: number;
    sha256: string;
    files: ZedPackageOutputFile[];
  };
  inputs: string[];
  sourceRoot: string;
  sourceInputs: SourceInputProof[];
  sourceSha256: string;
  extensionManifest: {
    id: string;
    name: string;
    version: string;
    slashCommandCount: number;
  };
  webAssembly: {
    bytes: number;
    sha256: string;
    headerVerified: true;
  };
  releaseClaims: {
    loadedZedDevExtensionVerified: false;
    localServiceVerified: false;
    galleryPackageVerified: false;
    signingVerified: false;
    releaseChecksumVerified: false;
    distributionVerified: false;
  };
}

export interface ZedPackageOutputFile {
  relativePath: string;
  bytes: number;
  sha256: string;
}

const adapterId = "dx.zed.command-center";
const expectedPackageFiles = ["README.md", "extension.toml", "extension.wasm"];
const wasmHeader = [0, 97, 115, 109, 1, 0, 0, 0];

export function writeZedPackageOutputReceipt(
  options: ZedPackageOutputReceiptOptions = {}
): ZedPackageOutputReceipt {
  const adapterRoot = resolve(options.adapterRoot ?? join(process.cwd(), "hosts", "zed", "dx-zed"));
  const packageRoot = resolve(options.packageRoot ?? adapterRoot);
  const receiptPath = resolve(
    options.receiptPath ??
      join(process.cwd(), ".dx", "receipts", "extensions", adapterId, "package-output-latest.json")
  );
  const files = readPackageFiles(packageRoot);
  const webAssembly = readWebAssemblyProof(packageRoot);
  const sourceInputs = readSourceInputProofs(adapterRoot, zedPackageSourceInputs);

  const receipt: ZedPackageOutputReceipt = {
    receipt: "dx.extension.zed.package_output",
    adapterId,
    host: "zed",
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand: options.verificationCommand ?? "npm run package:zed:j1",
    receiptPath,
    package: {
      root: packageRoot,
      format: "zed-extension-wasm-layout",
      fileCount: files.length,
      sha256: hashPackageFiles(files),
      files
    },
    inputs: [...zedPackageSourceInputs],
    sourceRoot: adapterRoot,
    sourceInputs,
    sourceSha256: hashSourceInputs(sourceInputs),
    extensionManifest: readExtensionManifestProof(packageRoot),
    webAssembly,
    releaseClaims: {
      loadedZedDevExtensionVerified: false,
      localServiceVerified: false,
      galleryPackageVerified: false,
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
  const receipt = writeZedPackageOutputReceipt({
    verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run package:zed:j1"
  });

  console.log(`Zed package output receipt written: ${receipt.receiptPath}`);
}

function readPackageFiles(packageRoot: string): ZedPackageOutputFile[] {
  return expectedPackageFiles.map((relativePath) => {
    const bytes = readFileSync(join(packageRoot, relativePath));

    if (bytes.length <= 0) {
      throw new Error(`Zed package output file is empty: ${relativePath}`);
    }

    return {
      relativePath,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex")
    };
  });
}

function readExtensionManifestProof(packageRoot: string): ZedPackageOutputReceipt["extensionManifest"] {
  const source = readFileSync(join(packageRoot, "extension.toml"), "utf8");
  const id = requireTomlString(source, "id");
  const name = requireTomlString(source, "name");
  const version = requireTomlString(source, "version");
  const slashCommandCount = Array.from(source.matchAll(/\[slash_commands\.[^\]]+\]/g)).length;

  if (id !== "dx-command-center") {
    throw new Error("Zed extension.toml id must be dx-command-center.");
  }

  if (slashCommandCount !== 3) {
    throw new Error("Zed extension.toml must declare exactly three slash commands.");
  }

  return {
    id,
    name,
    version,
    slashCommandCount
  };
}

function readWebAssemblyProof(packageRoot: string): ZedPackageOutputReceipt["webAssembly"] {
  const source = readFileSync(join(packageRoot, "extension.wasm"));
  const header = Array.from(source.subarray(0, wasmHeader.length));

  if (source.length <= wasmHeader.length || !headersEqual(header, wasmHeader)) {
    throw new Error("Zed extension.wasm must be a non-empty WebAssembly module.");
  }

  return {
    bytes: source.length,
    sha256: createHash("sha256").update(source).digest("hex"),
    headerVerified: true
  };
}

function requireTomlString(source: string, key: string): string {
  const value = source.match(new RegExp(`^${key}\\s*=\\s*"([^"]+)"`, "m"))?.[1];

  if (!value) {
    throw new Error(`Zed extension.toml must define ${key}.`);
  }

  return value;
}

function headersEqual(actual: number[], expected: number[]): boolean {
  return expected.every((value, index) => actual[index] === value);
}

function hashPackageFiles(files: ZedPackageOutputFile[]): string {
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
