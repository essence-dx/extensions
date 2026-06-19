import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { hashSourceInputs, readSourceInputProofs, type SourceInputProof } from "./lib/source-input-proof.ts";

export type FigmaCanvaHost = "figma" | "canva";
export type FigmaCanvaAdapterId = "dx.figma.command-center" | "dx.canva.command-center";

export interface FigmaCanvaPackageOutputReceiptOptions {
  adapterId?: FigmaCanvaAdapterId;
  host?: FigmaCanvaHost;
  adapterRoot?: string;
  packageRoot?: string;
  receiptPath?: string;
  generatedAt?: Date | string;
  verificationCommand?: string;
}

export interface FigmaCanvaPackageOutputReceipt {
  receipt: "dx.extension.figma_canva.package_output";
  adapterId: FigmaCanvaAdapterId;
  host: FigmaCanvaHost;
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  package: {
    root: string;
    fileCount: number;
    sha256: string;
    files: FigmaCanvaPackageOutputFile[];
  };
  hostPolicy: {
    entrypoint: string;
    configFile: string;
    productionNetworkRestricted: boolean;
    runtimePermissionsEmpty: boolean;
  };
  inputs: string[];
  sourceRoot: string;
  sourceInputs: SourceInputProof[];
  sourceSha256: string;
  externalModules: string[];
  releaseClaims: {
    loadedHostVerified: false;
    localServiceVerified: false;
    signingVerified: false;
    releaseChecksumVerified: false;
    distributionVerified: false;
  };
}

export interface FigmaCanvaPackageOutputFile {
  relativePath: string;
  bytes: number;
  sha256: string;
}

const figmaCanvaAdapters = [
  {
    adapterId: "dx.figma.command-center",
    host: "figma",
    folder: join("figma", "dx-figma"),
    entrypoint: "main.js",
    configFile: "manifest.json",
    expectedPackageFiles: ["main.js", "main.js.map", "manifest.json", "ui.html"],
    inputs: ["src/commandPlans.ts", "src/main.ts", "src/messages.ts"],
    sourceInputPaths: [
      "manifest.json",
      "src/commandPlans.ts",
      "src/main.ts",
      "src/messages.ts",
      "ui.html"
    ],
    verificationCommand: "npm run build:figma:j1"
  },
  {
    adapterId: "dx.canva.command-center",
    host: "canva",
    folder: join("canva", "dx-canva"),
    entrypoint: "app.js",
    configFile: "canva-app.json",
    expectedPackageFiles: ["app.js", "app.js.map", "canva-app.json"],
    inputs: ["src/app.tsx", "src/commandPlans.ts", "src/messages.ts"],
    sourceInputPaths: [
      "canva-app.json",
      "src/app.tsx",
      "src/commandPlans.ts",
      "src/messages.ts"
    ],
    verificationCommand: "npm run build:canva:j1"
  }
] as const;

export function writeFigmaCanvaPackageOutputReceipt(
  options: FigmaCanvaPackageOutputReceiptOptions = {}
): FigmaCanvaPackageOutputReceipt {
  const adapterRoot = resolve(options.adapterRoot ?? join(process.cwd(), "hosts", "figma", "dx-figma"));
  const adapter = resolveAdapter(options, adapterRoot);
  const packageRoot = resolve(options.packageRoot ?? adapterRoot);
  const receiptPath = resolve(
    options.receiptPath ??
      join(process.cwd(), ".dx", "receipts", "extensions", adapter.adapterId, "package-output-latest.json")
  );
  const files = readPackageFiles(packageRoot, adapter.expectedPackageFiles);
  const hostPolicy = readHostPolicy(adapter, packageRoot);
  const sourceInputs = readSourceInputProofs(adapterRoot, adapter.sourceInputPaths);

  const receipt: FigmaCanvaPackageOutputReceipt = {
    receipt: "dx.extension.figma_canva.package_output",
    adapterId: adapter.adapterId,
    host: adapter.host,
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand: options.verificationCommand ?? adapter.verificationCommand,
    receiptPath,
    package: {
      root: packageRoot,
      fileCount: files.length,
      sha256: hashPackageFiles(files),
      files
    },
    hostPolicy,
    inputs: [...adapter.inputs],
    sourceRoot: adapterRoot,
    sourceInputs,
    sourceSha256: hashSourceInputs(sourceInputs),
    externalModules: [],
    releaseClaims: {
      loadedHostVerified: false,
      localServiceVerified: false,
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
  const selectedHosts = readSelectedHosts(process.argv.slice(2));

  for (const adapter of figmaCanvaAdapters.filter((candidate) => selectedHosts.includes(candidate.host))) {
    const receipt = writeFigmaCanvaPackageOutputReceipt({
      adapterId: adapter.adapterId,
      host: adapter.host,
      adapterRoot: join(process.cwd(), "hosts", adapter.folder),
      verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? adapter.verificationCommand
    });

    console.log(`${formatHostName(adapter.host)} package output receipt written: ${receipt.receiptPath}`);
  }
}

function resolveAdapter(options: FigmaCanvaPackageOutputReceiptOptions, adapterRoot: string) {
  if (options.adapterId && options.host) {
    const adapter = findAdapter(options.host);

    if (adapter.adapterId !== options.adapterId) {
      throw new Error(`Figma/Canva package receipt host does not match adapter id: ${options.adapterId}`);
    }

    return adapter;
  }

  const adapter = figmaCanvaAdapters.find((candidate) => adapterRoot.endsWith(join("hosts", candidate.folder)));

  if (!adapter) {
    throw new Error("Figma/Canva package receipt requires a known adapter id and host.");
  }

  return adapter;
}

function findAdapter(host: FigmaCanvaHost) {
  const adapter = figmaCanvaAdapters.find((candidate) => candidate.host === host);

  if (!adapter) {
    throw new Error(`Unsupported Figma/Canva package receipt host: ${host}`);
  }

  return adapter;
}

function readPackageFiles(packageRoot: string, expectedPackageFiles: readonly string[]): FigmaCanvaPackageOutputFile[] {
  const files = expectedPackageFiles.map((relativePath) => {
    const bytes = readFileSync(join(packageRoot, relativePath));

    if (bytes.length <= 0) {
      throw new Error(`Figma/Canva package output file is empty: ${relativePath}`);
    }

    return {
      relativePath,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex")
    };
  });

  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function readHostPolicy(
  adapter: (typeof figmaCanvaAdapters)[number],
  packageRoot: string
): FigmaCanvaPackageOutputReceipt["hostPolicy"] {
  if (adapter.host === "figma") {
    return readFigmaHostPolicy(packageRoot);
  }

  return readCanvaHostPolicy(packageRoot);
}

function readFigmaHostPolicy(packageRoot: string): FigmaCanvaPackageOutputReceipt["hostPolicy"] {
  const manifest = readJsonObject(join(packageRoot, "manifest.json"));

  if (readString(manifest, "main") !== "main.js") {
    throw new Error("Figma package manifest must use main.js as the plugin entrypoint.");
  }

  if (readString(manifest, "ui") !== "ui.html") {
    throw new Error("Figma package manifest must use ui.html as the plugin UI.");
  }

  const networkAccess = readObject(manifest, "networkAccess");
  const allowedDomains = readStringArray(networkAccess, "allowedDomains");
  const devAllowedDomains = readStringArray(networkAccess, "devAllowedDomains");
  const productionNetworkRestricted =
    JSON.stringify(allowedDomains) === JSON.stringify(["none"]) && devAllowedDomains.length === 0;

  if (!productionNetworkRestricted) {
    throw new Error("Figma package manifest must keep production network access disabled.");
  }

  return {
    entrypoint: "main.js",
    configFile: "manifest.json",
    productionNetworkRestricted,
    runtimePermissionsEmpty: true
  };
}

function readCanvaHostPolicy(packageRoot: string): FigmaCanvaPackageOutputReceipt["hostPolicy"] {
  const config = readJsonObject(join(packageRoot, "canva-app.json"));
  const runtime = readObject(config, "runtime");
  const permissions = readStringArray(runtime, "permissions");
  const intent = readObject(config, "intent");
  const designEditor = readObject(intent, "design_editor");

  if (designEditor.enrolled !== true) {
    throw new Error("Canva package config must enroll the design editor intent.");
  }

  if (permissions.length !== 0) {
    throw new Error("Canva package config must keep runtime permissions empty.");
  }

  return {
    entrypoint: "app.js",
    configFile: "canva-app.json",
    productionNetworkRestricted: true,
    runtimePermissionsEmpty: true
  };
}

function readJsonObject(path: string): Record<string, unknown> {
  const value = JSON.parse(readFileSync(path, "utf8"));

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Expected JSON object: ${path}`);
  }

  return value as Record<string, unknown>;
}

function readObject(source: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = source[key];

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Expected object field: ${key}`);
  }

  return value as Record<string, unknown>;
}

function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key];

  if (typeof value !== "string") {
    throw new Error(`Expected string field: ${key}`);
  }

  return value;
}

function readStringArray(source: Record<string, unknown>, key: string): string[] {
  const value = source[key];

  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Expected string array field: ${key}`);
  }

  return value;
}

function hashPackageFiles(files: FigmaCanvaPackageOutputFile[]): string {
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

function readSelectedHosts(args: string[]): FigmaCanvaHost[] {
  const hostIndex = args.indexOf("--host");

  if (hostIndex === -1) {
    return ["figma", "canva"];
  }

  const host = args[hostIndex + 1];

  if (host === "figma" || host === "canva") {
    return [host];
  }

  if (host === "all") {
    return ["figma", "canva"];
  }

  throw new Error("--host must be figma, canva, or all.");
}

function formatHostName(host: FigmaCanvaHost): string {
  return host === "figma" ? "Figma" : "Canva";
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
