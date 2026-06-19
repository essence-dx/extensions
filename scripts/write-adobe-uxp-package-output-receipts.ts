import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type AdobeUxpHost = "photoshop" | "premiere-pro" | "indesign";
export type AdobeUxpAdapterId =
  | "dx.photoshop.command-center"
  | "dx.premiere-pro.command-center"
  | "dx.indesign.command-center";

export interface AdobeUxpPackageOutputReceiptOptions {
  adapterId?: AdobeUxpAdapterId;
  host?: AdobeUxpHost;
  adapterRoot?: string;
  packageRoot?: string;
  receiptPath?: string;
  generatedAt?: Date | string;
  verificationCommand?: string;
}

export interface AdobeUxpPackageOutputReceipt {
  receipt: "dx.extension.adobe_uxp.package_output";
  adapterId: AdobeUxpAdapterId;
  host: AdobeUxpHost;
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  package: {
    root: string;
    fileCount: number;
    sha256: string;
    files: AdobeUxpPackageOutputFile[];
  };
  manifest: {
    main: string;
    requiredPermissionsEmpty: boolean;
  };
  inputs: string[];
  externalModules: string[];
  releaseClaims: {
    loadedHostVerified: false;
    developerToolVerified: false;
    ccxPackaged: false;
    signingVerified: false;
    releaseChecksumVerified: false;
    distributionVerified: false;
  };
}

export interface AdobeUxpPackageOutputFile {
  relativePath: string;
  bytes: number;
  sha256: string;
}

const adobeUxpAdapters = [
  {
    adapterId: "dx.photoshop.command-center",
    host: "photoshop",
    folder: "dx-photoshop-uxp"
  },
  {
    adapterId: "dx.premiere-pro.command-center",
    host: "premiere-pro",
    folder: "dx-premiere-pro-uxp"
  },
  {
    adapterId: "dx.indesign.command-center",
    host: "indesign",
    folder: "dx-indesign-uxp"
  }
] as const;
const expectedPackageFiles = ["index.html", "index.js", "index.js.map", "manifest.json"];
const adobeUxpBuildInputs = ["src/messages.ts", "src/commandPlans.ts", "src/index.ts"];

export function writeAdobeUxpPackageOutputReceipt(
  options: AdobeUxpPackageOutputReceiptOptions = {}
): AdobeUxpPackageOutputReceipt {
  const adapterRoot = resolve(
    options.adapterRoot ?? join(process.cwd(), "hosts", "adobe", "dx-photoshop-uxp")
  );
  const adapter = resolveAdapter(options, adapterRoot);
  const packageRoot = resolve(options.packageRoot ?? join(adapterRoot, "dist"));
  const receiptPath = resolve(
    options.receiptPath ??
      join(process.cwd(), ".dx", "receipts", "extensions", adapter.adapterId, "package-output-latest.json")
  );
  const files = readPackageFiles(packageRoot);
  const manifest = readPackageManifest(packageRoot);

  assertExpectedPackageFiles(files);

  const receipt: AdobeUxpPackageOutputReceipt = {
    receipt: "dx.extension.adobe_uxp.package_output",
    adapterId: adapter.adapterId,
    host: adapter.host,
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand: options.verificationCommand ?? "npm run build:adobe-uxp:j1",
    receiptPath,
    package: {
      root: packageRoot,
      fileCount: files.length,
      sha256: hashPackageFiles(files),
      files
    },
    manifest: {
      main: readManifestString(manifest, "main"),
      requiredPermissionsEmpty: isEmptyObject(manifest.requiredPermissions)
    },
    inputs: [...adobeUxpBuildInputs],
    externalModules: ["uxp"],
    releaseClaims: {
      loadedHostVerified: false,
      developerToolVerified: false,
      ccxPackaged: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      distributionVerified: false
    }
  };

  if (receipt.manifest.main !== "index.html") {
    throw new Error("Adobe UXP package manifest must use index.html as the main entrypoint.");
  }

  if (!receipt.manifest.requiredPermissionsEmpty) {
    throw new Error("Adobe UXP package manifest must keep requiredPermissions empty.");
  }

  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

  return receipt;
}

if (isDirectRun()) {
  for (const adapter of adobeUxpAdapters) {
    const receipt = writeAdobeUxpPackageOutputReceipt({
      adapterId: adapter.adapterId,
      host: adapter.host,
      adapterRoot: join(process.cwd(), "hosts", "adobe", adapter.folder),
      verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run build:adobe-uxp:j1"
    });

    console.log(`Adobe UXP package output receipt written: ${receipt.receiptPath}`);
  }
}

function resolveAdapter(options: AdobeUxpPackageOutputReceiptOptions, adapterRoot: string) {
  if (options.adapterId && options.host) {
    return {
      adapterId: options.adapterId,
      host: options.host
    };
  }

  const adapter = adobeUxpAdapters.find((candidate) => adapterRoot.endsWith(join("adobe", candidate.folder)));

  if (!adapter) {
    throw new Error("Adobe UXP package receipt requires a known adapter id and host.");
  }

  return {
    adapterId: adapter.adapterId,
    host: adapter.host
  };
}

function readPackageFiles(packageRoot: string): AdobeUxpPackageOutputFile[] {
  const files: AdobeUxpPackageOutputFile[] = [];

  for (const absolutePath of walkFiles(packageRoot)) {
    const bytes = readFileSync(absolutePath);

    files.push({
      relativePath: toPosixPath(relative(packageRoot, absolutePath)),
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

function assertExpectedPackageFiles(files: AdobeUxpPackageOutputFile[]): void {
  const actual = files.map((file) => file.relativePath);

  if (JSON.stringify(actual) !== JSON.stringify(expectedPackageFiles)) {
    throw new Error(`Adobe UXP package output must contain exactly: ${expectedPackageFiles.join(", ")}`);
  }

  for (const file of files) {
    if (file.bytes <= 0) {
      throw new Error(`Adobe UXP package output file is empty: ${file.relativePath}`);
    }
  }
}

function readPackageManifest(packageRoot: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(packageRoot, "manifest.json"), "utf8"));
}

function readManifestString(manifest: Record<string, unknown>, key: string): string {
  const value = manifest[key];

  if (typeof value !== "string") {
    throw new Error(`Adobe UXP package manifest must define string field: ${key}`);
  }

  return value;
}

function isEmptyObject(value: unknown): boolean {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0;
}

function hashPackageFiles(files: AdobeUxpPackageOutputFile[]): string {
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
