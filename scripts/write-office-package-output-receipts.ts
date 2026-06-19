import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { hashSourceInputs, readSourceInputProofs, type SourceInputProof } from "./lib/source-input-proof.ts";

export type OfficePackageHost = "excel" | "powerpoint" | "word";
export type OfficePackageAdapterId =
  | "dx.excel.command-center"
  | "dx.powerpoint.command-center"
  | "dx.word.command-center";

export interface OfficePackageOutputReceiptOptions {
  adapterId?: OfficePackageAdapterId;
  host?: OfficePackageHost;
  adapterRoot?: string;
  packageRoot?: string;
  receiptPath?: string;
  generatedAt?: Date | string;
  verificationCommand?: string;
}

export interface OfficePackageOutputReceipt {
  receipt: "dx.extension.office_taskpane.package_output";
  adapterId: OfficePackageAdapterId;
  host: OfficePackageHost;
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  package: {
    root: string;
    fileCount: number;
    sha256: string;
    files: OfficePackageOutputFile[];
  };
  manifest: {
    officeHost: string;
    permission: "ReadDocument";
    taskpaneUrl: string;
    placeholderOriginRemoved: true;
  };
  inputs: string[];
  sourceRoot: string;
  sourceInputs: SourceInputProof[];
  sourceSha256: string;
  externalModules: string[];
  releaseClaims: {
    sideloadedHostVerified: false;
    localServiceVerified: false;
    signingVerified: false;
    releaseChecksumVerified: false;
    appSourceApproved: false;
    distributionVerified: false;
  };
}

export interface OfficePackageOutputFile {
  relativePath: string;
  bytes: number;
  sha256: string;
}

const officeAdapters = [
  {
    adapterId: "dx.excel.command-center",
    host: "excel",
    folder: "dx-excel",
    officeHost: "Workbook",
    route: "excel"
  },
  {
    adapterId: "dx.powerpoint.command-center",
    host: "powerpoint",
    folder: "dx-powerpoint",
    officeHost: "Presentation",
    route: "powerpoint"
  },
  {
    adapterId: "dx.word.command-center",
    host: "word",
    folder: "dx-word",
    officeHost: "Document",
    route: "word"
  }
] as const;
const expectedPackageFiles = ["manifest.xml", "taskpane.html", "taskpane.js", "taskpane.js.map"];
const inertOfficeOrigin = "https://dx-office.example.invalid";

export function writeOfficePackageOutputReceipt(
  options: OfficePackageOutputReceiptOptions = {}
): OfficePackageOutputReceipt {
  const adapterRoot = resolve(options.adapterRoot ?? join(process.cwd(), "hosts", "office", "dx-excel"));
  const adapter = resolveAdapter(options, adapterRoot);
  const packageRoot = resolve(options.packageRoot ?? join(adapterRoot, "dist"));
  const receiptPath = resolve(
    options.receiptPath ??
      join(process.cwd(), ".dx", "receipts", "extensions", adapter.adapterId, "package-output-latest.json")
  );
  const sourceRoot = resolve(adapterRoot, "..");
  const sourceInputPaths = officeSourceInputPaths(adapter);
  const sourceInputs = readSourceInputProofs(sourceRoot, sourceInputPaths);
  const files = readPackageFiles(packageRoot);
  const manifest = readManifestProof(adapter, packageRoot);

  const receipt: OfficePackageOutputReceipt = {
    receipt: "dx.extension.office_taskpane.package_output",
    adapterId: adapter.adapterId,
    host: adapter.host,
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand: options.verificationCommand ?? "npm run build:office-taskpane:j1",
    receiptPath,
    package: {
      root: packageRoot,
      fileCount: files.length,
      sha256: hashPackageFiles(files),
      files
    },
    manifest,
    inputs: sourceInputPaths,
    sourceRoot,
    sourceInputs,
    sourceSha256: hashSourceInputs(sourceInputs),
    externalModules: [],
    releaseClaims: {
      sideloadedHostVerified: false,
      localServiceVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      appSourceApproved: false,
      distributionVerified: false
    }
  };

  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

  return receipt;
}

if (isDirectRun()) {
  for (const adapter of officeAdapters) {
    const receipt = writeOfficePackageOutputReceipt({
      adapterId: adapter.adapterId,
      host: adapter.host,
      adapterRoot: join(process.cwd(), "hosts", "office", adapter.folder),
      verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run build:office-taskpane:j1"
    });

    console.log(`${formatOfficeHost(adapter.host)} package output receipt written: ${receipt.receiptPath}`);
  }
}

function resolveAdapter(options: OfficePackageOutputReceiptOptions, adapterRoot: string) {
  if (options.adapterId && options.host) {
    const adapter = findAdapter(options.host);

    if (adapter.adapterId !== options.adapterId) {
      throw new Error(`Office package receipt host does not match adapter id: ${options.adapterId}`);
    }

    return adapter;
  }

  const adapter = officeAdapters.find((candidate) => adapterRoot.endsWith(join("office", candidate.folder)));

  if (!adapter) {
    throw new Error("Office package receipt requires a known adapter id and host.");
  }

  return adapter;
}

function findAdapter(host: OfficePackageHost) {
  const adapter = officeAdapters.find((candidate) => candidate.host === host);

  if (!adapter) {
    throw new Error(`Unsupported Office package receipt host: ${host}`);
  }

  return adapter;
}

function officeSourceInputPaths(adapter: (typeof officeAdapters)[number]): string[] {
  return [
    `${adapter.folder}/manifest.xml`,
    `${adapter.folder}/src/commandPlans.ts`,
    `${adapter.folder}/src/messages.ts`,
    `${adapter.folder}/src/taskpane.ts`,
    `${adapter.folder}/static/taskpane.html`,
    "shared/localServiceBoundary.ts"
  ];
}

function readPackageFiles(packageRoot: string): OfficePackageOutputFile[] {
  const files = expectedPackageFiles.map((relativePath) => {
    const bytes = readFileSync(join(packageRoot, relativePath));

    if (bytes.length <= 0) {
      throw new Error(`Office package output file is empty: ${relativePath}`);
    }

    return {
      relativePath,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex")
    };
  });

  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function readManifestProof(
  adapter: (typeof officeAdapters)[number],
  packageRoot: string
): OfficePackageOutputReceipt["manifest"] {
  const manifest = readFileSync(join(packageRoot, "manifest.xml"), "utf8");

  if (manifest.includes(inertOfficeOrigin)) {
    throw new Error("Office package manifest still contains the inert placeholder origin.");
  }

  if (!new RegExp(`<Host Name="${escapeRegExp(adapter.officeHost)}"\\/>`).test(manifest)) {
    throw new Error(`Office package manifest must target ${adapter.officeHost}.`);
  }

  if (!/<Permissions>ReadDocument<\/Permissions>/.test(manifest)) {
    throw new Error("Office package manifest must keep ReadDocument permission.");
  }

  if (/<Permissions>(?:ReadWriteDocument|ReadAllDocument|WriteDocument)<\/Permissions>/.test(manifest)) {
    throw new Error("Office package manifest must not request write or broad read permissions.");
  }

  const taskpaneUrl = readTaskpaneUrl(manifest);

  if (!taskpaneUrl.endsWith(`/${adapter.route}/taskpane.html`)) {
    throw new Error(`Office package manifest taskpane URL must target ${adapter.route}.`);
  }

  if (new URL(taskpaneUrl).protocol !== "https:") {
    throw new Error("Office package manifest taskpane URL must use HTTPS.");
  }

  return {
    officeHost: adapter.officeHost,
    permission: "ReadDocument",
    taskpaneUrl,
    placeholderOriginRemoved: true
  };
}

function readTaskpaneUrl(manifest: string): string {
  const match = /<SourceLocation DefaultValue="([^"]+\/taskpane\.html)"\/>/.exec(manifest);

  if (!match) {
    throw new Error("Office package manifest does not declare a taskpane SourceLocation.");
  }

  return match[1];
}

function hashPackageFiles(files: OfficePackageOutputFile[]): string {
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatOfficeHost(host: OfficePackageHost): string {
  if (host === "powerpoint") {
    return "PowerPoint";
  }

  return host === "excel" ? "Excel" : "Word";
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
