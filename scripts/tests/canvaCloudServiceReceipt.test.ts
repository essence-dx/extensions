import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { classifySpecialProofWeakness } from "../lib/release-evidence-special-proof-classifier.ts";
import { writeApplicationLoadedHostReceipt } from "../write-application-loaded-host-receipts.ts";
import { writeCanvaCloudServiceReceipt } from "../write-canva-cloud-service-receipt.ts";
import { writeFigmaCanvaPackageOutputReceipt } from "../write-figma-canva-package-output-receipts.ts";

const repoRoot = process.cwd();
const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-canva-cloud-service-"));
const commandIds = ["showStatus", "searchAssets", "copyReceiptsPath"] as const;

try {
  const packageOutputReceiptPath = writePackageOutputReceipt();
  const loadedHostProofFilePath = writeWorkspaceFile("proof/canva-development-app.txt", "Canva development app proof\n");
  const loadedHostReceipt = writeApplicationLoadedHostReceipt(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run smoke:application-loaded-host:j1",
    proof: {
      target: "canva",
      hostApplication: "Canva",
      hostVersion: "2026.1.0",
      hostExecutablePath: writeWorkspaceFile("tools/canva-development-app.txt", "Canva development app\n"),
      packageOutputReceiptPath,
      proofFilePath: loadedHostProofFilePath,
      verificationMode: "canva-development-app",
      loadedHostVerified: true,
      extensionInstalled: true,
      commandIdsVisible: [...commandIds],
      commandResults: commandIds.map((commandId) => ({
        commandId,
        status: commandId === "showStatus" ? "visible" : "proof-blocked"
      })),
      localServiceRequestsBlocked: true,
      hostState: "loaded",
      mutatesHostDocument: false,
      developmentAppVerified: true,
      runtimePermissionsEmpty: true
    }
  });
  const cloudProofFilePath = writeWorkspaceFile(
    "proof/canva-cloud-service.txt",
    "Canva metadata-only cloud service proof.\n"
  );
  const receipt = writeCanvaCloudServiceReceipt(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run smoke:canva-cloud-service:j1",
    proof: {
      loadedHostReceiptPath: loadedHostReceipt.receiptPath,
      proofFilePath: cloudProofFilePath,
      cloudServiceVerified: true,
      serviceEndpointHost: "dx-canva-cloud-service.local",
      serviceTransport: "https",
      requests: commandIds.map((commandId) => ({
        commandId,
        operation: operationForCommand(commandId),
        metadataOnly: true,
        transport: "cloud-service"
      })),
      responses: commandIds.map((commandId) => ({
        commandId,
        status: "ok",
        payloadKind: "metadata-only-card"
      })),
      storesDesignPayloads: false
    }
  });

  assert.equal(receipt.receipt, "dx.extension.canva.cloud_service");
  assert.equal(receipt.adapterId, "dx.canva.command-center");
  assert.equal(receipt.host, "canva");
  assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
  assert.equal(receipt.verificationCommand, "npm run smoke:canva-cloud-service:j1");
  assert.equal(
    receipt.receiptPath,
    join(workspaceRoot, ".dx", "receipts", "extensions", "dx.canva.command-center", "cloud-service-latest.json")
  );
  assert.equal(receipt.loadedHostReceiptPath, loadedHostReceipt.receiptPath);
  assert.equal(receipt.loadedHostReceiptSha256, sha256(readFileSync(loadedHostReceipt.receiptPath)));
  assert.equal(receipt.packageOutput.receiptPath, packageOutputReceiptPath);
  assert.equal(receipt.service.transport, "https");
  assert.equal(receipt.service.metadataOnly, true);
  assert.equal(receipt.service.storesDesignPayloads, false);
  assert.deepEqual(
    receipt.requests.map((request) => request.commandId),
    [...commandIds].sort()
  );
  assert.equal(receipt.manualProof.proofFilePath, cloudProofFilePath);
  assert.equal(receipt.manualProof.proofFileSha256, sha256(readFileSync(cloudProofFilePath)));
  assert.equal(receipt.releaseClaims.loadedHostVerified, true);
  assert.equal(receipt.releaseClaims.developmentAppVerified, true);
  assert.equal(receipt.releaseClaims.cloudServiceVerified, true);
  assert.equal(receipt.releaseClaims.canvaReviewVerified, false);
  assert.equal(existsSync(receipt.receiptPath), true);
  assert.deepEqual(JSON.parse(readFileSync(receipt.receiptPath, "utf8")), receipt);
  assert.equal(classifySpecialProofWeakness("cloud_service", receipt), undefined);

  assert.match(
    classifySpecialProofWeakness("cloud_service", {
      ...receipt,
      responses: receipt.responses.slice(0, 1)
    }) ?? "",
    /Canva cloud-service response command set does not match request command set/
  );

  assert.match(
    classifySpecialProofWeakness("cloud_service", {
      ...receipt,
      responses: receipt.responses.map((response) =>
        response.commandId === "copyReceiptsPath" ? { ...response, status: "proof-blocked" } : response
      )
    }) ?? "",
    /Canva cloud-service responses must prove successful cloud-service execution/
  );

  writeFileSync(cloudProofFilePath, "Canva cloud-service proof changed after capture.\n");
  assert.match(
    classifySpecialProofWeakness("cloud_service", receipt) ?? "",
    /Canva cloud-service manual proof file hash changed/
  );

  writeFileSync(cloudProofFilePath, "Canva metadata-only cloud service proof.\n");
  const packageOutputReceiptSource = readFileSync(packageOutputReceiptPath, "utf8");
  writeFileSync(packageOutputReceiptPath, "{}\n");
  assert.match(
    classifySpecialProofWeakness("cloud_service", receipt) ?? "",
    /Canva cloud-service linked package-output receipt hash changed/
  );

  writeFileSync(packageOutputReceiptPath, packageOutputReceiptSource);
  writeFileSync(loadedHostProofFilePath, "Canva loaded-host proof changed after cloud-service capture.\n");
  assert.match(
    classifySpecialProofWeakness("cloud_service", receipt) ?? "",
    /Canva cloud-service linked loaded-host receipt is weak: application loaded-host manual proof file hash changed/
  );

  writeFileSync(loadedHostProofFilePath, "Canva development app proof\n");
  const loadedHostReceiptSource = readFileSync(loadedHostReceipt.receiptPath, "utf8");
  writeFileSync(loadedHostReceipt.receiptPath, "{}\n");
  assert.match(
    classifySpecialProofWeakness("cloud_service", receipt) ?? "",
    /Canva cloud-service loaded-host receipt hash changed/
  );

  writeFileSync(loadedHostReceipt.receiptPath, loadedHostReceiptSource);
  const fixture = canvaCloudServiceFixture(loadedHostReceipt.receiptPath, cloudProofFilePath);

  assert.throws(
    () =>
      writeCanvaCloudServiceReceipt(workspaceRoot, {
        proof: {
          ...fixture,
          cloudServiceVerified: false
        }
      }),
    /must verify a metadata-only Canva cloud service/
  );

  assert.throws(
    () =>
      writeCanvaCloudServiceReceipt(workspaceRoot, {
        proof: {
          ...fixture,
          designName: "Customer Launch"
        }
      }),
    /privacy-sensitive Canva cloud-service proof field/
  );

  assert.throws(
    () =>
      writeCanvaCloudServiceReceipt(workspaceRoot, {
        proof: {
          ...fixture,
          requests: fixture.requests.slice(0, 1)
        }
      }),
    /must include cloud-service request metadata/
  );

  assert.throws(
    () =>
      writeCanvaCloudServiceReceipt(workspaceRoot, {
        proof: {
          ...fixture,
          responses: fixture.responses.map((response) =>
            response.commandId === "copyReceiptsPath" ? { ...response, status: "proof-blocked" as const } : response
          )
        }
      }),
    /responses must prove successful cloud-service execution/
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("Canva cloud-service receipt verified");

function canvaCloudServiceFixture(loadedHostReceiptPath: string, proofFilePath: string) {
  return {
    loadedHostReceiptPath,
    proofFilePath,
    cloudServiceVerified: true,
    serviceEndpointHost: "dx-canva-cloud-service.local",
    serviceTransport: "https",
    requests: commandIds.map((commandId) => ({
      commandId,
      operation: operationForCommand(commandId),
      metadataOnly: true,
      transport: "cloud-service"
    })),
    responses: commandIds.map((commandId) => ({
      commandId,
      status: "ok",
      payloadKind: "metadata-only-card"
    })),
    storesDesignPayloads: false
  };
}

function writePackageOutputReceipt(): string {
  const receiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    "dx.canva.command-center",
    "package-output-latest.json"
  );

  writeFigmaCanvaPackageOutputReceipt({
    adapterId: "dx.canva.command-center",
    host: "canva",
    adapterRoot: join(repoRoot, "hosts", "canva", "dx-canva"),
    packageRoot: join(repoRoot, "hosts", "canva", "dx-canva"),
    receiptPath,
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run build:canva:j1"
  });

  return receiptPath;
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

function operationForCommand(commandId: (typeof commandIds)[number]): string {
  if (commandId === "searchAssets") {
    return "dx.assets.search";
  }

  if (commandId === "copyReceiptsPath") {
    return "receipt.showPath";
  }

  return "dx.status";
}
