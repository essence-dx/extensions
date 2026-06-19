import { createHash } from "node:crypto";
import {
  Dirent,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  browserPackageSourceInputs,
  hashSourceInputs,
  readSourceInputProofs,
  type SourceInputProof
} from "./lib/source-input-proof.ts";

export interface BrowserPackageOutputReceiptOptions {
  adapterRoot?: string;
  packageRoot?: string;
  receiptPath?: string;
  generatedAt?: Date | string;
  verificationCommand?: string;
}

export interface BrowserPackageOutputReceipt {
  receipt: "dx.extension.browser.package_output";
  adapterId: "dx.browser.command-center";
  host: "browser";
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  package: {
    root: string;
    format: "browser-extension-dist-layout";
    fileCount: number;
    sha256: string;
    files: BrowserPackageOutputFile[];
  };
  inputs: string[];
  sourceRoot: string;
  sourceInputs: SourceInputProof[];
  sourceSha256: string;
  targets: BrowserPackageOutputTarget[];
  releaseClaims: {
    loadedChromeProfileVerified: false;
    loadedEdgeProfileVerified: false;
    loadedFirefoxProfileVerified: false;
    nativeHostReleasePackageVerified: false;
    signingVerified: false;
    releaseChecksumVerified: false;
    storeDistributionVerified: false;
  };
}

export interface BrowserPackageOutputFile {
  relativePath: string;
  bytes: number;
  sha256: string;
}

export interface BrowserPackageOutputTarget {
  name: "chromium" | "edge" | "firefox";
  manifestPath: string;
  manifestVersion: 3;
  version: string;
  extensionId?: string;
  permissionCount: number;
  backgroundEntrypoint: string;
  uiEntrypoints: string[];
  brandedIcon: BrowserPackageIconProof;
}

export interface BrowserPackageIconProof {
  relativePath: string;
  sha256: string;
  manifestReferences: string[];
}

const adapterId = "dx.browser.command-center";
const targetNames = ["chromium", "edge", "firefox"] as const;

export function writeBrowserPackageOutputReceipt(
  options: BrowserPackageOutputReceiptOptions = {}
): BrowserPackageOutputReceipt {
  const adapterRoot = resolve(options.adapterRoot ?? join(process.cwd(), "hosts", "browser", "dx-browser"));
  const packageRoot = resolve(
    options.packageRoot ?? join(adapterRoot, "dist", "browser")
  );
  const receiptPath = resolve(
    options.receiptPath ??
      join(process.cwd(), ".dx", "receipts", "extensions", adapterId, "package-output-latest.json")
  );
  const files = readPackageFiles(packageRoot);
  const packageFilePaths = new Set(files.map((file) => file.relativePath));
  const sourceInputs = readSourceInputProofs(adapterRoot, browserPackageSourceInputs);

  const receipt: BrowserPackageOutputReceipt = {
    receipt: "dx.extension.browser.package_output",
    adapterId,
    host: "browser",
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand: options.verificationCommand ?? "npm run build:browser:j1",
    receiptPath,
    package: {
      root: packageRoot,
      format: "browser-extension-dist-layout",
      fileCount: files.length,
      sha256: hashPackageFiles(files),
      files
    },
    inputs: [...browserPackageSourceInputs],
    sourceRoot: adapterRoot,
    sourceInputs,
    sourceSha256: hashSourceInputs(sourceInputs),
    targets: targetNames.map((targetName) => readTargetProof(packageRoot, packageFilePaths, targetName)),
    releaseClaims: {
      loadedChromeProfileVerified: false,
      loadedEdgeProfileVerified: false,
      loadedFirefoxProfileVerified: false,
      nativeHostReleasePackageVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      storeDistributionVerified: false
    }
  };

  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

  return receipt;
}

if (isDirectRun()) {
  const receipt = writeBrowserPackageOutputReceipt({
    verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run build:browser:j1"
  });

  console.log(`Browser package output receipt written: ${receipt.receiptPath}`);
}

function readPackageFiles(packageRoot: string): BrowserPackageOutputFile[] {
  return readFilesRecursively(packageRoot)
    .sort()
    .map((relativePath) => {
      const bytes = readFileSync(join(packageRoot, relativePath));

      if (bytes.length <= 0) {
        throw new Error(`Browser package output file is empty: ${relativePath}`);
      }

      return {
        relativePath,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex")
      };
    });
}

function readTargetProof(
  packageRoot: string,
  packageFilePaths: Set<string>,
  targetName: BrowserPackageOutputTarget["name"]
): BrowserPackageOutputTarget {
  const manifestPath = `${targetName}/manifest.json`;
  const manifest = JSON.parse(readFileSync(join(packageRoot, manifestPath), "utf8"));
  const backgroundEntrypoint = readBackgroundEntrypoint(manifest, targetName);
  const extensionId = readExtensionId(manifest, targetName);
  const uiEntrypoints = readUiEntrypoints(packageRoot, targetName);
  const brandedIcon = readBrandedIconProof(packageRoot, packageFilePaths, manifest, targetName);

  if (manifest.manifest_version !== 3) {
    throw new Error(`Browser ${targetName} manifest must use Manifest V3.`);
  }

  if (typeof manifest.version !== "string" || manifest.version.trim() === "") {
    throw new Error(`Browser ${targetName} manifest must define version.`);
  }

  if (uiEntrypoints.length === 0) {
    throw new Error(`Browser ${targetName} package must include at least one UI entrypoint.`);
  }

  if (!packageFilePaths.has(backgroundEntrypoint)) {
    throw new Error(
      `Browser ${targetName} background entrypoint is missing from the package output: ${backgroundEntrypoint}`
    );
  }

  return {
    name: targetName,
    manifestPath,
    manifestVersion: 3,
    version: manifest.version,
    ...(extensionId ? { extensionId } : {}),
    permissionCount: Array.isArray(manifest.permissions) ? manifest.permissions.length : 0,
    backgroundEntrypoint,
    uiEntrypoints,
    brandedIcon
  };
}

function readBrandedIconProof(
  packageRoot: string,
  packageFilePaths: Set<string>,
  manifest: Record<string, unknown>,
  targetName: BrowserPackageOutputTarget["name"]
): BrowserPackageIconProof {
  const iconReferences = readIconReferences(manifest);
  const iconPaths = new Set(iconReferences.map((reference) => reference.path));

  if (iconPaths.size !== 1 || !iconPaths.has("static/dx.svg")) {
    throw new Error(`Browser ${targetName} manifest must reference static/dx.svg for all branded icon slots.`);
  }

  const relativePath = `${targetName}/static/dx.svg`;

  if (!packageFilePaths.has(relativePath)) {
    throw new Error(`Browser ${targetName} branded icon asset is missing from the package output: ${relativePath}`);
  }

  return {
    relativePath,
    sha256: createHash("sha256").update(readFileSync(join(packageRoot, relativePath))).digest("hex"),
    manifestReferences: iconReferences.map((reference) => reference.key).sort()
  };
}

function readIconReferences(manifest: Record<string, unknown>): Array<{ key: string; path: string }> {
  const references = [
    ...readIconMapReferences(manifest.icons, "icons"),
    ...readIconMapReferences(readRecord(manifest.action, "action").default_icon, "action.default_icon")
  ];

  if (references.length === 0) {
    throw new Error("Browser manifest must define branded icon references.");
  }

  return references;
}

function readIconMapReferences(value: unknown, label: string): Array<{ key: string; path: string }> {
  const iconMap = readRecord(value, label);

  return Object.entries(iconMap)
    .map(([size, iconPath]) => {
      if (typeof iconPath !== "string" || iconPath.trim() === "") {
        throw new Error(`Browser package output ${label}.${size} must reference an icon path.`);
      }

      return {
        key: `${label}.${size}`,
        path: iconPath.trim()
      };
    })
    .sort((left, right) => left.key.localeCompare(right.key));
}

function readExtensionId(
  manifest: Record<string, unknown>,
  targetName: BrowserPackageOutputTarget["name"]
): string | undefined {
  if (targetName !== "firefox") {
    return undefined;
  }

  const browserSettings = readRecord(manifest.browser_specific_settings, "browser_specific_settings");
  const geckoSettings = readRecord(browserSettings.gecko, "gecko");
  const extensionId = geckoSettings.id;

  if (typeof extensionId !== "string" || extensionId.trim() === "") {
    throw new Error("Browser firefox manifest must define browser_specific_settings.gecko.id.");
  }

  return extensionId.trim();
}

function readBackgroundEntrypoint(
  manifest: { background?: { service_worker?: unknown; scripts?: unknown } },
  targetName: BrowserPackageOutputTarget["name"]
): string {
  const serviceWorker = manifest.background?.service_worker;

  if (typeof serviceWorker === "string" && serviceWorker.trim() !== "") {
    return `${targetName}/${serviceWorker}`;
  }

  const scripts = manifest.background?.scripts;
  const script = Array.isArray(scripts)
    ? scripts.find((entry): entry is string => typeof entry === "string" && entry.trim() !== "")
    : undefined;

  if (script) {
    return `${targetName}/${script}`;
  }

  throw new Error(`Browser ${targetName} manifest must define a background entrypoint.`);
}

function readUiEntrypoints(packageRoot: string, targetName: BrowserPackageOutputTarget["name"]): string[] {
  const uiRoot = join(packageRoot, targetName, "js", "ui");

  return readdirSync(uiRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => `${targetName}/js/ui/${entry.name}`)
    .sort();
}

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Browser package output ${label} must be an object.`);
  }

  return value as Record<string, unknown>;
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

function hashPackageFiles(files: BrowserPackageOutputFile[]): string {
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
