import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyPackageOutputReceipt } from "./lib/package-output-proof.ts";

export type CreativeHostChecksumAdapterId =
  | "dx.blender.command-center"
  | "dx.sketch.command-center"
  | "dx.davinci-resolve.command-center";

export type CreativeHostChecksumHost = "blender" | "sketch" | "davinci-resolve";

export interface CreativeHostChecksumReceiptOptions {
  receiptRoot?: string;
  targets?: CreativeHostChecksumAdapterId[];
  generatedAt?: Date | string;
  verificationCommand?: string;
}

export interface CreativeHostChecksumReceipt {
  receipt: "dx.extension.creative_host.package_output_checksum";
  adapterId: CreativeHostChecksumAdapterId;
  host: CreativeHostChecksumHost;
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
  releaseClaims: CreativeHostChecksumReleaseClaims;
}

export type CreativeHostChecksumReleaseClaims =
  | BlenderChecksumReleaseClaims
  | SketchChecksumReleaseClaims
  | DavinciResolveChecksumReleaseClaims;

interface SharedChecksumReleaseClaims {
  packageOutputVerified: true;
  packageOutputChecksumVerified: true;
  loadedHostVerified: false;
  signingVerified: false;
  distributionVerified: false;
  publicReleasePackageVerified: false;
}

interface BlenderChecksumReleaseClaims extends SharedChecksumReleaseClaims {
  installedAddonVerified: false;
  packageArchiveVerified: false;
}

interface SketchChecksumReleaseClaims extends SharedChecksumReleaseClaims {
  sketchtoolVerified: false;
  localServiceVerified: false;
  notarizationVerified: false;
}

interface DavinciResolveChecksumReleaseClaims extends SharedChecksumReleaseClaims {
  workflowIntegrationVerified: false;
  localServiceVerified: false;
}

const creativeHostTargets = [
  {
    adapterId: "dx.blender.command-center",
    host: "blender"
  },
  {
    adapterId: "dx.sketch.command-center",
    host: "sketch"
  },
  {
    adapterId: "dx.davinci-resolve.command-center",
    host: "davinci-resolve"
  }
] as const;

type CreativeHostChecksumTarget = (typeof creativeHostTargets)[number];

export function writeCreativeHostChecksumReceipts(
  options: CreativeHostChecksumReceiptOptions = {}
): CreativeHostChecksumReceipt[] {
  const receiptRoot = resolve(options.receiptRoot ?? join(process.cwd(), ".dx", "receipts", "extensions"));
  const targets = selectTargets(options.targets);

  return targets.map((target) => writeCreativeHostChecksumReceipt(target, receiptRoot, options));
}

if (isDirectRun()) {
  const receipts = writeCreativeHostChecksumReceipts({
    verificationCommand:
      process.env.DX_VERIFICATION_COMMAND ?? "npm run write:creative-host-checksum-receipts:j1"
  });

  for (const receipt of receipts) {
    console.log(`Creative host checksum receipt written: ${receipt.receiptPath}`);
  }
}

function writeCreativeHostChecksumReceipt(
  target: CreativeHostChecksumTarget,
  receiptRoot: string,
  options: CreativeHostChecksumReceiptOptions
): CreativeHostChecksumReceipt {
  const packageOutputReceiptPath = join(receiptRoot, target.adapterId, "package-output-latest.json");
  const checksumReceiptPath = join(receiptRoot, target.adapterId, "checksum-latest.json");
  const packageOutputProof = verifyPackageOutputReceipt(
    target.adapterId,
    JSON.parse(readFileSync(packageOutputReceiptPath, "utf8"))
  );

  if (packageOutputProof.host !== target.host) {
    throw new Error(`package output receipt host mismatch for ${target.adapterId}`);
  }

  const receipt: CreativeHostChecksumReceipt = {
    receipt: "dx.extension.creative_host.package_output_checksum",
    adapterId: target.adapterId,
    host: target.host,
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand:
      options.verificationCommand ?? "npm run write:creative-host-checksum-receipts:j1",
    receiptPath: checksumReceiptPath,
    packageOutput: {
      receiptPath: packageOutputReceiptPath,
      payloadKind: packageOutputProof.payloadKind,
      root: packageOutputProof.root,
      fileCount: packageOutputProof.fileCount,
      filesVerified: packageOutputProof.filesVerified,
      sha256: packageOutputProof.sha256,
      releaseClaimKeys: packageOutputProof.releaseClaimKeys
    },
    checksum: {
      algorithm: "sha256",
      scope: "package-output",
      sha256: packageOutputProof.sha256,
      fileCount: packageOutputProof.fileCount
    },
    releaseClaims: releaseClaimsFor(target.adapterId)
  };

  mkdirSync(dirname(checksumReceiptPath), { recursive: true });
  writeFileSync(checksumReceiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

  return receipt;
}

function selectTargets(
  requestedTargets: CreativeHostChecksumAdapterId[] | undefined
): CreativeHostChecksumTarget[] {
  if (!requestedTargets) {
    return [...creativeHostTargets];
  }

  const targets = creativeHostTargets.filter((target) => requestedTargets.includes(target.adapterId));

  if (targets.length !== requestedTargets.length) {
    const knownTargets = new Set(creativeHostTargets.map((target) => target.adapterId));
    const unknownTargets = requestedTargets.filter((target) => !knownTargets.has(target));
    throw new Error(`unsupported creative host checksum targets: ${unknownTargets.join(", ")}`);
  }

  return targets;
}

function releaseClaimsFor(adapterId: CreativeHostChecksumAdapterId): CreativeHostChecksumReleaseClaims {
  const sharedClaims: SharedChecksumReleaseClaims = {
    packageOutputVerified: true,
    packageOutputChecksumVerified: true,
    loadedHostVerified: false,
    signingVerified: false,
    distributionVerified: false,
    publicReleasePackageVerified: false
  };

  if (adapterId === "dx.blender.command-center") {
    return {
      ...sharedClaims,
      installedAddonVerified: false,
      packageArchiveVerified: false
    };
  }

  if (adapterId === "dx.sketch.command-center") {
    return {
      ...sharedClaims,
      sketchtoolVerified: false,
      localServiceVerified: false,
      notarizationVerified: false
    };
  }

  return {
    ...sharedClaims,
    workflowIntegrationVerified: false,
    localServiceVerified: false
  };
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
