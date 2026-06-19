import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { writeApplicationLoadedHostReceipt } from "../write-application-loaded-host-receipts.ts";
import { writeFigmaCanvaPackageOutputReceipt } from "../write-figma-canva-package-output-receipts.ts";
import { writeLocalServiceReceipt } from "../write-local-service-receipts.ts";
import { writeReleaseEvidenceGapReport } from "../write-release-evidence-gap-report.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-local-service-"));
const repoRoot = process.cwd();
const adapterId = "dx.canva.command-center";
const host = "canva";
const loadedHostReceiptPath = `.dx/receipts/extensions/${adapterId}/development-app-latest.json`;
const localServiceReceiptPath = `.dx/receipts/extensions/${adapterId}/local-service-latest.json`;
const packageOutputReceiptPath = `.dx/receipts/extensions/${adapterId}/package-output-latest.json`;

try {
  writeWorkspaceMetadata();
  const loadedHostReceipt = writeLoadedHostReceipt();
  const loadedHostReceiptSource = readFileSync(loadedHostReceipt.receiptPath, "utf8");
  const proofFilePath = writeWorkspaceFile(
    "proofs/canva-local-service.txt",
    "metadata-only Canva local-service request and response proof\n"
  );
  const proof = {
    adapterId,
    host,
    receiptPath: localServiceReceiptPath,
    loadedHostReceiptPath: loadedHostReceipt.receiptPath,
    proofFilePath,
    protocol: "dx.local-service" as const,
    schemaVersion: 1 as const,
    serviceEndpointHost: "127.0.0.1",
    serviceEndpointPort: 4719,
    serviceTransport: "loopback-http" as const,
    localServiceConnected: true,
    requests: [
      localServiceRequest("dx.canva.show_status", "dx.status"),
      localServiceRequest("dx.canva.search_assets", "dx.assets.search", "icons"),
      localServiceRequest("dx.canva.copy_receipts_path", "dx.receipts.copy")
    ],
    responses: [
      localServiceResponse("dx.canva.show_status"),
      localServiceResponse("dx.canva.search_assets"),
      localServiceResponse("dx.canva.copy_receipts_path")
    ],
    hostState: "loaded" as const,
    storesHostPayloads: false,
    mutatesHostDocument: false
  };
  const receipt = writeLocalServiceReceipt(workspaceRoot, {
    generatedAt: "2026-06-08T00:00:00.000Z",
    verificationCommand: "npm run smoke:local-service:j1",
    proof
  });
  const localServiceReceiptSource = readFileSync(receipt.receiptPath, "utf8");

  assert.equal(receipt.receipt, "dx.extension.local_service");
  assert.equal(receipt.adapterId, adapterId);
  assert.equal(receipt.host, host);
  assert.equal(receipt.generatedAt, "2026-06-08T00:00:00.000Z");
  assert.equal(receipt.verificationCommand, "npm run smoke:local-service:j1");
  assert.equal(receipt.receiptPath, join(workspaceRoot, ...localServiceReceiptPath.split("/")));
  assert.deepEqual(receipt.loadedHost, {
    receiptPath: loadedHostReceipt.receiptPath,
    receiptSha256: sha256(readFileSync(loadedHostReceipt.receiptPath))
  });
  assert.deepEqual(receipt.localService.endpoint, {
    host: "127.0.0.1",
    port: 4719,
    transport: "loopback-http"
  });
  assert.equal(receipt.localService.connected, true);
  assert.equal(receipt.localService.protocol, "dx.local-service");
  assert.equal(receipt.localService.schemaVersion, 1);
  assert.equal(receipt.localService.requests.every((request) => request.metadataOnly === true), true);
  assert.equal(receipt.localService.responses.every((response) => response.payloadKind === "metadata-only"), true);
  assert.equal(receipt.localService.storesHostPayloads, false);
  assert.equal(receipt.localService.mutatesHostDocument, false);
  assert.deepEqual(receipt.manualProof, {
    proofFilePath,
    proofFileSha256: sha256(readFileSync(proofFilePath))
  });
  assert.deepEqual(receipt.releaseClaims, {
    loadedHostVerified: true,
    localServiceVerified: true,
    signingVerified: false,
    releaseChecksumVerified: false,
    distributionVerified: false
  });
  assert.equal(existsSync(receipt.receiptPath), true);
  assert.deepEqual(JSON.parse(readFileSync(receipt.receiptPath, "utf8")), receipt);
  assert.equal(localServiceRequirement().releaseValid, true);

  const wrongOperationReceipt = JSON.parse(localServiceReceiptSource);
  wrongOperationReceipt.localService.requests[0].operation = "dx.assets.search";
  writeFileSync(receipt.receiptPath, `${JSON.stringify(wrongOperationReceipt, null, 2)}\n`);
  const wrongOperationRequirement = localServiceRequirement();

  assert.equal(wrongOperationRequirement.releaseValid, false);
  assert.match(
    wrongOperationRequirement.weakness ?? "",
    /local-service receipt has an invalid command operation/
  );
  writeFileSync(receipt.receiptPath, localServiceReceiptSource);

  const proofBlockedReceipt = JSON.parse(localServiceReceiptSource);
  proofBlockedReceipt.localService.responses = proofBlockedReceipt.localService.responses.map(
    (response: { commandId: string; payloadKind: string }) => ({
      ...response,
      status: "proof-blocked"
    })
  );
  writeFileSync(receipt.receiptPath, `${JSON.stringify(proofBlockedReceipt, null, 2)}\n`);
  const proofBlockedRequirement = localServiceRequirement();

  assert.equal(proofBlockedRequirement.releaseValid, false);
  assert.match(
    proofBlockedRequirement.weakness ?? "",
    /local-service receipt is missing successful response proof/
  );
  writeFileSync(receipt.receiptPath, localServiceReceiptSource);

  assert.throws(
    () =>
      writeLocalServiceReceipt(workspaceRoot, {
        proof: {
          ...proof,
          responses: proof.responses.map((response) => ({
            ...response,
            status: "proof-blocked" as const
          }))
        }
      }),
    /responses must prove successful local-service execution/
  );

  const fakeLoadedHostSource = `${JSON.stringify(
    {
      receipt: "dx.extension.application.loaded_host",
      adapterId,
      host,
      releaseClaims: {
        loadedHostVerified: true,
        localServiceVerified: false
      }
    },
    null,
    2
  )}\n`;
  writeFileSync(loadedHostReceipt.receiptPath, fakeLoadedHostSource);
  writeFileSync(
    receipt.receiptPath,
    `${JSON.stringify(
      {
        ...receipt,
        loadedHost: {
          receiptPath: loadedHostReceipt.receiptPath,
          receiptSha256: sha256(Buffer.from(fakeLoadedHostSource))
        }
      },
      null,
      2
    )}\n`
  );
  const fakeLoadedHostRequirement = localServiceRequirement();

  assert.equal(fakeLoadedHostRequirement.releaseValid, false);
  assert.match(
    fakeLoadedHostRequirement.weakness ?? "",
    /local-service loaded-host receipt is weak/
  );
  assert.throws(
    () =>
      writeLocalServiceReceipt(workspaceRoot, {
        proof
      }),
    /requires release-valid loaded-host evidence/
  );

  writeFileSync(loadedHostReceipt.receiptPath, loadedHostReceiptSource);
  writeFileSync(receipt.receiptPath, localServiceReceiptSource);
  writeFileSync(loadedHostReceipt.receiptPath, "{}\n");
  const staleLoadedHostRequirement = localServiceRequirement();

  assert.equal(staleLoadedHostRequirement.releaseValid, false);
  assert.match(
    staleLoadedHostRequirement.weakness ?? "",
    /local-service loaded-host receipt hash changed/
  );

  writeFileSync(loadedHostReceipt.receiptPath, loadedHostReceiptSource);
  writeFileSync(proofFilePath, "metadata-only local-service proof changed after capture\n");
  const staleManualProofRequirement = localServiceRequirement();

  assert.equal(staleManualProofRequirement.releaseValid, false);
  assert.match(
    staleManualProofRequirement.weakness ?? "",
    /local-service manual proof file hash changed/
  );

  writeFileSync(proofFilePath, "metadata-only Canva local-service request and response proof\n");

  assert.throws(
    () =>
      writeLocalServiceReceipt(workspaceRoot, {
        proof: {
          ...proof,
          receiptPath: `.dx/receipts/extensions/${adapterId}/unmapped-local-service.json`
        }
      }),
    /must match the release evidence local-service receipt/
  );

  assert.throws(
    () =>
      writeLocalServiceReceipt(workspaceRoot, {
        proof: {
          ...proof,
          requests: [
            {
              ...proof.requests[0],
              metadataOnly: false
            }
          ]
        }
      }),
    /requests must be metadata-only/
  );

  assert.throws(
    () =>
      writeLocalServiceReceipt(workspaceRoot, {
        proof: {
          ...proof,
          requests: [proof.requests[0]],
          responses: [proof.responses[0]]
        }
      }),
    /must include request metadata for dx.canva.search_assets/
  );

  assert.throws(
    () =>
      writeLocalServiceReceipt(workspaceRoot, {
        proof: {
          ...proof,
          requests: [...proof.requests, localServiceRequest("dx.canva.delete_assets", "dx.assets.delete")],
          responses: [...proof.responses, localServiceResponse("dx.canva.delete_assets")]
        }
      }),
    /includes unsupported local-service command/
  );

  assert.throws(
    () =>
      writeLocalServiceReceipt(workspaceRoot, {
        proof: {
          ...proof,
          serviceEndpointHost: "example.com"
        }
      }),
    /endpoint host must be loopback/
  );

  assert.throws(
    () =>
      writeLocalServiceReceipt(workspaceRoot, {
        proof: {
          ...proof,
          token: "do-not-store"
        }
      }),
    /privacy-sensitive local-service proof field/
  );

  assert.throws(
    () =>
      writeLocalServiceReceipt(workspaceRoot, {
        proof: {
          ...proof,
          proofFilePath: writeWorkspaceFile("proofs/empty-local-service.txt", "")
        }
      }),
    /proof file must not be empty/
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("Local-service receipt verified");

function writeWorkspaceMetadata(): void {
  writeWorkspaceFile(
    "registry/official-extensions.toml",
    `
schema = "dx.extensions.registry"
manifest_version = 1

[[extensions]]
id = "${adapterId}"
name = "DX Canva Command Center"
path = "hosts/canva/dx-canva"
manifest = "hosts/canva/dx-canva/dx.extension.toml"
status = "experimental"
professional_targets = ["canva"]
`
  );
  writeWorkspaceFile(
    "hosts/canva/dx-canva/dx.extension.toml",
    `
[extension]
id = "${adapterId}"

[[capabilities]]
id = "local_service.connect"

[[host_actions]]
id = "dx.canva.show_status"
operation = "dx.status"
transport = "local-service"
required_capabilities = ["local_service.connect"]

[[host_actions]]
id = "dx.canva.search_assets"
operation = "dx.assets.search"
transport = "local-service"
required_capabilities = ["local_service.connect"]

[[host_actions]]
id = "dx.canva.copy_receipts_path"
operation = "dx.receipts.copy"
transport = "local-service"
required_capabilities = ["local_service.connect"]
`
  );
  writeWorkspaceFile(
    "registry/release-evidence-gates.toml",
    `
schema = "dx.release_evidence_gates"
manifest_version = 1

[[extensions]]
id = "${adapterId}"
stage = "not-release-ready"
required_evidence = ["host_execution", "package_output", "signing", "checksum", "distribution_review", "local_service"]
evidence_receipt_requirements = ["host_execution=${loadedHostReceiptPath}", "package_output=${packageOutputReceiptPath}", "signing=.dx/receipts/extensions/${adapterId}/signing-latest.json", "checksum=.dx/receipts/extensions/${adapterId}/checksum-latest.json", "distribution_review=.dx/receipts/extensions/${adapterId}/distribution-latest.json", "local_service=${localServiceReceiptPath}"]
evidence_receipts = ["${loadedHostReceiptPath}", "${packageOutputReceiptPath}", ".dx/receipts/extensions/${adapterId}/signing-latest.json", ".dx/receipts/extensions/${adapterId}/checksum-latest.json", ".dx/receipts/extensions/${adapterId}/distribution-latest.json", "${localServiceReceiptPath}"]
next_release_proof = "connect local service"
blocked_by = ["loaded host", "local service"]
`
  );
}

function writeLoadedHostReceipt() {
  const packageOutput = writeFigmaCanvaPackageOutputReceipt({
    adapterId,
    host,
    adapterRoot: join(repoRoot, "hosts", "canva", "dx-canva"),
    packageRoot: join(repoRoot, "hosts", "canva", "dx-canva"),
    receiptPath: join(workspaceRoot, ...packageOutputReceiptPath.split("/")),
    generatedAt: "2026-06-08T00:00:00.000Z",
    verificationCommand: "npm run build:canva:j1"
  });
  const hostExecutablePath = writeWorkspaceFile("host/Canva.exe", "Canva executable fixture\n");
  const proofFilePath = writeWorkspaceFile(
    "proofs/canva-loaded-host.txt",
    "Canva development app command center proof\n"
  );
  const commandIds = ["showStatus", "searchAssets", "copyReceiptsPath"];

  return writeApplicationLoadedHostReceipt(workspaceRoot, {
    generatedAt: "2026-06-08T00:00:00.000Z",
    verificationCommand: "npm run smoke:application-loaded-host:j1",
    proof: {
      target: "canva",
      hostApplication: "Canva",
      hostVersion: "2026.1.0",
      hostExecutablePath,
      packageOutputReceiptPath: packageOutput.receiptPath,
      proofFilePath,
      verificationMode: "canva-development-app",
      loadedHostVerified: true,
      extensionInstalled: true,
      commandIdsVisible: commandIds,
      commandResults: commandIds.map((commandId) => ({
        commandId,
        status: "visible" as const
      })),
      localServiceRequestsBlocked: true,
      hostState: "loaded",
      mutatesHostDocument: false,
      developmentAppVerified: true,
      runtimePermissionsEmpty: true
    }
  });
}

function localServiceRequirement() {
  const report = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-08T00:00:00.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });
  const extension = report.extensions.find((entry) => entry.id === adapterId);
  assert.ok(extension, "local-service fixture must be present in gap report.");
  const requirement = extension.evidenceRequirements.find((entry) => entry.kind === "local_service");
  assert.ok(requirement, "local-service fixture must include local_service requirement.");

  return requirement;
}

function localServiceRequest(commandId: string, operation: string, query?: string) {
  return {
    commandId,
    operation,
    metadataOnly: true,
    transport: "local-service" as const,
    query
  };
}

function localServiceResponse(commandId: string) {
  return {
    commandId,
    status: "ok" as const,
    payloadKind: "metadata-only" as const
  };
}

function writeWorkspaceFile(relativePath: string, source: string): string {
  const absolutePath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);

  return absolutePath;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
