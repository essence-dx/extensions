import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  type ZipPackageArtifactProof,
  writeZipArtifactProof
} from "./lib/package-artifact-proof.ts";

export interface IntellijPlatformPackageOutputReceiptOptions {
  adapterRoot?: string;
  packageRoot?: string;
  gradlePluginPackagePath?: string;
  receiptPath?: string;
  generatedAt?: Date | string;
  verificationCommand?: string;
}

export interface IntellijPlatformPackageOutputReceipt {
  receipt: "dx.extension.intellij_platform.package_output";
  adapterId: "dx.intellij-platform.command-center";
  host: "intellij-platform";
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  package: {
    root: string;
    format: "intellij-platform-gradle-source-layout";
    fileCount: number;
    sha256: string;
    files: IntellijPlatformPackageOutputFile[];
  };
  pluginXml: {
    id: string;
    name: string;
    vendor: string;
    dependency: string;
    actionCount: number;
    hasToolWindow: true;
    hasProjectService: true;
  };
  gradlePluginPackage: ZipPackageArtifactProof;
  commandPlans: {
    commandCount: number;
    mutatesProject: false;
    localServiceProofRequired: true;
  };
  releaseClaims: {
    sandboxIdeVerified: false;
    pluginVerifierVerified: false;
    gradlePluginPackageVerified: false;
    localServiceVerified: false;
    signingVerified: false;
    releaseChecksumVerified: false;
    marketplaceReviewVerified: false;
    distributionVerified: false;
  };
}

export interface IntellijPlatformPackageOutputFile {
  relativePath: string;
  bytes: number;
  sha256: string;
}

const adapterId = "dx.intellij-platform.command-center";
const expectedPackageFiles = [
  "README.md",
  "build.gradle.kts",
  "dx.extension.toml",
  "gradle.properties",
  "settings.gradle.kts",
  "src/main/kotlin/dev/dx/intellij/actions/DxCommandCenterAction.kt",
  "src/main/kotlin/dev/dx/intellij/commands/DxCommandPlans.kt",
  "src/main/kotlin/dev/dx/intellij/services/DxCommandPlanService.kt",
  "src/main/kotlin/dev/dx/intellij/toolwindow/DxToolWindowFactory.kt",
  "src/main/resources/META-INF/plugin.xml",
  "src/main/resources/icons/dx.svg"
];

export function writeIntellijPlatformPackageOutputReceipt(
  options: IntellijPlatformPackageOutputReceiptOptions = {}
): IntellijPlatformPackageOutputReceipt {
  const adapterRoot = resolve(
    options.adapterRoot ?? join(process.cwd(), "hosts", "jetbrains", "dx-intellij-platform")
  );
  const packageRoot = resolve(options.packageRoot ?? adapterRoot);
  const receiptPath = resolve(
    options.receiptPath ??
      join(process.cwd(), ".dx", "receipts", "extensions", adapterId, "package-output-latest.json")
  );
  const files = readPackageFiles(packageRoot);
  const gradlePluginPackagePath = resolve(
    options.gradlePluginPackagePath ??
      join(packageRoot, "build", "distributions", `dx-intellij-platform-${readGradleVersion(packageRoot)}.zip`)
  );

  const receipt: IntellijPlatformPackageOutputReceipt = {
    receipt: "dx.extension.intellij_platform.package_output",
    adapterId,
    host: "intellij-platform",
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand: options.verificationCommand ?? "npm run package:intellij-platform:j1",
    receiptPath,
    package: {
      root: packageRoot,
      format: "intellij-platform-gradle-source-layout",
      fileCount: files.length,
      sha256: hashPackageFiles(files),
      files
    },
    pluginXml: readPluginXmlProof(packageRoot),
    gradlePluginPackage: writeZipArtifactProof(
      gradlePluginPackagePath,
      packageArtifactEntries(packageRoot, files)
    ),
    commandPlans: readCommandPlansProof(packageRoot),
    releaseClaims: {
      sandboxIdeVerified: false,
      pluginVerifierVerified: false,
      gradlePluginPackageVerified: false,
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
  const receipt = writeIntellijPlatformPackageOutputReceipt({
    verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run package:intellij-platform:j1"
  });

  console.log(`IntelliJ Platform package output receipt written: ${receipt.receiptPath}`);
}

function readPackageFiles(packageRoot: string): IntellijPlatformPackageOutputFile[] {
  return expectedPackageFiles.map((relativePath) => {
    const bytes = readFileSync(join(packageRoot, relativePath));

    if (bytes.length <= 0) {
      throw new Error(`IntelliJ Platform package output file is empty: ${relativePath}`);
    }

    return {
      relativePath,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex")
    };
  });
}

function packageArtifactEntries(packageRoot: string, files: IntellijPlatformPackageOutputFile[]) {
  return files.map((file) => ({
    relativePath: file.relativePath,
    sourcePath: join(packageRoot, ...file.relativePath.split("/"))
  }));
}

function readGradleVersion(packageRoot: string): string {
  const source = readFileSync(join(packageRoot, "build.gradle.kts"), "utf8");
  const version = source.match(/\bversion\s*=\s*"([^"]+)"/)?.[1];

  if (!version) {
    throw new Error("IntelliJ build.gradle.kts must define a package version.");
  }

  return version;
}

function readPluginXmlProof(
  packageRoot: string
): IntellijPlatformPackageOutputReceipt["pluginXml"] {
  const source = readFileSync(
    join(packageRoot, "src", "main", "resources", "META-INF", "plugin.xml"),
    "utf8"
  );
  const id = requireXmlText(source, "id");
  const name = requireXmlText(source, "name");
  const vendor = requireXmlText(source, "vendor");
  const dependency = requireXmlText(source, "depends");
  const actionCount = Array.from(source.matchAll(/<action\b/g)).length;
  const hasToolWindow = /<toolWindow\b[\s\S]*factoryClass="dev\.dx\.intellij\.toolwindow\.DxToolWindowFactory"/.test(source);
  const hasProjectService = /<projectService\b[\s\S]*serviceImplementation="dev\.dx\.intellij\.services\.DxCommandPlanService"/.test(source);

  if (id !== "dev.dx.intellij-platform.command-center") {
    throw new Error("IntelliJ plugin.xml id must be the DX command center.");
  }

  if (actionCount !== 3) {
    throw new Error("IntelliJ plugin.xml must declare exactly three DX actions.");
  }

  if (!hasToolWindow || !hasProjectService) {
    throw new Error("IntelliJ plugin.xml must declare the DX tool window and project service.");
  }

  return {
    id,
    name,
    vendor,
    dependency,
    actionCount,
    hasToolWindow: true,
    hasProjectService: true
  };
}

function readCommandPlansProof(
  packageRoot: string
): IntellijPlatformPackageOutputReceipt["commandPlans"] {
  const source = readFileSync(
    join(
      packageRoot,
      "src",
      "main",
      "kotlin",
      "dev",
      "dx",
      "intellij",
      "commands",
      "DxCommandPlans.kt"
    ),
    "utf8"
  );
  const operations = Array.from(source.matchAll(/operation = "([^"]+)"/g)).map(
    (match) => match[1]
  );
  const mutationGuards = Array.from(source.matchAll(/mutatesProject = false/g));

  if (operations.length !== 3) {
    throw new Error("IntelliJ command plans must define exactly three operations.");
  }

  for (const operation of ["dx.status", "dx.assets.search", "receipt.showPath"]) {
    if (!operations.includes(operation)) {
      throw new Error(`IntelliJ command plans must include ${operation}.`);
    }
  }

  if (mutationGuards.length !== 3) {
    throw new Error("IntelliJ command plans must keep every command project-safe.");
  }

  if (!/operation = "dx\.status"[\s\S]*requiresRuntimeProof = true/.test(source)) {
    throw new Error("IntelliJ status command must require local-service proof.");
  }

  if (!/operation = "dx\.assets\.search"[\s\S]*requiresRuntimeProof = true/.test(source)) {
    throw new Error("IntelliJ asset search command must require local-service proof.");
  }

  return {
    commandCount: operations.length,
    mutatesProject: false,
    localServiceProofRequired: true
  };
}

function requireXmlText(source: string, elementName: string): string {
  const value = source.match(new RegExp(`<${elementName}(?:\\s[^>]*)?>([^<]+)</${elementName}>`))?.[1];

  if (!value) {
    throw new Error(`IntelliJ plugin.xml must define ${elementName}.`);
  }

  return value;
}

function hashPackageFiles(files: IntellijPlatformPackageOutputFile[]): string {
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
