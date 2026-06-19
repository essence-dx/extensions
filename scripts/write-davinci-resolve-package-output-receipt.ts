import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface DavinciResolvePackageOutputReceiptOptions {
  adapterRoot?: string;
  packageRoot?: string;
  receiptPath?: string;
  generatedAt?: Date | string;
  verificationCommand?: string;
}

export interface DavinciResolvePackageOutputReceipt {
  receipt: "dx.extension.davinci_resolve.package_output";
  adapterId: "dx.davinci-resolve.command-center";
  host: "davinci-resolve";
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  package: {
    root: string;
    fileCount: number;
    sha256: string;
    files: DavinciResolvePackageOutputFile[];
  };
  commandPlans: {
    schema: "dx.davinci_resolve.command_plans";
    commandCount: number;
    mutatesResolveProject: false;
  };
  releaseClaims: {
    loadedResolveVerified: false;
    readOnlyProjectMetadataVerified: false;
    workflowIntegrationVerified: false;
    localServiceVerified: false;
    signingVerified: false;
    releaseChecksumVerified: false;
    distributionVerified: false;
  };
}

export interface DavinciResolvePackageOutputFile {
  relativePath: string;
  bytes: number;
  sha256: string;
}

const adapterId = "dx.davinci-resolve.command-center";
const expectedPackageFiles = [
  "command-plans.json",
  "dx.extension.toml",
  "scripts/dx_command_center.lua",
  "scripts/dx_command_center.py"
];

export function writeDavinciResolvePackageOutputReceipt(
  options: DavinciResolvePackageOutputReceiptOptions = {}
): DavinciResolvePackageOutputReceipt {
  const adapterRoot = resolve(
    options.adapterRoot ?? join(process.cwd(), "hosts", "blackmagic", "dx-davinci-resolve")
  );
  const packageRoot = resolve(options.packageRoot ?? adapterRoot);
  const receiptPath = resolve(
    options.receiptPath ??
      join(process.cwd(), ".dx", "receipts", "extensions", adapterId, "package-output-latest.json")
  );
  const files = readPackageFiles(packageRoot);
  const commandPlans = readCommandPlansProof(packageRoot);

  const receipt: DavinciResolvePackageOutputReceipt = {
    receipt: "dx.extension.davinci_resolve.package_output",
    adapterId,
    host: "davinci-resolve",
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand: options.verificationCommand ?? "npm run package:davinci-resolve:j1",
    receiptPath,
    package: {
      root: packageRoot,
      fileCount: files.length,
      sha256: hashPackageFiles(files),
      files
    },
    commandPlans,
    releaseClaims: {
      loadedResolveVerified: false,
      readOnlyProjectMetadataVerified: false,
      workflowIntegrationVerified: false,
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
  const receipt = writeDavinciResolvePackageOutputReceipt({
    verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run package:davinci-resolve:j1"
  });

  console.log(`DaVinci Resolve package output receipt written: ${receipt.receiptPath}`);
}

function readPackageFiles(packageRoot: string): DavinciResolvePackageOutputFile[] {
  return expectedPackageFiles.map((relativePath) => {
    const bytes = readFileSync(join(packageRoot, relativePath));

    if (bytes.length <= 0) {
      throw new Error(`DaVinci Resolve package output file is empty: ${relativePath}`);
    }

    return {
      relativePath,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex")
    };
  });
}

function readCommandPlansProof(
  packageRoot: string
): DavinciResolvePackageOutputReceipt["commandPlans"] {
  const commandPlans = JSON.parse(readFileSync(join(packageRoot, "command-plans.json"), "utf8"));

  if (commandPlans.schema !== "dx.davinci_resolve.command_plans") {
    throw new Error("DaVinci Resolve command plans must keep the expected schema.");
  }

  if (!Array.isArray(commandPlans.commands) || commandPlans.commands.length !== 3) {
    throw new Error("DaVinci Resolve command plans must contain exactly three commands.");
  }

  if (commandPlans.commands.some((command: { mutatesResolveProject?: unknown }) => command.mutatesResolveProject !== false)) {
    throw new Error("DaVinci Resolve package command plans must not mutate Resolve projects.");
  }

  return {
    schema: "dx.davinci_resolve.command_plans",
    commandCount: commandPlans.commands.length,
    mutatesResolveProject: false
  };
}

function hashPackageFiles(files: DavinciResolvePackageOutputFile[]): string {
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
