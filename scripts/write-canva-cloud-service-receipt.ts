import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  type CanvaCloudServiceProof,
  type CanvaCloudServiceRequest,
  type CanvaCloudServiceResponse,
  assertExistingCanvaCloudServiceFile,
  normalizeCanvaCloudServiceRequests,
  normalizeCanvaCloudServiceResponses,
  validateCanvaCloudServiceProof
} from "./lib/canva-cloud-service-proof.ts";
import { verifyPackageOutputReceipt } from "./lib/package-output-proof.ts";

export type { CanvaCloudServiceProof, CanvaCloudServiceRequest, CanvaCloudServiceResponse };

export interface CanvaCloudServiceReceiptOptions {
  generatedAt?: Date | string;
  verificationCommand?: string;
  proof: CanvaCloudServiceProof;
}

export interface CanvaCloudServiceReceipt {
  receipt: "dx.extension.canva.cloud_service";
  adapterId: "dx.canva.command-center";
  host: "canva";
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  loadedHostReceiptPath: string;
  loadedHostReceiptSha256: string;
  packageOutput: {
    receiptPath: string;
    receiptSha256: string;
    packageSha256: string;
  };
  service: {
    endpointHost: string;
    transport: "https";
    metadataOnly: true;
    storesDesignPayloads: false;
  };
  requests: CanvaCloudServiceRequest[];
  responses: CanvaCloudServiceResponse[];
  manualProof: {
    proofFilePath: string;
    proofFileSha256: string;
  };
  releaseClaims: {
    loadedHostVerified: true;
    developmentAppVerified: true;
    cloudServiceVerified: true;
    localServiceVerified: false;
    signingVerified: false;
    releaseChecksumVerified: false;
    canvaReviewVerified: false;
    distributionVerified: false;
  };
}

const adapterId = "dx.canva.command-center";
export function writeCanvaCloudServiceReceipt(
  root = process.cwd(),
  options: CanvaCloudServiceReceiptOptions
): CanvaCloudServiceReceipt {
  const workspaceRoot = resolve(root);
  const generatedAt = normalizeGeneratedAt(options.generatedAt);
  const verificationCommand = options.verificationCommand ?? "npm run smoke:canva-cloud-service:j1";
  const proof = validateCanvaCloudServiceProof(options.proof);
  const loadedHostReceiptBytes = readFileSync(proof.loadedHostReceiptPath);
  const loadedHostReceipt = JSON.parse(loadedHostReceiptBytes.toString("utf8"));
  const packageOutputReceiptPath = verifyLoadedHostReceipt(loadedHostReceipt);
  const packageOutputReceiptBytes = readFileSync(packageOutputReceiptPath);
  const packageOutputProof = verifyPackageOutputReceipt(
    adapterId,
    JSON.parse(packageOutputReceiptBytes.toString("utf8"))
  );
  const proofFileBytes = readFileSync(proof.proofFilePath);

  if (packageOutputProof.host !== "canva") {
    throw new Error("Canva package output host mismatch.");
  }

  const receiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    adapterId,
    "cloud-service-latest.json"
  );
  const receipt: CanvaCloudServiceReceipt = {
    receipt: "dx.extension.canva.cloud_service",
    adapterId,
    host: "canva",
    generatedAt,
    verificationCommand,
    receiptPath,
    loadedHostReceiptPath: proof.loadedHostReceiptPath,
    loadedHostReceiptSha256: sha256(loadedHostReceiptBytes),
    packageOutput: {
      receiptPath: packageOutputReceiptPath,
      receiptSha256: sha256(packageOutputReceiptBytes),
      packageSha256: packageOutputProof.sha256
    },
    service: {
      endpointHost: proof.serviceEndpointHost.trim(),
      transport: "https",
      metadataOnly: true,
      storesDesignPayloads: false
    },
    requests: normalizeCanvaCloudServiceRequests(proof.requests),
    responses: normalizeCanvaCloudServiceResponses(proof.responses),
    manualProof: {
      proofFilePath: proof.proofFilePath,
      proofFileSha256: sha256(proofFileBytes)
    },
    releaseClaims: {
      loadedHostVerified: true,
      developmentAppVerified: true,
      cloudServiceVerified: true,
      localServiceVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      canvaReviewVerified: false,
      distributionVerified: false
    }
  };

  writeReceipt(receiptPath, receipt);
  return receipt;
}

if (isDirectRun()) {
  try {
    const proofPath = process.env.DX_CANVA_CLOUD_SERVICE_PROOF_JSON;

    if (!proofPath) {
      throw new Error("DX_CANVA_CLOUD_SERVICE_PROOF_JSON must point to a Canva cloud-service proof JSON file.");
    }

    assertExistingCanvaCloudServiceFile(proofPath, "proof JSON");
    const proof = JSON.parse(readFileSync(proofPath, "utf8")) as CanvaCloudServiceProof;
    const receipt = writeCanvaCloudServiceReceipt(process.cwd(), {
      proof,
      verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run smoke:canva-cloud-service:j1"
    });

    console.log(`Canva cloud-service receipt written: ${receipt.receiptPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function verifyLoadedHostReceipt(receipt: Record<string, unknown>): string {
  if (
    !isRecord(receipt) ||
    receipt.receipt !== "dx.extension.application.loaded_host" ||
    receipt.adapterId !== adapterId ||
    receipt.host !== "canva"
  ) {
    throw new Error("Canva cloud-service proof must link to a Canva loaded-host receipt.");
  }

  const releaseClaims = readRecord(receipt.releaseClaims);
  const canva = readRecord(receipt.canva);

  if (
    releaseClaims?.loadedHostVerified !== true ||
    releaseClaims.developmentAppVerified !== true ||
    canva?.developmentAppVerified !== true ||
    canva.runtimePermissionsEmpty !== true
  ) {
    throw new Error("Canva cloud-service proof must link to a verified development-app receipt.");
  }

  const packageOutput = readRecord(receipt.packageOutput);

  if (!packageOutput || typeof packageOutput.receiptPath !== "string") {
    throw new Error("Canva loaded-host receipt is missing package output linkage.");
  }

  assertExistingCanvaCloudServiceFile(packageOutput.receiptPath, "package-output receipt");
  return packageOutput.receiptPath;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function writeReceipt(path: string, receipt: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
