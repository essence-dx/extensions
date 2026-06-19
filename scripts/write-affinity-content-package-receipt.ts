import { createHash } from "node:crypto";
import { Dirent, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { hashSourceInputs, readSourceInputProofs, type SourceInputProof } from "./lib/source-input-proof.ts";

export interface AffinityContentPackageReceiptOptions {
  adapterRoot?: string;
  packageRoot?: string;
  receiptPath?: string;
  generatedAt?: Date | string;
  verificationCommand?: string;
}

export interface AffinityContentPackageReceipt {
  receipt: "dx.extension.affinity_content.content_package";
  adapterId: "dx.affinity-content.bridge";
  host: "affinity";
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  package: {
    root: string;
    format: "affinity-content-package-layout";
    fileCount: number;
    sha256: string;
    files: AffinityContentPackageFile[];
  };
  inputs: string[];
  sourceRoot: string;
  sourceInputs: SourceInputProof[];
  sourceSha256: string;
  supportedHosts: string[];
  contentTypes: string[];
  contentArtifacts: AffinityContentArtifact[];
  releaseClaims: {
    manualImportVerified: false;
    loadedAffinityAppVerified: false;
    nativeSdkPluginVerified: false;
    photoshopFilterPluginVerified: false;
    signingVerified: false;
    releaseChecksumVerified: false;
    distributionVerified: false;
  };
}

export interface AffinityContentPackageFile {
  relativePath: string;
  bytes: number;
  sha256: string;
}

export interface AffinityContentArtifact extends AffinityContentPackageFile {
  contentType: string;
  extension: string;
}

interface AffinityContentManifest {
  name?: string;
  supportedHosts?: string[];
  supportedContentTypes?: Array<{
    type?: string;
    extensions?: string[];
  }>;
}

const adapterId = "dx.affinity-content.bridge";
const manifestFileName = "affinity-content-manifest.json";
const affinitySourceInputs = [manifestFileName, "src/contentPlans.ts", "src/importGuide.ts"];
const allowedContentExtensionsByType = new Map<string, string[]>([
  ["assets", [".afassets"]],
  ["fonts", [".affont", ".otf", ".ttf"]],
  ["swatches", [".afpalette", ".ase"]],
  ["styles", [".afstyles"]],
  ["templates", [".aftemplate"]]
]);

export function writeAffinityContentPackageReceipt(
  options: AffinityContentPackageReceiptOptions = {}
): AffinityContentPackageReceipt {
  const adapterRoot = resolveAffinityAdapterRoot(options.adapterRoot);
  const packageRoot = resolveAffinityContentPackageRoot(options.packageRoot);
  const receiptPath = resolve(
    options.receiptPath ??
      join(process.cwd(), ".dx", "receipts", "extensions", adapterId, "content-package-latest.json")
  );
  const manifest = readAffinityContentManifest(packageRoot);
  const files = readPackageFiles(packageRoot);
  const contentArtifacts = readContentArtifacts(files);
  const sourceInputs = readSourceInputProofs(adapterRoot, affinitySourceInputs);

  if (contentArtifacts.length === 0) {
    throw new Error("Affinity content package must include at least one importable Affinity content artifact.");
  }

  const receipt: AffinityContentPackageReceipt = {
    receipt: "dx.extension.affinity_content.content_package",
    adapterId,
    host: "affinity",
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand: options.verificationCommand ?? "npm run package:affinity-content:j1",
    receiptPath,
    package: {
      root: packageRoot,
      format: "affinity-content-package-layout",
      fileCount: files.length,
      sha256: hashPackageFiles(files),
      files
    },
    inputs: [...affinitySourceInputs],
    sourceRoot: adapterRoot,
    sourceInputs,
    sourceSha256: hashSourceInputs(sourceInputs),
    supportedHosts: readSupportedHosts(manifest),
    contentTypes: uniqueSorted(contentArtifacts.map((artifact) => artifact.contentType)),
    contentArtifacts,
    releaseClaims: {
      manualImportVerified: false,
      loadedAffinityAppVerified: false,
      nativeSdkPluginVerified: false,
      photoshopFilterPluginVerified: false,
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
  const receipt = writeAffinityContentPackageReceipt({
    verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run package:affinity-content:j1"
  });

  console.log(`Affinity content package receipt written: ${receipt.receiptPath}`);
}

function resolveAffinityAdapterRoot(adapterRoot: string | undefined): string {
  return resolve(adapterRoot ?? join(process.cwd(), "hosts", "affinity", "dx-affinity-content"));
}

function readAffinityContentManifest(packageRoot: string): AffinityContentManifest {
  const manifestPath = join(packageRoot, manifestFileName);

  if (!existsSync(manifestPath)) {
    throw new Error(`Affinity content package manifest does not exist: ${manifestPath}`);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as AffinityContentManifest;

  if (manifest.name !== "DX Affinity Content Bridge") {
    throw new Error("Affinity content package manifest must identify DX Affinity Content Bridge.");
  }

  return manifest;
}

function resolveAffinityContentPackageRoot(packageRoot: string | undefined): string {
  const configuredRoot = packageRoot ?? readEnvironmentPackageRoot();
  const resolvedRoot = resolve(
    configuredRoot ?? join(process.cwd(), "hosts", "affinity", "dx-affinity-content", "dist", "content-package")
  );

  if (!existsSync(resolvedRoot) || !statSync(resolvedRoot).isDirectory()) {
    throw new Error(
      `Affinity content package root does not exist: ${resolvedRoot}. Set DX_AFFINITY_CONTENT_PACKAGE_ROOT or pass packageRoot.`
    );
  }

  return resolvedRoot;
}

function readEnvironmentPackageRoot(): string | undefined {
  const value = process.env.DX_AFFINITY_CONTENT_PACKAGE_ROOT;

  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function readPackageFiles(packageRoot: string): AffinityContentPackageFile[] {
  return readFilesRecursively(packageRoot)
    .sort()
    .map((relativePath) => {
      const bytes = readFileSync(join(packageRoot, relativePath));

      if (bytes.length <= 0) {
        throw new Error(`Affinity content package file is empty: ${relativePath}`);
      }

      return {
        relativePath,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex")
      };
    });
}

function readContentArtifacts(files: AffinityContentPackageFile[]): AffinityContentArtifact[] {
  return files
    .map((file) => {
      const extension = readFileExtension(file.relativePath);
      const contentType = readContentType(extension);

      if (!contentType) {
        return undefined;
      }

      return {
        ...file,
        contentType,
        extension
      };
    })
    .filter((file): file is AffinityContentArtifact => Boolean(file));
}

function readContentType(extension: string): string | undefined {
  for (const [contentType, extensions] of allowedContentExtensionsByType.entries()) {
    if (extensions.includes(extension)) {
      return contentType;
    }
  }

  return undefined;
}

function readFileExtension(relativePath: string): string {
  const slashIndex = relativePath.lastIndexOf("/");
  const fileName = slashIndex === -1 ? relativePath : relativePath.slice(slashIndex + 1);
  const dotIndex = fileName.lastIndexOf(".");

  return dotIndex === -1 ? "" : fileName.slice(dotIndex).toLowerCase();
}

function readSupportedHosts(manifest: AffinityContentManifest): string[] {
  return uniqueSorted((manifest.supportedHosts ?? []).filter((host) => typeof host === "string" && host.trim()));
}

function readFilesRecursively(root: string, directory = root): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...readFilesRecursively(root, absolutePath));
      continue;
    }

    if (isRegularFile(entry, absolutePath)) {
      files.push(relative(root, absolutePath).split(sep).join("/"));
    }
  }

  return files;
}

function isRegularFile(entry: Dirent, absolutePath: string): boolean {
  return entry.isFile() && statSync(absolutePath).isFile();
}

function hashPackageFiles(files: AffinityContentPackageFile[]): string {
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

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
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
