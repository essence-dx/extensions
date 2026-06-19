import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type {
  ApplicationLoadedHostProof,
  ApplicationLoadedHostReceipt,
  BlenderAddonInstallReceipt,
  SketchtoolRunReceipt
} from "./application-loaded-host-model.ts";

interface SupplementalReceiptOptions {
  generatedAt: string;
  manualProof: ApplicationLoadedHostReceipt["manualProof"];
  packageOutput: ApplicationLoadedHostReceipt["packageOutput"];
  proof: ApplicationLoadedHostProof;
  receipt: ApplicationLoadedHostReceipt;
  verificationCommand: string;
}

export function writeApplicationLoadedHostSupplementalReceipts(
  root: string,
  options: SupplementalReceiptOptions
): void {
  if (options.proof.target === "blender") {
    writeBlenderAddonInstallReceipt(root, options);
  }

  if (options.proof.target === "sketch" && options.proof.sketchtoolVerified === true) {
    writeSketchtoolRunReceipt(root, {
      ...options,
      sketchtoolPath: options.proof.sketchtoolPath
    });
  }
}

function writeBlenderAddonInstallReceipt(
  root: string,
  options: SupplementalReceiptOptions
): BlenderAddonInstallReceipt {
  const receiptPath = join(
    root,
    ".dx",
    "receipts",
    "extensions",
    "dx.blender.command-center",
    "addon-install-latest.json"
  );
  const loadedHostBytes = readFileSync(options.receipt.receiptPath);
  const receipt: BlenderAddonInstallReceipt = {
    receipt: "dx.extension.blender.addon_install",
    adapterId: "dx.blender.command-center",
    host: "blender",
    generatedAt: options.generatedAt,
    verificationCommand: options.verificationCommand,
    receiptPath,
    loadedHostReceiptPath: options.receipt.receiptPath,
    loadedHostReceiptSha256: sha256(loadedHostBytes),
    packageOutput: options.packageOutput,
    addon: {
      module: "dx_blender_command_center",
      installed: true
    },
    manualProof: options.manualProof,
    releaseClaims: {
      loadedHostVerified: true,
      addonInstallVerified: true,
      signingVerified: false,
      releaseChecksumVerified: false,
      distributionVerified: false
    }
  };

  writeJsonReceipt(receiptPath, receipt);
  return receipt;
}

function writeSketchtoolRunReceipt(
  root: string,
  options: SupplementalReceiptOptions & { sketchtoolPath?: string }
): SketchtoolRunReceipt {
  const sketchtoolPath = options.sketchtoolPath;

  if (!sketchtoolPath) {
    throw new Error("Sketch sketchtool receipt requires a sketchtool executable path.");
  }

  const receiptPath = join(
    root,
    ".dx",
    "receipts",
    "extensions",
    "dx.sketch.command-center",
    "sketchtool-latest.json"
  );
  const loadedHostBytes = readFileSync(options.receipt.receiptPath);
  const sketchtoolBytes = readFileSync(sketchtoolPath);
  const receipt: SketchtoolRunReceipt = {
    receipt: "dx.extension.sketch.sketchtool_run",
    adapterId: "dx.sketch.command-center",
    host: "sketch",
    generatedAt: options.generatedAt,
    verificationCommand: options.verificationCommand,
    receiptPath,
    loadedHostReceiptPath: options.receipt.receiptPath,
    loadedHostReceiptSha256: sha256(loadedHostBytes),
    packageOutput: options.packageOutput,
    sketchtool: {
      path: sketchtoolPath,
      sha256: sha256(sketchtoolBytes),
      commandIdsVerified: options.receipt.loadedHost.commandIdsVisible
    },
    manualProof: options.manualProof,
    releaseClaims: {
      loadedHostVerified: true,
      sketchtoolVerified: true,
      signingVerified: false,
      releaseChecksumVerified: false,
      notarizationVerified: false,
      distributionVerified: false
    }
  };

  writeJsonReceipt(receiptPath, receipt);
  return receipt;
}

function writeJsonReceipt(path: string, receipt: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`);
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
