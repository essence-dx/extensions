import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { hashSourceInputs, readSourceInputProofs, type SourceInputProof } from "./lib/source-input-proof.ts";

export interface GoogleWorkspaceAppsScriptPackageOutputReceiptOptions {
  adapterRoot?: string;
  packageRoot?: string;
  receiptPath?: string;
  generatedAt?: Date | string;
  verificationCommand?: string;
}

export interface GoogleWorkspaceAppsScriptPackageOutputReceipt {
  receipt: "dx.extension.google_workspace.apps_script_package_output";
  adapterId: "dx.google-workspace.command-center";
  host: "google-workspace";
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  package: {
    root: string;
    fileCount: number;
    sha256: string;
    files: GoogleWorkspaceAppsScriptPackageOutputFile[];
  };
  manifest: {
    runtimeVersion: "V8";
    oauthScopesEmpty: boolean;
    homepageTrigger: "showDxCommandCenter";
  };
  inputs: string[];
  sourceRoot: string;
  sourceInputs: SourceInputProof[];
  sourceSha256: string;
  entrypoints: string[];
  actions: string[];
  releaseClaims: {
    appsScriptDeploymentVerified: false;
    oauthReviewVerified: false;
    workspaceFileSmokeVerified: false;
    cloudServiceVerified: false;
    signingVerified: false;
    releaseChecksumVerified: false;
    marketplaceApproved: false;
    distributionVerified: false;
  };
}

export interface GoogleWorkspaceAppsScriptPackageOutputFile {
  relativePath: string;
  bytes: number;
  sha256: string;
}

const adapterId = "dx.google-workspace.command-center";
const expectedPackageFiles = ["Code.gs", "appsscript.json"];
const appsScriptInputs = [
  "appsscript.json",
  "src/cards.ts",
  "src/commandPlans.ts",
  "src/entrypoints.ts",
  "src/localServiceBoundary.ts",
  "src/messages.ts"
];
const appsScriptEntrypoints = ["showDxCommandCenter", "handleDxWorkspaceAction"];
const appsScriptActions = [
  "dx.google-workspace.show_status",
  "dx.google-workspace.search_assets",
  "dx.google-workspace.show_receipts"
];

export function writeGoogleWorkspaceAppsScriptPackageOutputReceipt(
  options: GoogleWorkspaceAppsScriptPackageOutputReceiptOptions = {}
): GoogleWorkspaceAppsScriptPackageOutputReceipt {
  const adapterRoot = resolve(
    options.adapterRoot ??
      join(process.cwd(), "hosts", "google-workspace", "dx-google-workspace-addon")
  );
  const packageRoot = resolve(options.packageRoot ?? join(adapterRoot, "dist"));
  const receiptPath = resolve(
    options.receiptPath ??
      join(process.cwd(), ".dx", "receipts", "extensions", adapterId, "package-output-latest.json")
  );
  const files = readPackageFiles(packageRoot);
  const manifest = readManifestProof(packageRoot);
  const code = readFileSync(join(packageRoot, "Code.gs"), "utf8");
  const sourceInputs = readSourceInputProofs(adapterRoot, appsScriptInputs);

  assertCodeEntrypoints(code);

  const receipt: GoogleWorkspaceAppsScriptPackageOutputReceipt = {
    receipt: "dx.extension.google_workspace.apps_script_package_output",
    adapterId,
    host: "google-workspace",
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand:
      options.verificationCommand ?? "npm run build:google-workspace-apps-script:j1",
    receiptPath,
    package: {
      root: packageRoot,
      fileCount: files.length,
      sha256: hashPackageFiles(files),
      files
    },
    manifest,
    inputs: [...appsScriptInputs],
    sourceRoot: adapterRoot,
    sourceInputs,
    sourceSha256: hashSourceInputs(sourceInputs),
    entrypoints: [...appsScriptEntrypoints],
    actions: [...appsScriptActions],
    releaseClaims: {
      appsScriptDeploymentVerified: false,
      oauthReviewVerified: false,
      workspaceFileSmokeVerified: false,
      cloudServiceVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      marketplaceApproved: false,
      distributionVerified: false
    }
  };

  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

  return receipt;
}

if (isDirectRun()) {
  const receipt = writeGoogleWorkspaceAppsScriptPackageOutputReceipt({
    verificationCommand:
      process.env.DX_VERIFICATION_COMMAND ?? "npm run build:google-workspace-apps-script:j1"
  });

  console.log(`Google Workspace Apps Script package output receipt written: ${receipt.receiptPath}`);
}

function readPackageFiles(packageRoot: string): GoogleWorkspaceAppsScriptPackageOutputFile[] {
  const files = expectedPackageFiles.map((relativePath) => {
    const bytes = readFileSync(join(packageRoot, relativePath));

    if (bytes.length <= 0) {
      throw new Error(`Google Workspace package output file is empty: ${relativePath}`);
    }

    return {
      relativePath,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex")
    };
  });

  return files;
}

function readManifestProof(
  packageRoot: string
): GoogleWorkspaceAppsScriptPackageOutputReceipt["manifest"] {
  const manifest = readJsonObject(join(packageRoot, "appsscript.json"));

  if (manifest.runtimeVersion !== "V8") {
    throw new Error("Google Workspace Apps Script package must use the V8 runtime.");
  }

  if (Array.isArray(manifest.oauthScopes) && manifest.oauthScopes.length !== 0) {
    throw new Error("Google Workspace Apps Script package must not request OAuth scopes yet.");
  }

  const addOns = readObject(manifest, "addOns");
  const common = readObject(addOns, "common");
  const homepageTrigger = readObject(common, "homepageTrigger");

  if (homepageTrigger.runFunction !== "showDxCommandCenter") {
    throw new Error("Google Workspace Apps Script package must use showDxCommandCenter as homepage trigger.");
  }

  return {
    runtimeVersion: "V8",
    oauthScopesEmpty: true,
    homepageTrigger: "showDxCommandCenter"
  };
}

function assertCodeEntrypoints(code: string): void {
  for (const entrypoint of appsScriptEntrypoints) {
    if (!new RegExp(`function ${entrypoint}\\(`).test(code)) {
      throw new Error(`Google Workspace Apps Script package is missing entrypoint: ${entrypoint}`);
    }
  }

  if (!/DX cloud-service proof is required before this command can run/.test(code)) {
    throw new Error("Google Workspace Apps Script package must keep cloud-service proof wording.");
  }
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

function hashPackageFiles(files: GoogleWorkspaceAppsScriptPackageOutputFile[]): string {
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
