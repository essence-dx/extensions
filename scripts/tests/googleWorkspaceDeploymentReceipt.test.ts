import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { buildGoogleWorkspaceAppsScriptOutput } from "../build-google-workspace-apps-script-output.ts";
import { classifySpecialProofWeakness } from "../lib/release-evidence-special-proof-classifier.ts";
import {
  classifyGoogleWorkspaceFileSmokeWeakness
} from "../lib/release-evidence-productivity-host-classifier.ts";
import { writeGoogleWorkspaceDeploymentReceipts } from "../write-google-workspace-deployment-receipts.ts";
import { writeGoogleWorkspaceAppsScriptPackageOutputReceipt } from "../write-google-workspace-apps-script-package-output-receipt.ts";

const repoRoot = process.cwd();
const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-google-workspace-deployment-"));
const adapterRoot = join(repoRoot, "hosts", "google-workspace", "dx-google-workspace-addon");
const commandIds = [
  "dx.google-workspace.show_status",
  "dx.google-workspace.search_assets",
  "dx.google-workspace.show_receipts"
] as const;

try {
  const packageOutputReceiptPath = writePackageOutputReceipt();
  const proofFilePath = writeWorkspaceFile(
    "proof/google-workspace-deployment.txt",
    "Google Workspace metadata-only test deployment proof.\n"
  );
  const receipts = writeGoogleWorkspaceDeploymentReceipts(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run smoke:google-workspace-deployment:j1",
    proof: {
      packageOutputReceiptPath,
      proofFilePath,
      appsScriptDeploymentVerified: true,
      deploymentMode: "test-deployment",
      deploymentIdSha256: sha256(Buffer.from("deployment-id")),
      appsScriptProjectIdSha256: sha256(Buffer.from("script-project-id")),
      deploymentVersion: "head",
      oauthScopes: [],
      cloudServiceVerified: true,
      serviceEndpointHost: "dx-cloud-service.local",
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
      workspaceFileSmokeVerified: true,
      workspaceFileType: "docs",
      workspaceFileState: "test-file",
      cardsRendered: true,
      commandIdsVisible: [...commandIds],
      mutatesWorkspaceFile: false,
      storesWorkspacePayloads: false
    }
  });

  assert.equal(receipts.deployment.receipt, "dx.extension.google_workspace.apps_script_deployment");
  assert.equal(receipts.deployment.adapterId, "dx.google-workspace.command-center");
  assert.equal(receipts.deployment.generatedAt, "2026-06-07T00:00:00.000Z");
  assert.equal(receipts.deployment.packageOutput.receiptPath, packageOutputReceiptPath);
  assert.equal(receipts.deployment.packageOutput.receiptSha256, sha256(readFileSync(packageOutputReceiptPath)));
  assert.equal(receipts.deployment.manualProof.proofFilePath, proofFilePath);
  assert.equal(receipts.deployment.releaseClaims.appsScriptDeploymentVerified, true);
  assert.equal(receipts.deployment.releaseClaims.oauthReviewVerified, false);
  assert.equal(receipts.deployment.releaseClaims.marketplaceApproved, false);
  assert.equal(existsSync(receipts.deployment.receiptPath), true);

  assert.equal(receipts.cloudService.receipt, "dx.extension.google_workspace.cloud_service");
  assert.equal(receipts.cloudService.deploymentReceiptPath, receipts.deployment.receiptPath);
  assert.equal(receipts.cloudService.deploymentReceiptSha256, sha256(readFileSync(receipts.deployment.receiptPath)));
  assert.deepEqual(
    receipts.cloudService.requests.map((request) => request.commandId),
    [...commandIds].sort()
  );
  assert.equal(receipts.cloudService.releaseClaims.cloudServiceVerified, true);
  assert.equal(receipts.cloudService.releaseClaims.signingVerified, false);
  assert.equal(existsSync(receipts.cloudService.receiptPath), true);

  assert.equal(receipts.workspaceFileSmoke.receipt, "dx.extension.google_workspace.workspace_file_smoke");
  assert.equal(receipts.workspaceFileSmoke.cloudServiceReceiptPath, receipts.cloudService.receiptPath);
  assert.equal(receipts.workspaceFileSmoke.workspaceFile.fileType, "docs");
  assert.equal(receipts.workspaceFileSmoke.workspaceFile.fileState, "test-file");
  assert.equal(receipts.workspaceFileSmoke.workspaceFile.mutatesWorkspaceFile, false);
  assert.equal(receipts.workspaceFileSmoke.workspaceFile.storesWorkspacePayloads, false);
  assert.equal(receipts.workspaceFileSmoke.releaseClaims.workspaceFileSmokeVerified, true);
  assert.equal(receipts.workspaceFileSmoke.releaseClaims.distributionVerified, false);
  assert.equal(existsSync(receipts.workspaceFileSmoke.receiptPath), true);

  assert.deepEqual(JSON.parse(readFileSync(receipts.deployment.receiptPath, "utf8")), receipts.deployment);
  assert.deepEqual(JSON.parse(readFileSync(receipts.cloudService.receiptPath, "utf8")), receipts.cloudService);
  assert.deepEqual(JSON.parse(readFileSync(receipts.workspaceFileSmoke.receiptPath, "utf8")), receipts.workspaceFileSmoke);
  assert.equal(classifySpecialProofWeakness("apps_script_deployment", receipts.deployment), undefined);
  assert.equal(classifySpecialProofWeakness("cloud_service", receipts.cloudService), undefined);
  assert.equal(classifyGoogleWorkspaceFileSmokeWeakness(receipts.workspaceFileSmoke), undefined);

  assert.match(
    classifySpecialProofWeakness("apps_script_deployment", {
      ...receipts.deployment,
      deployment: {
        ...(receipts.deployment.deployment as Record<string, unknown>),
        deploymentMode: "head"
      }
    }) ?? "",
    /Google Workspace deployment receipt must use a test deployment/
  );

  assert.match(
    classifySpecialProofWeakness("cloud_service", {
      ...receipts.cloudService,
      responses: (receipts.cloudService.responses as unknown[]).slice(0, 1)
    }) ?? "",
    /Google Workspace cloud-service response command set does not match request command set/
  );

  assert.match(
    classifySpecialProofWeakness("cloud_service", {
      ...receipts.cloudService,
      responses: (receipts.cloudService.responses as Array<{ commandId: string; status: string }>).map((response) =>
        response.commandId === "dx.google-workspace.show_receipts"
          ? { ...response, status: "proof-blocked" }
          : response
      )
    }) ?? "",
    /Google Workspace cloud-service responses must prove successful cloud-service execution/
  );

  assert.match(
    classifySpecialProofWeakness("cloud_service", {
      ...receipts.cloudService,
      requests: (receipts.cloudService.requests as Array<{ commandId: string }>).filter(
        (request) => request.commandId !== "dx.google-workspace.show_receipts"
      ),
      responses: (receipts.cloudService.responses as Array<{ commandId: string }>).filter(
        (response) => response.commandId !== "dx.google-workspace.show_receipts"
      )
    }) ?? "",
    /Google Workspace cloud-service receipt is missing required command metadata/
  );

  assert.match(
    classifySpecialProofWeakness("cloud_service", {
      ...receipts.cloudService,
      requests: (receipts.cloudService.requests as Array<{ commandId: string; operation: string }>).map(
        (request) =>
          request.commandId === "dx.google-workspace.show_receipts"
            ? { ...request, operation: "dx.assets.search" }
            : request
      )
    }) ?? "",
    /Google Workspace cloud-service receipt has an invalid command operation/
  );

  assert.match(
    classifyGoogleWorkspaceFileSmokeWeakness({
      ...receipts.workspaceFileSmoke,
      workspaceFile: {
        ...(receipts.workspaceFileSmoke.workspaceFile as Record<string, unknown>),
        commandIdsVisible: ["dx.google-workspace.show_status", "dx.google-workspace.search_assets"]
      }
    }) ?? "",
    /Google Workspace smoke receipt is missing required workspace command proof/
  );

  assert.match(
    classifyGoogleWorkspaceFileSmokeWeakness({
      ...receipts.workspaceFileSmoke,
      workspaceFile: {
        ...(receipts.workspaceFileSmoke.workspaceFile as Record<string, unknown>),
        fileState: "empty"
      }
    }) ?? "",
    /Google Workspace smoke receipt must use a real test Workspace file/
  );

  writeFileSync(proofFilePath, "Google Workspace deployment proof changed after capture.\n");
  assert.match(
    classifySpecialProofWeakness("apps_script_deployment", receipts.deployment) ?? "",
    /Google Workspace deployment manual proof file hash changed/
  );

  writeFileSync(proofFilePath, "Google Workspace metadata-only test deployment proof.\n");
  const packageOutputReceiptSource = readFileSync(packageOutputReceiptPath, "utf8");
  writeFileSync(packageOutputReceiptPath, "{}\n");
  assert.match(
    classifySpecialProofWeakness("apps_script_deployment", receipts.deployment) ?? "",
    /Google Workspace deployment linked package-output receipt hash changed/
  );

  writeFileSync(packageOutputReceiptPath, packageOutputReceiptSource);
  const deploymentReceiptSource = readFileSync(receipts.deployment.receiptPath, "utf8");
  writeFileSync(receipts.deployment.receiptPath, "{}\n");
  assert.match(
    classifySpecialProofWeakness("cloud_service", receipts.cloudService) ?? "",
    /Google Workspace cloud-service deployment receipt hash changed/
  );
  assert.match(
    classifyGoogleWorkspaceFileSmokeWeakness(receipts.workspaceFileSmoke) ?? "",
    /Google Workspace smoke deployment receipt hash changed/
  );

  writeFileSync(receipts.deployment.receiptPath, deploymentReceiptSource);
  const weakDeploymentReceipt = JSON.parse(deploymentReceiptSource);
  weakDeploymentReceipt.releaseClaims.appsScriptDeploymentVerified = false;
  const weakDeploymentReceiptSource = `${JSON.stringify(weakDeploymentReceipt, null, 2)}\n`;
  writeFileSync(receipts.deployment.receiptPath, weakDeploymentReceiptSource);
  assert.match(
    classifySpecialProofWeakness("cloud_service", {
      ...receipts.cloudService,
      deploymentReceiptSha256: sha256(Buffer.from(weakDeploymentReceiptSource))
    }) ?? "",
    /Google Workspace cloud-service deployment receipt is weak: Google Workspace deployment receipt does not verify Apps Script deployment/
  );

  writeFileSync(receipts.deployment.receiptPath, deploymentReceiptSource);
  const cloudServiceReceiptSource = readFileSync(receipts.cloudService.receiptPath, "utf8");
  writeFileSync(receipts.cloudService.receiptPath, "{}\n");
  assert.match(
    classifyGoogleWorkspaceFileSmokeWeakness(receipts.workspaceFileSmoke) ?? "",
    /Google Workspace smoke cloud-service receipt hash changed/
  );

  writeFileSync(receipts.cloudService.receiptPath, cloudServiceReceiptSource);
  const weakCloudServiceReceipt = JSON.parse(cloudServiceReceiptSource);
  weakCloudServiceReceipt.requests = weakCloudServiceReceipt.requests.filter(
    (request: { commandId: string }) => request.commandId !== "dx.google-workspace.show_receipts"
  );
  weakCloudServiceReceipt.responses = weakCloudServiceReceipt.responses.filter(
    (response: { commandId: string }) => response.commandId !== "dx.google-workspace.show_receipts"
  );
  const weakCloudServiceReceiptSource = `${JSON.stringify(weakCloudServiceReceipt, null, 2)}\n`;
  writeFileSync(receipts.cloudService.receiptPath, weakCloudServiceReceiptSource);
  assert.match(
    classifyGoogleWorkspaceFileSmokeWeakness({
      ...receipts.workspaceFileSmoke,
      cloudServiceReceiptSha256: sha256(Buffer.from(weakCloudServiceReceiptSource))
    }) ?? "",
    /Google Workspace smoke cloud-service receipt is weak: Google Workspace cloud-service receipt is missing required command metadata/
  );

  writeFileSync(receipts.cloudService.receiptPath, cloudServiceReceiptSource);

  const fixture = googleWorkspaceFixture(packageOutputReceiptPath, proofFilePath);

  assert.throws(
    () =>
      writeGoogleWorkspaceDeploymentReceipts(workspaceRoot, {
        proof: {
          ...fixture,
          appsScriptDeploymentVerified: false
        }
      }),
    /must verify an Apps Script test deployment/
  );

  assert.throws(
    () =>
      writeGoogleWorkspaceDeploymentReceipts(workspaceRoot, {
        proof: {
          ...fixture,
          workspaceFileName: "Customer Roadmap"
        }
      }),
    /privacy-sensitive Google Workspace proof field/
  );

  assert.throws(
    () =>
      writeGoogleWorkspaceDeploymentReceipts(workspaceRoot, {
        proof: {
          ...fixture,
          commandIdsVisible: ["dx.google-workspace.show_status"]
        }
      }),
    /must include visible command metadata/
  );

  assert.throws(
    () =>
      writeGoogleWorkspaceDeploymentReceipts(workspaceRoot, {
        proof: {
          ...fixture,
          responses: fixture.responses.map((response) =>
            response.commandId === "dx.google-workspace.show_receipts"
              ? { ...response, status: "proof-blocked" as const }
              : response
          )
        }
      }),
    /responses must prove successful cloud-service execution/
  );

  assert.throws(
    () =>
      writeGoogleWorkspaceDeploymentReceipts(workspaceRoot, {
        proof: {
          ...fixture,
          deploymentMode: "head"
        }
      }),
    /must use a test deployment/
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("Google Workspace deployment receipts verified");

function googleWorkspaceFixture(packageOutputReceiptPath: string, proofFilePath: string) {
  return {
    packageOutputReceiptPath,
    proofFilePath,
    appsScriptDeploymentVerified: true,
    deploymentMode: "test-deployment",
    deploymentIdSha256: sha256(Buffer.from("deployment-id")),
    appsScriptProjectIdSha256: sha256(Buffer.from("script-project-id")),
    deploymentVersion: "head",
    oauthScopes: [],
    cloudServiceVerified: true,
    serviceEndpointHost: "dx-cloud-service.local",
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
    workspaceFileSmokeVerified: true,
    workspaceFileType: "docs",
    workspaceFileState: "test-file",
    cardsRendered: true,
    commandIdsVisible: [...commandIds],
    mutatesWorkspaceFile: false,
    storesWorkspacePayloads: false
  };
}

function writePackageOutputReceipt(): string {
  const outputRoot = join(workspaceRoot, "dist", "google-workspace");
  const buildResult = buildGoogleWorkspaceAppsScriptOutput({
    adapterRoot,
    outputRoot
  });
  const receiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    "dx.google-workspace.command-center",
    "package-output-latest.json"
  );

  writeGoogleWorkspaceAppsScriptPackageOutputReceipt({
    adapterRoot,
    packageRoot: buildResult.outputRoot,
    receiptPath,
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run build:google-workspace-apps-script:j1"
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
  if (commandId === "dx.google-workspace.search_assets") {
    return "dx.assets.search";
  }

  if (commandId === "dx.google-workspace.show_receipts") {
    return "receipt.showPath";
  }

  return "dx.status";
}
