import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertExistingAbsoluteFile,
  validateLocalServiceReceiptInputs
} from "./lib/local-service-receipt-validation.ts";
import type {
  LocalServiceProof,
  LocalServiceReceipt,
  LocalServiceReceiptOptions,
  LocalServiceRequest,
  LocalServiceResponse
} from "./lib/local-service-receipt-types.ts";
import { validateReleaseEvidenceGates } from "./validate-release-evidence-gates.ts";

export type {
  LocalServiceHostState,
  LocalServiceProof,
  LocalServiceReceipt,
  LocalServiceReceiptOptions,
  LocalServiceRequest,
  LocalServiceResponse,
  LocalServiceResponseStatus,
  LocalServiceTransport
} from "./lib/local-service-receipt-types.ts";

export function writeLocalServiceReceipt(
  root = process.cwd(),
  options: LocalServiceReceiptOptions
): LocalServiceReceipt {
  const workspaceRoot = resolve(root);
  const gateFailures = validateReleaseEvidenceGates(workspaceRoot);

  if (gateFailures.length > 0) {
    throw new Error(gateFailures.join("\n"));
  }

  const { proof, loadedHostReceiptBytes, proofFileBytes } = validateLocalServiceReceiptInputs(
    workspaceRoot,
    options.proof
  );
  const receiptPath = join(workspaceRoot, ...proof.receiptPath.split("/"));
  const receipt: LocalServiceReceipt = {
    receipt: "dx.extension.local_service",
    adapterId: proof.adapterId,
    host: proof.host,
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand: options.verificationCommand ?? "npm run smoke:local-service:j1",
    receiptPath,
    loadedHost: {
      receiptPath: proof.loadedHostReceiptPath,
      receiptSha256: sha256(loadedHostReceiptBytes)
    },
    localService: {
      protocol: "dx.local-service",
      schemaVersion: 1,
      endpoint: {
        host: proof.serviceEndpointHost,
        port: proof.serviceEndpointPort,
        transport: proof.serviceTransport
      },
      connected: true,
      hostState: proof.hostState,
      requests: normalizeRequests(proof.requests),
      responses: normalizeResponses(proof.requests, proof.responses),
      storesHostPayloads: false,
      mutatesHostDocument: false
    },
    manualProof: {
      proofFilePath: proof.proofFilePath,
      proofFileSha256: sha256(proofFileBytes)
    },
    releaseClaims: {
      loadedHostVerified: true,
      localServiceVerified: true,
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
  try {
    const proofPath = process.env.DX_LOCAL_SERVICE_PROOF_JSON;

    if (!proofPath) {
      throw new Error("DX_LOCAL_SERVICE_PROOF_JSON must point to a local-service proof JSON file.");
    }

    assertExistingAbsoluteFile(proofPath, "proof JSON");
    const proofSource = JSON.parse(readFileSync(proofPath, "utf8")) as LocalServiceProof | LocalServiceProof[];
    const proofs = Array.isArray(proofSource) ? proofSource : [proofSource];

    for (const proof of proofs) {
      const receipt = writeLocalServiceReceipt(process.cwd(), {
        proof,
        verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run smoke:local-service:j1"
      });

      console.log(`Local-service receipt written: ${receipt.receiptPath}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function normalizeRequests(requests: LocalServiceRequest[]): LocalServiceRequest[] {
  return [...requests]
    .map((request) => ({
      commandId: request.commandId.trim(),
      operation: request.operation.trim(),
      metadataOnly: true,
      transport: "local-service" as const,
      ...(request.query?.trim() ? { query: request.query.trim() } : {})
    }))
    .sort((left, right) => left.commandId.localeCompare(right.commandId));
}

function normalizeResponses(requests: LocalServiceRequest[], responses: LocalServiceResponse[]): LocalServiceResponse[] {
  const responsesByCommand = new Map(responses.map((response) => [response.commandId, response]));

  return normalizeRequests(requests).map((request) => {
    const response = responsesByCommand.get(request.commandId);

    if (!response) {
      throw new Error(`Local-service proof must include response metadata for ${request.commandId}.`);
    }

    return {
      commandId: request.commandId,
      status: response.status,
      payloadKind: "metadata-only"
    };
  });
}

function normalizeGeneratedAt(value: Date | string | undefined): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value ?? new Date().toISOString();
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
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
