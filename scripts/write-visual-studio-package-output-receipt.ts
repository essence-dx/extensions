import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  type ZipPackageArtifactProof,
  writeZipArtifactProof
} from "./lib/package-artifact-proof.ts";

export interface VisualStudioPackageOutputReceiptOptions {
  adapterRoot?: string;
  packageRoot?: string;
  vsixPath?: string;
  receiptPath?: string;
  generatedAt?: Date | string;
  verificationCommand?: string;
}

export interface VisualStudioPackageOutputReceipt {
  receipt: "dx.extension.visual_studio.package_output";
  adapterId: "dx.visual-studio.command-center";
  host: "visual-studio";
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  package: {
    root: string;
    format: "visual-studio-vsix-source-layout";
    fileCount: number;
    sha256: string;
    files: VisualStudioPackageOutputFile[];
  };
  vsixManifest: {
    identityId: string;
    version: string;
    publisher: string;
    displayName: string;
    targetVersion: string;
    assetType: string;
  };
  vsix: ZipPackageArtifactProof;
  commandPlans: {
    commandCount: number;
    mutatesSolution: false;
    localServiceProofRequired: true;
  };
  releaseClaims: {
    loadedExperimentalInstanceVerified: false;
    vsixPackageVerified: false;
    localServiceVerified: false;
    signingVerified: false;
    releaseChecksumVerified: false;
    marketplaceReviewVerified: false;
    distributionVerified: false;
  };
}

export interface VisualStudioPackageOutputFile {
  relativePath: string;
  bytes: number;
  sha256: string;
}

const adapterId = "dx.visual-studio.command-center";
const expectedPackageFiles = [
  "Dx.VisualStudio.CommandCenter.csproj",
  "README.md",
  "Resources/DxCommandCenter.vsct",
  "dx.extension.toml",
  "source.extension.vsixmanifest",
  "src/CommandPlans/DxCommandPlan.cs",
  "src/CommandPlans/DxCommandPlans.cs",
  "src/Commands/CommandIds.cs",
  "src/Commands/RegisterDxCommands.cs",
  "src/DxVisualStudioPackage.cs",
  "src/Receipts/ReceiptPaths.cs",
  "src/Services/DxLocalServiceBoundary.cs"
];

export function writeVisualStudioPackageOutputReceipt(
  options: VisualStudioPackageOutputReceiptOptions = {}
): VisualStudioPackageOutputReceipt {
  const adapterRoot = resolve(
    options.adapterRoot ?? join(process.cwd(), "hosts", "visual-studio", "dx-visual-studio")
  );
  const packageRoot = resolve(options.packageRoot ?? adapterRoot);
  const receiptPath = resolve(
    options.receiptPath ??
      join(process.cwd(), ".dx", "receipts", "extensions", adapterId, "package-output-latest.json")
  );
  const files = readPackageFiles(packageRoot);
  const vsixManifest = readVsixManifestProof(packageRoot);
  const vsixPath = resolve(
    options.vsixPath ?? join(packageRoot, "bin", "Release", `dx-visual-studio-${vsixManifest.version}.vsix`)
  );

  const receipt: VisualStudioPackageOutputReceipt = {
    receipt: "dx.extension.visual_studio.package_output",
    adapterId,
    host: "visual-studio",
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand: options.verificationCommand ?? "npm run package:visual-studio:j1",
    receiptPath,
    package: {
      root: packageRoot,
      format: "visual-studio-vsix-source-layout",
      fileCount: files.length,
      sha256: hashPackageFiles(files),
      files
    },
    vsixManifest,
    vsix: writeZipArtifactProof(vsixPath, packageArtifactEntries(packageRoot, files)),
    commandPlans: readCommandPlansProof(packageRoot),
    releaseClaims: {
      loadedExperimentalInstanceVerified: false,
      vsixPackageVerified: false,
      localServiceVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      marketplaceReviewVerified: false,
      distributionVerified: false
    }
  };

  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

  return receipt;
}

if (isDirectRun()) {
  const receipt = writeVisualStudioPackageOutputReceipt({
    verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run package:visual-studio:j1"
  });

  console.log(`Visual Studio package output receipt written: ${receipt.receiptPath}`);
}

function readPackageFiles(packageRoot: string): VisualStudioPackageOutputFile[] {
  return expectedPackageFiles.map((relativePath) => {
    const bytes = readFileSync(join(packageRoot, relativePath));

    if (bytes.length <= 0) {
      throw new Error(`Visual Studio package output file is empty: ${relativePath}`);
    }

    return {
      relativePath,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex")
    };
  });
}

function packageArtifactEntries(packageRoot: string, files: VisualStudioPackageOutputFile[]) {
  return files.map((file) => ({
    relativePath: file.relativePath,
    sourcePath: join(packageRoot, ...file.relativePath.split("/"))
  }));
}

function readVsixManifestProof(
  packageRoot: string
): VisualStudioPackageOutputReceipt["vsixManifest"] {
  const source = readFileSync(join(packageRoot, "source.extension.vsixmanifest"), "utf8");
  const identityId = requireXmlAttribute(source, "Identity", "Id");
  const version = requireXmlAttribute(source, "Identity", "Version");
  const publisher = requireXmlAttribute(source, "Identity", "Publisher");
  const targetVersion = requireXmlAttribute(source, "InstallationTarget", "Version");
  const assetType = requireXmlAttribute(source, "Asset", "Type");
  const displayName = requireXmlText(source, "DisplayName");

  if (identityId !== "dev.dx.visual-studio.command-center") {
    throw new Error("Visual Studio VSIX manifest identity is not the DX command center.");
  }

  if (assetType !== "Microsoft.VisualStudio.VsPackage") {
    throw new Error("Visual Studio VSIX manifest must expose a VsPackage asset.");
  }

  return {
    identityId,
    version,
    publisher,
    displayName,
    targetVersion,
    assetType
  };
}

function readCommandPlansProof(
  packageRoot: string
): VisualStudioPackageOutputReceipt["commandPlans"] {
  const source = readFileSync(
    join(packageRoot, "src", "CommandPlans", "DxCommandPlans.cs"),
    "utf8"
  );
  const operations = Array.from(source.matchAll(/Operation:\s*"([^"]+)"/g)).map(
    (match) => match[1]
  );
  const mutationGuards = Array.from(source.matchAll(/MutatesSolution:\s*false/g));

  if (operations.length !== 3) {
    throw new Error("Visual Studio command plans must define exactly three operations.");
  }

  for (const operation of ["dx.status", "dx.assets.search", "receipt.showPath"]) {
    if (!operations.includes(operation)) {
      throw new Error(`Visual Studio command plans must include ${operation}.`);
    }
  }

  if (mutationGuards.length !== 3) {
    throw new Error("Visual Studio command plans must keep every command solution-safe.");
  }

  if (!/Operation:\s*"dx\.status"[\s\S]*RequiresRuntimeProof:\s*true/.test(source)) {
    throw new Error("Visual Studio status command must require local-service proof.");
  }

  if (!/Operation:\s*"dx\.assets\.search"[\s\S]*RequiresRuntimeProof:\s*true/.test(source)) {
    throw new Error("Visual Studio asset search command must require local-service proof.");
  }

  return {
    commandCount: operations.length,
    mutatesSolution: false,
    localServiceProofRequired: true
  };
}

function requireXmlAttribute(source: string, elementName: string, attributeName: string): string {
  const element = source.match(new RegExp(`<${elementName}\\b[^>]*>`))?.[0];
  const value = element?.match(new RegExp(`${attributeName}="([^"]+)"`))?.[1];

  if (!value) {
    throw new Error(`Visual Studio VSIX manifest must define ${elementName}.${attributeName}.`);
  }

  return value;
}

function requireXmlText(source: string, elementName: string): string {
  const value = source.match(new RegExp(`<${elementName}>([^<]+)</${elementName}>`))?.[1];

  if (!value) {
    throw new Error(`Visual Studio VSIX manifest must define ${elementName}.`);
  }

  return value;
}

function hashPackageFiles(files: VisualStudioPackageOutputFile[]): string {
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
