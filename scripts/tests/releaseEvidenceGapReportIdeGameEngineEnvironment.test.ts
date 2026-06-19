import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { writeReleaseEvidenceGapReport } from "../write-release-evidence-gap-report.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-release-gaps-ide-environment-"));
const adapterId = "dx.visual-studio.command-center";

try {
  writeWorkspaceFixtures();
  writeHostDiscoveryReceipt();
  writeLoadedHostPreflightReceipt();

  const report = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });
  const extension = report.extensions.find((entry) => entry.id === adapterId);

  assert.ok(extension, "Visual Studio gap entry must exist.");
  assert.deepEqual(extension.environment, {
    hostDiscovery: {
      receiptPath: `.dx/receipts/extensions/${adapterId}/host-discovery-latest.json`,
      status: "missing",
      reason: "visual_studio_sdk_unavailable",
      foundRequiredTools: ["devenv", "msbuild", "dotnet"],
      missingRequiredTools: ["vssdk-targets"]
    },
    loadedHostPreflight: {
      receiptPath: `.dx/receipts/extensions/${adapterId}/loaded-host-preflight-latest.json`,
      nextProof: "Launch Visual Studio Experimental Instance.",
      blockedBy: ["Experimental Instance receipt", "Marketplace review proof"],
      packageLinkProblem: "package-output link is weak: package-output receipt is missing package or bundle payload",
      preflightClaims: {
        hostExecuted: false,
        loadedHostVerified: false,
        releaseReady: false,
        marketplaceOrStoreVerified: false
      }
    },
    blockers: [
      "host discovery: visual_studio_sdk_unavailable",
      "missing required tool: vssdk-targets",
      "loaded-host preflight: package-output link is weak: package-output receipt is missing package or bundle payload"
    ]
  });
  assert.equal(report.summary.environmentBlockerCount, 3);
  assert.equal(extension.releaseReady, false);
  assert.equal(report.summary.releaseReady, 0);
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("IDE/game-engine release environment blockers verified");

function writeWorkspaceFixtures(): void {
  writeWorkspaceFile(
    "registry/official-extensions.toml",
    `
schema = "dx.extensions.registry"
manifest_version = 1

[[extensions]]
id = "${adapterId}"
name = "DX Visual Studio Command Center"
path = "hosts/visual-studio/dx-visual-studio"
manifest = "hosts/visual-studio/dx-visual-studio/dx.extension.toml"
status = "experimental"
professional_targets = ["microsoft.visual-studio.sdk"]
`
  );
  writeWorkspaceFile("hosts/visual-studio/dx-visual-studio/dx.extension.toml", "[extension]\nid = \"dx.visual-studio.command-center\"\n");
  writeWorkspaceFile(
    "registry/release-evidence-gates.toml",
    `
schema = "dx.release_evidence_gates"
manifest_version = 1

[[extensions]]
id = "${adapterId}"
stage = "not-release-ready"
required_evidence = ["host_execution", "package_output", "signing", "checksum", "distribution_review", "experimental_instance", "local_service"]
evidence_receipt_requirements = ["host_execution=.dx/receipts/extensions/${adapterId}/loaded-host-latest.json", "experimental_instance=.dx/receipts/extensions/${adapterId}/experimental-instance-latest.json", "package_output=.dx/receipts/extensions/${adapterId}/package-output-latest.json", "local_service=.dx/receipts/extensions/${adapterId}/local-service-latest.json", "signing=.dx/receipts/extensions/${adapterId}/signing-latest.json", "checksum=.dx/receipts/extensions/${adapterId}/checksum-latest.json", "distribution_review=.dx/receipts/extensions/${adapterId}/marketplace-review-latest.json"]
evidence_receipts = [".dx/receipts/extensions/${adapterId}/loaded-host-latest.json", ".dx/receipts/extensions/${adapterId}/experimental-instance-latest.json", ".dx/receipts/extensions/${adapterId}/package-output-latest.json", ".dx/receipts/extensions/${adapterId}/local-service-latest.json", ".dx/receipts/extensions/${adapterId}/signing-latest.json", ".dx/receipts/extensions/${adapterId}/checksum-latest.json", ".dx/receipts/extensions/${adapterId}/marketplace-review-latest.json"]
next_release_proof = "Launch Visual Studio Experimental Instance."
blocked_by = ["Experimental Instance receipt"]
`
  );
}

function writeHostDiscoveryReceipt(): void {
  writeJsonFile(`.dx/receipts/extensions/${adapterId}/host-discovery-latest.json`, {
    receipt: "dx.extension.platform_host_discovery",
    adapterId,
    discoveryMode: "local-tooling",
    host: "visual-studio",
    status: "missing",
    reason: "visual_studio_sdk_unavailable",
    candidateFound: false,
    tools: [
      { id: "devenv", required: true, found: true },
      { id: "msbuild", required: true, found: true },
      { id: "dotnet", required: true, found: true },
      { id: "vssdk-targets", required: true, found: false }
    ],
    missingRequiredTools: ["vssdk-targets"],
    preflightClaims: {
      hostExecuted: false,
      loadedHostVerified: false,
      releaseReady: false
    }
  });
}

function writeLoadedHostPreflightReceipt(): void {
  const packageOutputReceiptPath = writePackageOutputReceipt();

  writeJsonFile(`.dx/receipts/extensions/${adapterId}/loaded-host-preflight-latest.json`, {
    receipt: "dx.extension.loaded_host_preflight",
    adapterId,
    host: "visual-studio",
    packageOutputReceiptPath,
    packageOutputReceiptSha256: sha256(readFileSync(packageOutputReceiptPath)),
    readiness: {
      nextProof: "Launch Visual Studio Experimental Instance.",
      blockedBy: ["Experimental Instance receipt", "Marketplace review proof"]
    },
    preflightClaims: {
      hostExecuted: false,
      loadedHostVerified: false,
      releaseReady: false,
      marketplaceOrStoreVerified: false
    }
  });
}

function writePackageOutputReceipt(): string {
  return writeWorkspaceFile(
    `.dx/receipts/extensions/${adapterId}/package-output-latest.json`,
    `${JSON.stringify(
      {
        receipt: "dx.extension.visual_studio.package_output",
        adapterId,
        host: "visual-studio"
      },
      null,
      2
    )}\n`
  );
}

function writeJsonFile(relativePath: string, value: unknown): void {
  writeWorkspaceFile(relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeWorkspaceFile(relativePath: string, source: string): string {
  const absolutePath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);

  return absolutePath;
}

function sha256(source: Buffer): string {
  return createHash("sha256").update(source).digest("hex");
}
