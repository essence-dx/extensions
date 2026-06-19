import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { writeReleaseEvidenceGapReport } from "../write-release-evidence-gap-report.ts";
import {
  officeReleaseGapAdapters,
  writeOfficeLocalServiceReleaseGapFixtures
} from "./releaseEvidenceGapReportOfficeLocalServiceFixtures.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-release-gaps-office-local-service-"));

try {
  writeOfficeLocalServiceReleaseGapFixtures(workspaceRoot);
  const stalePreflightAdapter = officeReleaseGapAdapters[0];
  writeReleaseChecksumReceipt(stalePreflightAdapter);
  writeLoadedHostPreflightReceipt(stalePreflightAdapter);

  const report = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });

  for (const adapter of officeReleaseGapAdapters) {
    const extension = report.extensions.find((entry) => entry.id === adapter.adapterId);
    assert.ok(extension, `${adapter.adapterId} must appear in the release gap report.`);

    const requirements = new Map(
      extension.evidenceRequirements.map((requirement) => [requirement.kind, requirement])
    );

    assert.equal(requirements.get("package_output")?.releaseValid, true);
    assert.equal(
      requirements.get("checksum")?.releaseValid,
      adapter.adapterId === stalePreflightAdapter.adapterId
    );
    assert.equal(requirements.get("host_execution")?.releaseValid, true);
    assert.equal(requirements.get("local_service")?.releaseValid, true);
    assert.deepEqual(
      extension.existingEvidence,
      adapter.adapterId === stalePreflightAdapter.adapterId
        ? ["checksum", "host_execution", "local_service", "package_output"]
        : ["host_execution", "local_service", "package_output"]
    );
    assert.deepEqual(
      extension.missingEvidence,
      adapter.adapterId === stalePreflightAdapter.adapterId
        ? ["appsource_review", "distribution_review", "signing"]
        : ["appsource_review", "checksum", "distribution_review", "signing"]
    );
    assert.deepEqual(extension.weakEvidence, []);
    assert.equal(extension.releaseReady, false);
  }

  const stalePreflightExtension = report.extensions.find((entry) => entry.id === stalePreflightAdapter.adapterId);
  assert.ok(stalePreflightExtension);
  assert.deepEqual(stalePreflightExtension.environment.loadedHostPreflight?.blockedBy, [
    "package proof",
    "checksum receipt",
    "signing receipt",
    "AppSource readiness proof"
  ]);
  assert.equal(
    stalePreflightExtension.environment.blockers.includes("loaded-host preflight: package proof"),
    false
  );
  assert.equal(
    stalePreflightExtension.environment.blockers.includes("loaded-host preflight: checksum receipt"),
    false
  );
  assert.equal(
    stalePreflightExtension.environment.blockers.includes("loaded-host preflight: signing receipt"),
    true
  );
  assert.equal(
    stalePreflightExtension.environment.blockers.includes("loaded-host preflight: AppSource readiness proof"),
    true
  );

  const adapter = officeReleaseGapAdapters[0];
  const sideloadedHostReceiptPath = receiptPath(adapter.adapterId, "sideloaded-host-latest.json");
  const localServiceReceiptPath = receiptPath(adapter.adapterId, "local-service-latest.json");
  const sideloadedHostReceiptSource = readFileSync(sideloadedHostReceiptPath, "utf8");
  const sideloadedHostReceipt = JSON.parse(sideloadedHostReceiptSource);
  const localServiceReceiptSource = readFileSync(localServiceReceiptPath, "utf8");
  const localServiceReceipt = JSON.parse(localServiceReceiptSource);
  const sideloadedProofSource = readFileSync(sideloadedHostReceipt.manualProof.proofFilePath, "utf8");
  const localServiceProofSource = readFileSync(localServiceReceipt.manualProof.proofFilePath, "utf8");
  const packageOutputReceiptSource = readFileSync(sideloadedHostReceipt.packageOutput.receiptPath, "utf8");

  writeFileSync(
    sideloadedHostReceiptPath,
    `${JSON.stringify({ ...sideloadedHostReceipt, host: "word" }, null, 2)}\n`
  );
  assert.match(
    requirementWeakness(adapter.adapterId, "host_execution"),
    /Office sideloaded-host receipt is missing adapter or host identity/
  );

  writeFileSync(sideloadedHostReceiptPath, sideloadedHostReceiptSource);
  writeFileSync(sideloadedHostReceipt.manualProof.proofFilePath, "Office sideloaded proof changed.\n");
  assert.match(
    requirementWeakness(adapter.adapterId, "host_execution"),
    /Office sideloaded-host manual proof file hash changed/
  );

  writeFileSync(sideloadedHostReceipt.manualProof.proofFilePath, sideloadedProofSource);
  writeFileSync(sideloadedHostReceipt.packageOutput.receiptPath, "{}\n");
  assert.match(
    requirementWeakness(adapter.adapterId, "host_execution"),
    /Office sideloaded-host linked package-output receipt hash changed/
  );

  writeFileSync(sideloadedHostReceipt.packageOutput.receiptPath, packageOutputReceiptSource);
  const taskpanePackageFilePath = join(workspaceRoot, "packages", adapter.host, "taskpane.html");
  const taskpanePackageFileSource = readFileSync(taskpanePackageFilePath, "utf8");
  writeFileSync(taskpanePackageFilePath, "Office taskpane package file changed.\n");
  assert.match(
    requirementWeakness(adapter.adapterId, "host_execution"),
    /Office sideloaded-host linked package-output/
  );

  writeFileSync(taskpanePackageFilePath, taskpanePackageFileSource);
  writeFileSync(
    sideloadedHostReceiptPath,
    `${JSON.stringify(
      {
        ...sideloadedHostReceipt,
        sideload: {
          ...sideloadedHostReceipt.sideload,
          commandIdsVisible: [...adapter.commandIds],
          commandResults: adapter.commandIds.map((commandId) => ({
            commandId,
            status: commandId.endsWith("show_status") ? "clicked" : "proof-blocked"
          }))
        }
      },
      null,
      2
    )}\n`
  );
  assert.match(
    requirementWeakness(adapter.adapterId, "host_execution"),
    /Office sideloaded-host receipt is missing required command proof/
  );

  writeFileSync(sideloadedHostReceiptPath, sideloadedHostReceiptSource);
  writeFileSync(sideloadedHostReceiptPath, "{}\n");
  assert.match(
    requirementWeakness(adapter.adapterId, "local_service"),
    /Office local-service sideloaded-host receipt hash changed/
  );

  writeFileSync(sideloadedHostReceiptPath, sideloadedHostReceiptSource);
  writeFileSync(
    sideloadedHostReceiptPath,
    `${JSON.stringify(
      {
        ...sideloadedHostReceipt,
        sideload: {
          ...sideloadedHostReceipt.sideload,
          taskpaneUrl: `https://localhost:3979/${adapter.host}/wrong-taskpane.html`
        }
      },
      null,
      2
    )}\n`
  );
  assert.match(
    requirementWeakness(adapter.adapterId, "host_execution"),
    /Office sideloaded-host taskpane URL does not match package output/
  );

  writeFileSync(sideloadedHostReceiptPath, sideloadedHostReceiptSource);
  const weakSideloadedHostReceiptSource = `${JSON.stringify(
    {
      ...sideloadedHostReceipt,
      sideload: {
        ...sideloadedHostReceipt.sideload,
        localServiceRequestsBlocked: false
      }
    },
    null,
    2
  )}\n`;
  writeFileSync(sideloadedHostReceiptPath, weakSideloadedHostReceiptSource);
  writeFileSync(
    localServiceReceiptPath,
    `${JSON.stringify(
      {
        ...localServiceReceipt,
        sideloadedHost: {
          ...localServiceReceipt.sideloadedHost,
          receiptSha256: sha256(Buffer.from(weakSideloadedHostReceiptSource))
        }
      },
      null,
      2
    )}\n`
  );
  assert.match(
    requirementWeakness(adapter.adapterId, "local_service"),
    /Office local-service sideloaded-host receipt is weak: Office sideloaded-host receipt is missing taskpane or command proof/
  );

  writeFileSync(sideloadedHostReceiptPath, sideloadedHostReceiptSource);
  writeFileSync(localServiceReceiptPath, localServiceReceiptSource);
  writeFileSync(
    localServiceReceiptPath,
    `${JSON.stringify(
      {
        ...localServiceReceipt,
        localService: {
          ...localServiceReceipt.localService,
          requests: [
            {
              ...localServiceReceipt.localService.requests[0],
              command: `${adapter.commandIds[0]}.unsupported`,
              operation: "dx.status"
            },
            ...localServiceReceipt.localService.requests.slice(1)
          ],
          responses: [
            {
              ...localServiceReceipt.localService.responses[0],
              command: `${adapter.commandIds[0]}.unsupported`
            },
            ...localServiceReceipt.localService.responses.slice(1)
          ]
        }
      },
      null,
      2
    )}\n`
  );
  assert.match(
    requirementWeakness(adapter.adapterId, "local_service"),
    /Office local-service receipt uses unsupported command/
  );

  writeFileSync(localServiceReceiptPath, localServiceReceiptSource);
  writeFileSync(
    localServiceReceiptPath,
    `${JSON.stringify(
      {
        ...localServiceReceipt,
        localService: {
          ...localServiceReceipt.localService,
          requests: [
            localServiceReceipt.localService.requests[0],
            {
              ...localServiceReceipt.localService.requests[1],
              operation: "dx.status"
            }
          ]
        }
      },
      null,
      2
    )}\n`
  );
  assert.match(
    requirementWeakness(adapter.adapterId, "local_service"),
    /Office local-service receipt has an invalid command operation/
  );

  writeFileSync(localServiceReceiptPath, localServiceReceiptSource);
  writeFileSync(localServiceReceipt.manualProof.proofFilePath, "Office local-service proof changed.\n");
  assert.match(
    requirementWeakness(adapter.adapterId, "local_service"),
    /Office local-service manual proof file hash changed/
  );

  writeFileSync(localServiceReceipt.manualProof.proofFilePath, localServiceProofSource);
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("Office local-service release evidence classification verified");

function receiptPath(adapterId: string, receiptName: string): string {
  return join(workspaceRoot, ".dx", "receipts", "extensions", adapterId, receiptName);
}

function writeReleaseChecksumReceipt(adapter: (typeof officeReleaseGapAdapters)[number]): void {
  const packageOutputReceiptPath = receiptPath(adapter.adapterId, "package-output-latest.json");
  const packageOutputReceiptBytes = readFileSync(packageOutputReceiptPath);
  const packageOutputReceipt = JSON.parse(packageOutputReceiptBytes.toString("utf8"));
  const releaseArtifactPath = join(workspaceRoot, "release-packages", `${adapter.host}.zip`);
  const releaseArtifactSource = `${adapter.officeApplication} release package\n`;
  mkdirSync(dirname(releaseArtifactPath), { recursive: true });
  writeFileSync(releaseArtifactPath, releaseArtifactSource);
  const releaseArtifactBytes = readFileSync(releaseArtifactPath);

  writeJsonFile(receiptPath(adapter.adapterId, "checksum-latest.json"), {
    receipt: "dx.extension.release_package.checksum",
    adapterId: adapter.adapterId,
    host: adapter.host,
    checksum: {
      algorithm: "sha256",
      scope: "public-release-package",
      bytes: releaseArtifactBytes.length,
      sha256: sha256(releaseArtifactBytes)
    },
    packageOutput: {
      receiptPath: packageOutputReceiptPath,
      receiptSha256: sha256(packageOutputReceiptBytes),
      packageOutputSha256: packageOutputReceipt.package.sha256,
      fileCount: packageOutputReceipt.package.fileCount,
      filesVerified: packageOutputReceipt.package.fileCount
    },
    releaseArtifact: {
      path: releaseArtifactPath,
      fileName: `${adapter.host}.zip`,
      bytes: releaseArtifactBytes.length,
      sha256: sha256(releaseArtifactBytes),
      createdFromPackageOutput: true
    },
    releaseClaims: {
      packageOutputVerified: true,
      publicReleasePackageVerified: true,
      releaseChecksumVerified: true
    }
  });
}

function writeLoadedHostPreflightReceipt(adapter: (typeof officeReleaseGapAdapters)[number]): void {
  const packageOutputReceiptPath = receiptPath(adapter.adapterId, "package-output-latest.json");
  const packageOutputReceiptBytes = readFileSync(packageOutputReceiptPath);

  writeJsonFile(receiptPath(adapter.adapterId, "loaded-host-preflight-latest.json"), {
    receipt: "dx.extension.loaded_host_preflight",
    adapterId: adapter.adapterId,
    host: adapter.host,
    packageOutputReceiptPath,
    packageOutputReceiptSha256: sha256(packageOutputReceiptBytes),
    readiness: {
      nextProof: `Capture ${adapter.officeApplication} AppSource release evidence`,
      blockedBy: [
        "package proof",
        "checksum receipt",
        "signing receipt",
        "AppSource readiness proof"
      ]
    },
    preflightClaims: {
      hostExecuted: false,
      loadedHostVerified: false,
      releaseReady: false,
      marketplaceOrStoreVerified: false
    }
  });
}

function writeJsonFile(absolutePath: string, value: unknown): void {
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function requirementWeakness(adapterId: string, kind: string): string {
  const report = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });
  const extension = report.extensions.find((entry) => entry.id === adapterId);
  assert.ok(extension, `${adapterId} must appear in the release gap report.`);
  const requirement = extension.evidenceRequirements.find((entry) => entry.kind === kind);
  assert.ok(requirement, `${adapterId} must include ${kind}.`);
  assert.equal(requirement.releaseValid, false);

  return requirement.weakness ?? "";
}
