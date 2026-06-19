import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  type ZipPackageArtifactProof,
  writeZipArtifactProof
} from "./lib/package-artifact-proof.ts";

export interface UnrealEnginePackageOutputReceiptOptions {
  adapterRoot?: string;
  packageRoot?: string;
  packagedPluginPath?: string;
  receiptPath?: string;
  generatedAt?: Date | string;
  verificationCommand?: string;
}

export interface UnrealEnginePackageOutputReceipt {
  receipt: "dx.extension.unreal_engine.package_output";
  adapterId: "dx.unreal-engine.command-center";
  host: "unreal-engine";
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  package: {
    root: string;
    format: "unreal-editor-source-plugin-layout";
    fileCount: number;
    sha256: string;
    files: UnrealEnginePackageOutputFile[];
  };
  pluginDescriptor: {
    friendlyName: string;
    versionName: string;
    moduleName: string;
    moduleType: "Editor";
    canContainContent: false;
  };
  packagedPlugin: ZipPackageArtifactProof;
  commandPlans: {
    commandCount: number;
    mutatesProject: false;
    localServiceProofRequired: true;
  };
  releaseClaims: {
    loadedUnrealEditorVerified: false;
    sampleProjectSmokeVerified: false;
    projectEnablementVerified: false;
    localServiceVerified: false;
    pluginPackageVerified: false;
    signingVerified: false;
    releaseChecksumVerified: false;
    fabMarketplaceReviewVerified: false;
    distributionVerified: false;
  };
}

export interface UnrealEnginePackageOutputFile {
  relativePath: string;
  bytes: number;
  sha256: string;
}

const adapterId = "dx.unreal-engine.command-center";
const expectedPackageFiles = [
  "DXUnrealCommandCenter.uplugin",
  "README.md",
  "Source/DXUnrealCommandCenterEditor/DXUnrealCommandCenterEditor.Build.cs",
  "Source/DXUnrealCommandCenterEditor/Private/DXUnrealCommandCenterEditorModule.cpp",
  "Source/DXUnrealCommandCenterEditor/Private/DXUnrealCommandPlans.cpp",
  "Source/DXUnrealCommandCenterEditor/Public/DXUnrealCommandPlans.h",
  "dx.extension.toml"
];

export function writeUnrealEnginePackageOutputReceipt(
  options: UnrealEnginePackageOutputReceiptOptions = {}
): UnrealEnginePackageOutputReceipt {
  const adapterRoot = resolve(
    options.adapterRoot ?? join(process.cwd(), "hosts", "unreal", "dx-unreal-engine")
  );
  const packageRoot = resolve(options.packageRoot ?? adapterRoot);
  const receiptPath = resolve(
    options.receiptPath ??
      join(process.cwd(), ".dx", "receipts", "extensions", adapterId, "package-output-latest.json")
  );
  const files = readPackageFiles(packageRoot);
  const pluginDescriptor = readPluginDescriptorProof(packageRoot);
  const packagedPluginPath = resolve(
    options.packagedPluginPath ??
      join(packageRoot, "Saved", "Packages", `DXUnrealCommandCenter-${pluginDescriptor.versionName}.zip`)
  );

  const receipt: UnrealEnginePackageOutputReceipt = {
    receipt: "dx.extension.unreal_engine.package_output",
    adapterId,
    host: "unreal-engine",
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand: options.verificationCommand ?? "npm run package:unreal-engine:j1",
    receiptPath,
    package: {
      root: packageRoot,
      format: "unreal-editor-source-plugin-layout",
      fileCount: files.length,
      sha256: hashPackageFiles(files),
      files
    },
    pluginDescriptor,
    packagedPlugin: writeZipArtifactProof(
      packagedPluginPath,
      packageArtifactEntries(packageRoot, files)
    ),
    commandPlans: readCommandPlansProof(packageRoot),
    releaseClaims: {
      loadedUnrealEditorVerified: false,
      sampleProjectSmokeVerified: false,
      projectEnablementVerified: false,
      localServiceVerified: false,
      pluginPackageVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      fabMarketplaceReviewVerified: false,
      distributionVerified: false
    }
  };

  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

  return receipt;
}

if (isDirectRun()) {
  const receipt = writeUnrealEnginePackageOutputReceipt({
    verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run package:unreal-engine:j1"
  });

  console.log(`Unreal Engine package output receipt written: ${receipt.receiptPath}`);
}

function readPackageFiles(packageRoot: string): UnrealEnginePackageOutputFile[] {
  return expectedPackageFiles.map((relativePath) => {
    const bytes = readFileSync(join(packageRoot, relativePath));

    if (bytes.length <= 0) {
      throw new Error(`Unreal Engine package output file is empty: ${relativePath}`);
    }

    return {
      relativePath,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex")
    };
  });
}

function packageArtifactEntries(packageRoot: string, files: UnrealEnginePackageOutputFile[]) {
  return files.map((file) => ({
    relativePath: file.relativePath,
    sourcePath: join(packageRoot, ...file.relativePath.split("/"))
  }));
}

function readPluginDescriptorProof(
  packageRoot: string
): UnrealEnginePackageOutputReceipt["pluginDescriptor"] {
  const descriptor = JSON.parse(
    readFileSync(join(packageRoot, "DXUnrealCommandCenter.uplugin"), "utf8")
  );
  const module = descriptor.Modules?.[0];

  if (descriptor.FriendlyName !== "DX Unreal Engine Command Center") {
    throw new Error("Unreal plugin descriptor must keep the expected friendly name.");
  }

  if (typeof descriptor.VersionName !== "string" || descriptor.VersionName.trim() === "") {
    throw new Error("Unreal plugin descriptor must define VersionName.");
  }

  if (descriptor.CanContainContent !== false) {
    throw new Error("Unreal plugin descriptor must remain content-free.");
  }

  if (module?.Name !== "DXUnrealCommandCenterEditor" || module?.Type !== "Editor") {
    throw new Error("Unreal plugin descriptor must define one editor module.");
  }

  return {
    friendlyName: descriptor.FriendlyName,
    versionName: descriptor.VersionName,
    moduleName: module.Name,
    moduleType: module.Type,
    canContainContent: false
  };
}

function readCommandPlansProof(
  packageRoot: string
): UnrealEnginePackageOutputReceipt["commandPlans"] {
  const source = readFileSync(
    join(
      packageRoot,
      "Source",
      "DXUnrealCommandCenterEditor",
      "Private",
      "DXUnrealCommandPlans.cpp"
    ),
    "utf8"
  );
  const commandIds = Array.from(source.matchAll(/TEXT\("dx\.unreal-engine\.[^"]+"\)/g));
  const mutationGuards = Array.from(source.matchAll(/,\s*false\s*\}/g));

  if (commandIds.length !== 3) {
    throw new Error("Unreal Engine command plans must define exactly three command ids.");
  }

  if (mutationGuards.length !== 3) {
    throw new Error("Unreal Engine command plans must keep every command project-safe.");
  }

  for (const operation of ["dx.status", "dx.assets.search", "receipt.showPath"]) {
    if (!source.includes(`TEXT("${operation}")`)) {
      throw new Error(`Unreal Engine command plans must include ${operation}.`);
    }
  }

  if (!/TEXT\("dx\.status"\)[\s\S]*true,\s*false/.test(source)) {
    throw new Error("Unreal Engine status command must require local-service proof.");
  }

  if (!/TEXT\("dx\.assets\.search"\)[\s\S]*true,\s*false/.test(source)) {
    throw new Error("Unreal Engine asset search command must require local-service proof.");
  }

  return {
    commandCount: commandIds.length,
    mutatesProject: false,
    localServiceProofRequired: true
  };
}

function hashPackageFiles(files: UnrealEnginePackageOutputFile[]): string {
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
