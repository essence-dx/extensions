import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  type ApplicationLoadedHostCommandResult,
  type ApplicationLoadedHostProof,
  type ApplicationLoadedHostReceipt,
  type ApplicationLoadedHostReceiptOptions,
  applicationLoadedHostAdapterConfigs
} from "./lib/application-loaded-host-model.ts";
import { writeApplicationLoadedHostSupplementalReceipts } from "./lib/application-loaded-host-supplemental.ts";
import { validateApplicationLoadedHostProof } from "./lib/application-loaded-host-validation.ts";
import { verifyPackageOutputReceipt } from "./lib/package-output-proof.ts";

export type {
  ApplicationCommandStatus,
  ApplicationHostState,
  ApplicationLoadedHostCommandResult,
  ApplicationLoadedHostProof,
  ApplicationLoadedHostReceipt,
  ApplicationLoadedHostReceiptOptions,
  ApplicationLoadedHostReleaseClaims,
  ApplicationLoadedHostTarget,
  ApplicationLoadedHostVerificationMode,
  BlenderAddonInstallReceipt,
  SketchtoolRunReceipt
} from "./lib/application-loaded-host-model.ts";

export function writeApplicationLoadedHostReceipt(
  root = process.cwd(),
  options: ApplicationLoadedHostReceiptOptions
): ApplicationLoadedHostReceipt {
  const workspaceRoot = resolve(root);
  const generatedAt = normalizeGeneratedAt(options.generatedAt);
  const verificationCommand = options.verificationCommand ?? "npm run smoke:application-loaded-host:j1";
  const proof = validateApplicationLoadedHostProof(options.proof);
  const config = applicationLoadedHostAdapterConfigs[proof.target];
  const packageOutputReceiptBytes = readFileSync(proof.packageOutputReceiptPath);
  const proofFileBytes = readFileSync(proof.proofFilePath);
  const hostExecutableBytes = readFileSync(proof.hostExecutablePath);
  const packageOutputProof = verifyPackageOutputReceipt(
    config.adapterId,
    JSON.parse(packageOutputReceiptBytes.toString("utf8"))
  );

  if (packageOutputProof.host !== config.packageHost) {
    throw new Error(`Application loaded-host package output host mismatch for ${config.adapterId}.`);
  }

  const receiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    config.adapterId,
    config.receiptName
  );
  const packageOutput = {
    receiptPath: proof.packageOutputReceiptPath,
    receiptSha256: sha256(packageOutputReceiptBytes),
    packageSha256: packageOutputProof.sha256
  };
  const manualProof = {
    proofFilePath: proof.proofFilePath,
    proofFileSha256: sha256(proofFileBytes)
  };
  const receipt: ApplicationLoadedHostReceipt = {
    receipt: "dx.extension.application.loaded_host",
    adapterId: config.adapterId,
    host: config.target,
    generatedAt,
    verificationCommand,
    receiptPath,
    hostApplication: {
      name: proof.hostApplication.trim(),
      version: proof.hostVersion.trim(),
      executablePath: proof.hostExecutablePath,
      executableSha256: sha256(hostExecutableBytes),
      verificationMode: proof.verificationMode,
      hostState: proof.hostState
    },
    packageOutput,
    loadedHost: {
      extensionInstalled: true,
      commandIdsVisible: uniqueSorted(proof.commandIdsVisible),
      commandResults: normalizeCommandResults(proof.commandResults),
      localServiceRequestsBlocked: true,
      mutatesHostDocument: false
    },
    manualProof,
    releaseClaims: {
      loadedHostVerified: true,
      localServiceVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      distributionVerified: false,
      addonInstallVerified: proof.target === "blender" && proof.addonInstalled === true,
      developmentAppVerified: proof.target === "canva" && proof.developmentAppVerified === true,
      galleryReviewVerified: false,
      communityReviewVerified: false,
      sketchtoolVerified: proof.target === "sketch" && proof.sketchtoolVerified === true
    }
  };

  attachTargetProof(receipt, proof);
  writeJsonReceipt(receiptPath, receipt);
  writeApplicationLoadedHostSupplementalReceipts(workspaceRoot, {
    generatedAt,
    manualProof,
    packageOutput,
    proof,
    receipt,
    verificationCommand
  });

  return receipt;
}

export function writeApplicationLoadedHostReceipts(
  root = process.cwd(),
  options: Omit<ApplicationLoadedHostReceiptOptions, "proof"> & {
    proof: ApplicationLoadedHostProof | ApplicationLoadedHostProof[];
  }
): ApplicationLoadedHostReceipt[] {
  const proofs = Array.isArray(options.proof) ? options.proof : [options.proof];

  return proofs.map((proof) =>
    writeApplicationLoadedHostReceipt(root, {
      generatedAt: options.generatedAt,
      verificationCommand: options.verificationCommand,
      proof
    })
  );
}

if (isDirectRun()) {
  try {
    const proofPath = process.env.DX_APPLICATION_LOADED_HOST_PROOF_JSON;

    if (!proofPath) {
      throw new Error("DX_APPLICATION_LOADED_HOST_PROOF_JSON must point to an application loaded-host proof JSON file.");
    }

    assertExistingAbsoluteFile(proofPath, "proof JSON");
    const proofSource = JSON.parse(readFileSync(proofPath, "utf8")) as
      | ApplicationLoadedHostProof
      | ApplicationLoadedHostProof[];
    const receipts = writeApplicationLoadedHostReceipts(process.cwd(), {
      proof: proofSource,
      verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run smoke:application-loaded-host:j1"
    });

    for (const receipt of receipts) {
      console.log(`${receipt.hostApplication.name} loaded-host receipt written: ${receipt.receiptPath}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function attachTargetProof(receipt: ApplicationLoadedHostReceipt, proof: ApplicationLoadedHostProof): void {
  if (proof.target === "zed") {
    const zedProof = proof.zedDevExtension!;
    receipt.zed = {
      extensionId: "dx-command-center",
      devExtensionLoaded: true,
      sourcePath: zedProof.sourcePath,
      installedPath: zedProof.installedPath,
      installedPathLinksToSource: true,
      extensionIndexPath: zedProof.extensionIndexPath,
      extensionIndexSha256: sha256(readFileSync(zedProof.extensionIndexPath)),
      extensionIndexContainsDevExtension: true,
      hostLogPath: zedProof.hostLogPath,
      hostLogSha256: sha256(readFileSync(zedProof.hostLogPath)),
      hostLogReferencesExtension: true,
      wasmArtifactPath: zedProof.wasmArtifactPath,
      wasmArtifactSha256: zedProof.wasmArtifactSha256,
      hostExecutableSha256: zedProof.hostExecutableSha256
    };
    return;
  }

  if (proof.target === "blender") {
    receipt.blender = {
      addonModule: "dx_blender_command_center",
      addonInstalled: true
    };
    return;
  }

  if (proof.target === "obsidian") {
    receipt.obsidian = {
      pluginId: "dx-command-center",
      testVaultLoaded: true
    };
    return;
  }

  if (proof.target === "canva") {
    receipt.canva = {
      developmentAppVerified: true,
      runtimePermissionsEmpty: true
    };
    return;
  }

  receipt.sketch = {
    pluginIdentifier: "dev.dx.sketch.command-center",
    pluginLoaded: true,
    sketchtoolVerified: proof.sketchtoolVerified === true
  };
}

function normalizeCommandResults(
  results: ApplicationLoadedHostCommandResult[]
): ApplicationLoadedHostCommandResult[] {
  return [...results]
    .map((result) => ({
      commandId: result.commandId,
      status: result.status
    }))
    .sort((left, right) => left.commandId.localeCompare(right.commandId));
}

function writeJsonReceipt(path: string, receipt: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`);
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function assertExistingAbsoluteFile(path: unknown, label: string): asserts path is string {
  if (typeof path !== "string" || !isAbsolute(path)) {
    throw new Error(`Application loaded-host proof ${label} must be an absolute path.`);
  }

  if (!existsSync(path)) {
    throw new Error(`Application loaded-host proof ${label} does not exist: ${path}`);
  }
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
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
