import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyPackageOutputReceipt } from "./lib/package-output-proof.ts";
import {
  buildVsCodeLoadedHostReceipt,
  type ExtensionIdentity,
  type VsCodeLoadedHostReceipt,
  type VsCodePackageOutputLink
} from "./smoke-vscode-loaded-host-j1.ts";

export interface VsCodeLoadedHostProofReceiptOptions {
  generatedAt?: Date | string;
  proofPath: string;
  verificationCommand?: string;
}

export interface VsCodeLoadedHostProof {
  vscodeExecutablePath: string;
  vscodeVersion: string;
  extensionId: string;
  packageOutputReceiptPath: string;
  workspacePath: string;
  proofFilePath: string;
  extensionDevelopmentHostVerified: boolean;
  commandIds: string[];
  storesProcessOutput: false;
}

export interface VsCodeLoadedHostProofReceipt extends VsCodeLoadedHostReceipt {
  generatedAt: string;
  verificationCommand: string;
  host: {
    executablePath: string;
    version: string;
  };
  manualProof: {
    proofFilePath: string;
    proofFileSha256: string;
  };
}

const adapterId = "dx.vscode.command-center";
const receiptName = "vscode-loaded-host-latest.json";

export function writeVsCodeLoadedHostProofReceipt(
  root = process.cwd(),
  options: VsCodeLoadedHostProofReceiptOptions
): VsCodeLoadedHostProofReceipt {
  const workspaceRoot = resolve(root);
  const proof = validateProof(readProof(options.proofPath));
  const packageOutput = readPackageOutputLink(proof);
  const identity: ExtensionIdentity = {
    extensionId: proof.extensionId,
    commandIds: proof.commandIds
  };
  const receiptPath = join(workspaceRoot, ".dx", "receipts", "extensions", adapterId, receiptName);
  const receipt: VsCodeLoadedHostProofReceipt = {
    ...buildVsCodeLoadedHostReceipt({
      identity,
      packageOutput,
      workspacePath: proof.workspacePath
    }),
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand: options.verificationCommand ?? "npm run smoke:vscode-loaded-host:j1",
    host: {
      executablePath: proof.vscodeExecutablePath,
      version: proof.vscodeVersion
    },
    manualProof: {
      proofFilePath: proof.proofFilePath,
      proofFileSha256: sha256(readFileSync(proof.proofFilePath))
    }
  };

  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

  return receipt;
}

if (isDirectRun()) {
  try {
    const proofPath = process.env.DX_VSCODE_LOADED_HOST_PROOF_JSON;

    if (!proofPath) {
      throw new Error("DX_VSCODE_LOADED_HOST_PROOF_JSON must point to a VS Code loaded-host proof JSON file.");
    }

    const receipt = writeVsCodeLoadedHostProofReceipt(process.cwd(), {
      proofPath,
      verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run smoke:vscode-loaded-host:j1"
    });

    console.log(`VS Code loaded-host receipt written: ${receiptName} (${receipt.extension_id})`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function readProof(path: string): VsCodeLoadedHostProof {
  const proofPath = assertExistingAbsoluteFile(path, "proof JSON");
  const proof = JSON.parse(readFileSync(proofPath, "utf8")) as VsCodeLoadedHostProof;

  return proof;
}

function validateProof(proof: VsCodeLoadedHostProof): VsCodeLoadedHostProof {
  assertExistingAbsoluteFile(proof.vscodeExecutablePath, "VS Code executable");
  assertExistingAbsoluteFile(proof.proofFilePath, "manual proof file");
  assertExistingAbsoluteFile(proof.packageOutputReceiptPath, "package-output receipt");
  assertExistingAbsolutePath(proof.workspacePath, "temporary workspace path");
  assertNonEmptyString(proof.vscodeVersion, "VS Code version");
  assertNonEmptyString(proof.extensionId, "extension id");

  if (proof.extensionDevelopmentHostVerified !== true) {
    throw new Error("VS Code loaded-host proof must verify the Extension Development Host.");
  }

  if (proof.storesProcessOutput !== false) {
    throw new Error("VS Code loaded-host proof must not store process output.");
  }

  if (
    !Array.isArray(proof.commandIds) ||
    proof.commandIds.length === 0 ||
    !proof.commandIds.every((commandId) => typeof commandId === "string" && commandId.trim() !== "")
  ) {
    throw new Error("VS Code loaded-host proof must include visible command ids.");
  }

  if (new Set(proof.commandIds).size !== proof.commandIds.length) {
    throw new Error("VS Code loaded-host proof must not duplicate command ids.");
  }

  return proof;
}

function readPackageOutputLink(proof: VsCodeLoadedHostProof): VsCodePackageOutputLink {
  const receiptBytes = readFileSync(proof.packageOutputReceiptPath);
  const receipt = JSON.parse(receiptBytes.toString("utf8")) as Record<string, unknown>;
  const packageProof = verifyPackageOutputReceipt(adapterId, receipt);
  const packageManifest = isRecord(receipt.packageManifest) ? receipt.packageManifest : undefined;
  const vsix = isRecord(receipt.vsix) ? receipt.vsix : undefined;

  if (!packageManifest) {
    throw new Error("VS Code loaded-host package-output receipt is missing package manifest proof.");
  }

  if (!isNonEmptyString(packageManifest.publisher) || !isNonEmptyString(packageManifest.name)) {
    throw new Error("VS Code loaded-host package-output receipt is missing extension identity.");
  }

  if (`${packageManifest.publisher}.${packageManifest.name}` !== proof.extensionId) {
    throw new Error("VS Code loaded-host proof extension id does not match package-output receipt.");
  }

  if (packageManifest.commandCount !== proof.commandIds.length) {
    throw new Error("VS Code loaded-host proof command count does not match package-output receipt.");
  }

  if (!isSha256(vsix?.sha256)) {
    throw new Error("VS Code loaded-host package-output receipt is missing VSIX checksum proof.");
  }

  return {
    receiptPath: proof.packageOutputReceiptPath,
    receiptSha256: sha256(receiptBytes),
    packageSha256: packageProof.sha256,
    vsixSha256: vsix.sha256
  };
}

function assertExistingAbsoluteFile(path: string, label: string): string {
  assertAbsolutePath(path, label);

  if (!existsSync(path)) {
    throw new Error(`VS Code loaded-host ${label} does not exist: ${path}`);
  }

  return path;
}

function assertExistingAbsolutePath(path: string, label: string): string {
  assertAbsolutePath(path, label);

  if (!existsSync(path)) {
    throw new Error(`VS Code loaded-host ${label} does not exist: ${path}`);
  }

  return path;
}

function assertAbsolutePath(path: string, label: string): void {
  if (!isAbsolute(path)) {
    throw new Error(`VS Code loaded-host ${label} must be an absolute path.`);
  }
}

function assertNonEmptyString(value: string, label: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`VS Code loaded-host ${label} is required.`);
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function sha256(bytes: Buffer | string): string {
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
