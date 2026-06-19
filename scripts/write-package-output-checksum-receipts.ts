import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyPackageOutputReceipt } from "./lib/package-output-proof.ts";

export interface PackageOutputChecksumReceiptOptions {
  receiptRoot?: string;
  targets?: string[];
  overwrite?: boolean;
  generatedAt?: Date | string;
  verificationCommand?: string;
}

export interface PackageOutputChecksumReceipt {
  receipt: "dx.extension.package_output.checksum";
  adapterId: string;
  host: string;
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  packageOutput: {
    receiptPath: string;
    payloadKind: "package" | "bundle";
    root: string;
    fileCount: number;
    filesVerified: number;
    sha256: string;
    releaseClaimKeys: string[];
  };
  checksum: {
    algorithm: "sha256";
    scope: "package-output";
    sha256: string;
    fileCount: number;
  };
  releaseClaims: {
    packageOutputVerified: true;
    packageOutputChecksumVerified: true;
    loadedHostVerified: false;
    signingVerified: false;
    distributionVerified: false;
    publicReleasePackageVerified: false;
  };
}

const packageOutputReceiptName = "package-output-latest.json";
const checksumReceiptName = "package-output-checksum-latest.json";

export function writePackageOutputChecksumReceipts(
  options: PackageOutputChecksumReceiptOptions = {}
): PackageOutputChecksumReceipt[] {
  const receiptRoot = resolve(options.receiptRoot ?? join(process.cwd(), ".dx", "receipts", "extensions"));
  const adapterIds = selectAdapterIds(receiptRoot, options);

  return adapterIds.map((adapterId) => writePackageOutputChecksumReceipt(adapterId, receiptRoot, options));
}

if (isDirectRun()) {
  const receipts = writePackageOutputChecksumReceipts({
    verificationCommand:
      process.env.DX_VERIFICATION_COMMAND ?? "npm run write:package-output-checksum-receipts:j1"
  });

  if (receipts.length === 0) {
    console.log("No package output checksum receipts needed.");
  }

  for (const receipt of receipts) {
    console.log(`Package output checksum receipt written: ${receipt.receiptPath}`);
  }
}

function writePackageOutputChecksumReceipt(
  adapterId: string,
  receiptRoot: string,
  options: PackageOutputChecksumReceiptOptions
): PackageOutputChecksumReceipt {
  const packageOutputReceiptPath = join(receiptRoot, adapterId, packageOutputReceiptName);
  const checksumReceiptPath = join(receiptRoot, adapterId, checksumReceiptName);
  const proof = verifyPackageOutputReceipt(
    adapterId,
    JSON.parse(readFileSync(packageOutputReceiptPath, "utf8"))
  );
  const receipt: PackageOutputChecksumReceipt = {
    receipt: "dx.extension.package_output.checksum",
    adapterId,
    host: proof.host,
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand:
      options.verificationCommand ?? "npm run write:package-output-checksum-receipts:j1",
    receiptPath: checksumReceiptPath,
    packageOutput: {
      receiptPath: packageOutputReceiptPath,
      payloadKind: proof.payloadKind,
      root: proof.root,
      fileCount: proof.fileCount,
      filesVerified: proof.filesVerified,
      sha256: proof.sha256,
      releaseClaimKeys: proof.releaseClaimKeys
    },
    checksum: {
      algorithm: "sha256",
      scope: "package-output",
      sha256: proof.sha256,
      fileCount: proof.fileCount
    },
    releaseClaims: {
      packageOutputVerified: true,
      packageOutputChecksumVerified: true,
      loadedHostVerified: false,
      signingVerified: false,
      distributionVerified: false,
      publicReleasePackageVerified: false
    }
  };

  mkdirSync(dirname(checksumReceiptPath), { recursive: true });
  writeFileSync(checksumReceiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

  return receipt;
}

function selectAdapterIds(receiptRoot: string, options: PackageOutputChecksumReceiptOptions): string[] {
  const requestedTargets = options.targets?.map(expectSafeAdapterId);
  const adapterIds = requestedTargets ?? discoverPackageOutputAdapterIds(receiptRoot);

  return adapterIds.filter((adapterId) => {
    const packageOutputReceiptPath = join(receiptRoot, adapterId, packageOutputReceiptName);
    const checksumReceiptPath = join(receiptRoot, adapterId, checksumReceiptName);

    if (!existsSync(packageOutputReceiptPath)) {
      if (requestedTargets) {
        throw new Error(`package output receipt is missing for ${adapterId}`);
      }

      return false;
    }

    return options.overwrite === true || !existsSync(checksumReceiptPath);
  });
}

function discoverPackageOutputAdapterIds(receiptRoot: string): string[] {
  if (!existsSync(receiptRoot)) {
    return [];
  }

  return readdirSync(receiptRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter(isSafeAdapterId)
    .filter((adapterId) => existsSync(join(receiptRoot, adapterId, packageOutputReceiptName)))
    .sort((left, right) => left.localeCompare(right));
}

function expectSafeAdapterId(adapterId: string): string {
  if (!isSafeAdapterId(adapterId)) {
    throw new Error("package output checksum target must be a safe adapter id");
  }

  return adapterId;
}

function isSafeAdapterId(adapterId: string): boolean {
  return /^dx\.[a-z0-9][a-z0-9.-]*$/.test(adapterId) && !adapterId.includes("..");
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
