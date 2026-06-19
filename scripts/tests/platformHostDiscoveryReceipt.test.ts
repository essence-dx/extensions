import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  defaultPlatformHostDiscoveryTargets,
  writePlatformHostDiscoveryReceipts
} from "../write-platform-host-discovery-receipts.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-platform-host-discovery-"));

try {
  writeWorkspaceFile("tools/ready-host.exe", "ready\n");
  writeWorkspaceFile("tools/ready-sdk.targets", "sdk\n");

  const result = writePlatformHostDiscoveryReceipts(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run preflight:platform-host-discovery:j1",
    targets: [
      {
        adapterId: "dx.ready-host.command-center",
        discoveryMode: "local-tooling",
        host: "ready-host",
        unavailableReason: "ready_host_unavailable",
        tools: [
          {
            id: "host",
            label: "Ready Host",
            required: true,
            candidatePaths: [join(workspaceRoot, "tools", "ready-host.exe")]
          },
          {
            id: "sdk",
            label: "Ready SDK",
            required: true,
            candidatePaths: [join(workspaceRoot, "tools", "ready-sdk.targets")]
          }
        ]
      },
      {
        adapterId: "dx.missing-host.command-center",
        discoveryMode: "local-tooling",
        host: "missing-host",
        unavailableReason: "missing_host_unavailable",
        tools: [
          {
            id: "host",
            label: "Missing Host",
            required: true,
            candidatePaths: [join(workspaceRoot, "tools", "missing-host.exe")]
          }
        ]
      },
      {
        adapterId: "dx.manual-host.bridge",
        discoveryMode: "manual-only",
        host: "manual-host",
        readyReason: "manual_import_required",
        unavailableReason: "manual_host_unavailable",
        tools: []
      },
      {
        adapterId: "dx.cloud-host.command-center",
        discoveryMode: "cloud-service",
        host: "cloud-host",
        readyReason: "cloud_deployment_required",
        unavailableReason: "cloud_host_unavailable",
        tools: []
      }
    ]
  });

  assert.deepEqual(
    result.written.map((receipt) => receipt.adapterId),
    [
      "dx.cloud-host.command-center",
      "dx.manual-host.bridge",
      "dx.missing-host.command-center",
      "dx.ready-host.command-center"
    ]
  );

  const readyReceipt = readReceipt("dx.ready-host.command-center");
  assert.equal(readyReceipt.receipt, "dx.extension.platform_host_discovery");
  assert.equal(readyReceipt.discoveryMode, "local-tooling");
  assert.equal(readyReceipt.status, "candidate-found");
  assert.equal(readyReceipt.reason, "required_tools_found");
  assert.equal(readyReceipt.tools.every((tool) => tool.found === true), true);
  assert.deepEqual(readyReceipt.preflightClaims, {
    hostExecuted: false,
    loadedHostVerified: false,
    releaseReady: false
  });

  const missingReceipt = readReceipt("dx.missing-host.command-center");
  assert.equal(missingReceipt.discoveryMode, "local-tooling");
  assert.equal(missingReceipt.status, "missing");
  assert.equal(missingReceipt.reason, "missing_host_unavailable");
  assert.equal(missingReceipt.candidateFound, false);
  assert.deepEqual(missingReceipt.missingRequiredTools, ["host"]);
  assert.equal(missingReceipt.tools[0].found, false);
  assert.equal(existsSync(result.written[0].path), true);

  const manualReceipt = readReceipt("dx.manual-host.bridge");
  assert.equal(manualReceipt.discoveryMode, "manual-only");
  assert.equal(manualReceipt.status, "manual-only");
  assert.equal(manualReceipt.reason, "manual_import_required");
  assert.equal(manualReceipt.candidateFound, false);
  assert.deepEqual(manualReceipt.missingRequiredTools, []);
  assert.equal(manualReceipt.tools.length, 0);

  const cloudReceipt = readReceipt("dx.cloud-host.command-center");
  assert.equal(cloudReceipt.discoveryMode, "cloud-service");
  assert.equal(cloudReceipt.status, "cloud-service");
  assert.equal(cloudReceipt.reason, "cloud_deployment_required");
  assert.equal(cloudReceipt.candidateFound, false);
  assert.deepEqual(cloudReceipt.missingRequiredTools, []);
  assert.equal(cloudReceipt.tools.length, 0);

  assert.equal(new Set(defaultPlatformHostDiscoveryTargets.map((target) => target.adapterId)).size, 21);
  assert.equal(defaultPlatformHostDiscoveryTargets.length, 21);
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("platform host discovery receipts verified");

function readReceipt(adapterId: string): Record<string, any> {
  const source = readFileSync(
    join(workspaceRoot, ".dx", "receipts", "extensions", adapterId, "host-discovery-latest.json"),
    "utf8"
  );
  return JSON.parse(source);
}

function writeWorkspaceFile(relativePath: string, source: string): void {
  const absolutePath = join(workspaceRoot, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);
}
