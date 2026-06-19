import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  type GzipPackageArtifactProof,
  writeGzipTarballArtifactProof
} from "./lib/package-artifact-proof.ts";

export interface UnityEditorPackageOutputReceiptOptions {
  adapterRoot?: string;
  packageRoot?: string;
  upmTarballPath?: string;
  receiptPath?: string;
  generatedAt?: Date | string;
  verificationCommand?: string;
}

export interface UnityEditorPackageOutputReceipt {
  receipt: "dx.extension.unity_editor.package_output";
  adapterId: "dx.unity-editor.command-center";
  host: "unity-editor";
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  package: {
    root: string;
    format: "unity-upm-source-layout";
    fileCount: number;
    sha256: string;
    files: UnityEditorPackageOutputFile[];
  };
  packageManifest: {
    name: string;
    displayName: string;
    version: string;
    unity: string;
  };
  editorAssembly: {
    name: string;
    includePlatforms: string[];
  };
  upmTarball: GzipPackageArtifactProof;
  commandPlans: {
    commandCount: number;
    mutatesProject: false;
    localServiceProofRequired: true;
  };
  releaseClaims: {
    loadedUnityEditorVerified: false;
    testProjectSmokeVerified: false;
    projectImportVerified: false;
    localServiceVerified: false;
    packageTarballVerified: false;
    signingVerified: false;
    releaseChecksumVerified: false;
    assetStoreReviewVerified: false;
    distributionVerified: false;
  };
}

export interface UnityEditorPackageOutputFile {
  relativePath: string;
  bytes: number;
  sha256: string;
}

const adapterId = "dx.unity-editor.command-center";
const expectedPackageFiles = [
  "Editor/DX.Unity.Editor.asmdef",
  "Editor/DxUnityCommandCenterWindow.cs",
  "Editor/DxUnityCommandPlans.cs",
  "Editor/DxUnityLocalServiceBoundary.cs",
  "Editor/DxUnityMenu.cs",
  "README.md",
  "Tests/Editor/DX.Unity.Editor.Tests.asmdef",
  "dx.extension.toml",
  "package.json"
];

export function writeUnityEditorPackageOutputReceipt(
  options: UnityEditorPackageOutputReceiptOptions = {}
): UnityEditorPackageOutputReceipt {
  const adapterRoot = resolve(
    options.adapterRoot ?? join(process.cwd(), "hosts", "unity", "dx-unity-editor")
  );
  const packageRoot = resolve(options.packageRoot ?? adapterRoot);
  const receiptPath = resolve(
    options.receiptPath ??
      join(process.cwd(), ".dx", "receipts", "extensions", adapterId, "package-output-latest.json")
  );
  const files = readPackageFiles(packageRoot);
  const packageManifest = readPackageManifestProof(packageRoot);
  const upmTarballPath = resolve(
    options.upmTarballPath ??
      join(packageRoot, "dist", `${packageManifest.name}-${packageManifest.version}.tgz`)
  );

  const receipt: UnityEditorPackageOutputReceipt = {
    receipt: "dx.extension.unity_editor.package_output",
    adapterId,
    host: "unity-editor",
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand: options.verificationCommand ?? "npm run package:unity-editor:j1",
    receiptPath,
    package: {
      root: packageRoot,
      format: "unity-upm-source-layout",
      fileCount: files.length,
      sha256: hashPackageFiles(files),
      files
    },
    packageManifest,
    editorAssembly: readEditorAssemblyProof(packageRoot),
    upmTarball: writeGzipTarballArtifactProof(
      upmTarballPath,
      packageArtifactEntries(packageRoot, files)
    ),
    commandPlans: readCommandPlansProof(packageRoot),
    releaseClaims: {
      loadedUnityEditorVerified: false,
      testProjectSmokeVerified: false,
      projectImportVerified: false,
      localServiceVerified: false,
      packageTarballVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      assetStoreReviewVerified: false,
      distributionVerified: false
    }
  };

  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

  return receipt;
}

if (isDirectRun()) {
  const receipt = writeUnityEditorPackageOutputReceipt({
    verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run package:unity-editor:j1"
  });

  console.log(`Unity Editor package output receipt written: ${receipt.receiptPath}`);
}

function readPackageFiles(packageRoot: string): UnityEditorPackageOutputFile[] {
  return expectedPackageFiles.map((relativePath) => {
    const bytes = readFileSync(join(packageRoot, relativePath));

    if (bytes.length <= 0) {
      throw new Error(`Unity Editor package output file is empty: ${relativePath}`);
    }

    return {
      relativePath,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex")
    };
  });
}

function packageArtifactEntries(packageRoot: string, files: UnityEditorPackageOutputFile[]) {
  return files.map((file) => ({
    relativePath: file.relativePath,
    sourcePath: join(packageRoot, ...file.relativePath.split("/"))
  }));
}

function readPackageManifestProof(
  packageRoot: string
): UnityEditorPackageOutputReceipt["packageManifest"] {
  const packageManifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));

  for (const field of ["name", "displayName", "version", "unity"]) {
    if (typeof packageManifest[field] !== "string" || packageManifest[field].trim() === "") {
      throw new Error(`Unity package manifest must define ${field}.`);
    }
  }

  return {
    name: packageManifest.name,
    displayName: packageManifest.displayName,
    version: packageManifest.version,
    unity: packageManifest.unity
  };
}

function readEditorAssemblyProof(
  packageRoot: string
): UnityEditorPackageOutputReceipt["editorAssembly"] {
  const assemblyDefinition = JSON.parse(
    readFileSync(join(packageRoot, "Editor", "DX.Unity.Editor.asmdef"), "utf8")
  );

  if (assemblyDefinition.name !== "DX.Unity.Editor") {
    throw new Error("Unity editor assembly definition must be DX.Unity.Editor.");
  }

  if (
    !Array.isArray(assemblyDefinition.includePlatforms) ||
    assemblyDefinition.includePlatforms.length !== 1 ||
    assemblyDefinition.includePlatforms[0] !== "Editor"
  ) {
    throw new Error("Unity editor assembly definition must be Editor-only.");
  }

  return {
    name: assemblyDefinition.name,
    includePlatforms: assemblyDefinition.includePlatforms
  };
}

function readCommandPlansProof(
  packageRoot: string
): UnityEditorPackageOutputReceipt["commandPlans"] {
  const source = readFileSync(join(packageRoot, "Editor", "DxUnityCommandPlans.cs"), "utf8");
  const commandIds = Array.from(source.matchAll(/internal const string \w+ = "dx\.unity-editor\.[^"]+"/g));
  const mutationGuards = Array.from(source.matchAll(/MutatesProject:\s*false/g));

  if (commandIds.length !== 3) {
    throw new Error("Unity Editor command plans must define exactly three command ids.");
  }

  if (mutationGuards.length !== 3) {
    throw new Error("Unity Editor command plans must keep every command project-safe.");
  }

  for (const operation of ["dx.status", "dx.assets.search", "receipt.showPath"]) {
    if (!source.includes(`Operation: "${operation}"`)) {
      throw new Error(`Unity Editor command plans must include ${operation}.`);
    }
  }

  if (!/Operation:\s*"dx\.status"[\s\S]*RequiresRuntimeProof:\s*true/.test(source)) {
    throw new Error("Unity Editor status command must require local-service proof.");
  }

  if (!/Operation:\s*"dx\.assets\.search"[\s\S]*RequiresRuntimeProof:\s*true/.test(source)) {
    throw new Error("Unity Editor asset search command must require local-service proof.");
  }

  return {
    commandCount: commandIds.length,
    mutatesProject: false,
    localServiceProofRequired: true
  };
}

function hashPackageFiles(files: UnityEditorPackageOutputFile[]): string {
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
