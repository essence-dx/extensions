import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { writeExtensionProgressReport } from "../write-extension-progress-report.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-extension-progress-"));
const releaseEvidenceKinds = [
  { kind: "host_execution", receiptName: "loaded-host.json" },
  { kind: "package_output", receiptName: "package-output-latest.json" },
  { kind: "signing", receiptName: "signing-latest.json" },
  { kind: "checksum", receiptName: "checksum-latest.json" },
  { kind: "distribution_review", receiptName: "distribution-latest.json" }
] as const;

try {
  writeWorkspaceFile(
    "registry/official-extensions.toml",
    `
schema = "dx.official_extensions"
manifest_version = 1

[[extensions]]
id = "dx.alpha.command-center"
host = "alpha"
kind = "plugin"
manifest = "hosts/alpha/dx.extension.toml"
package = "hosts/alpha"
commands = ["dx.alpha"]
receipts = [".dx/receipts/extensions/dx.alpha.command-center/readiness-latest.json"]

[[extensions]]
id = "dx.beta.command-center"
host = "beta"
kind = "plugin"
manifest = "hosts/beta/dx.extension.toml"
package = "hosts/beta"
commands = ["dx.beta"]
receipts = [".dx/receipts/extensions/dx.beta.command-center/readiness-latest.json"]

[[extensions]]
id = "dx.gamma.command-center"
host = "gamma"
kind = "plugin"
manifest = "hosts/gamma/dx.extension.toml"
package = "hosts/gamma"
commands = ["dx.gamma"]
receipts = [".dx/receipts/extensions/dx.gamma.command-center/readiness-latest.json"]

[[extensions]]
id = "dx.delta.command-center"
host = "delta"
kind = "plugin"
manifest = "hosts/delta/dx.extension.toml"
package = "hosts/delta"
commands = ["dx.delta"]
receipts = [".dx/receipts/extensions/dx.delta.command-center/readiness-latest.json"]
`
  );
  writeWorkspaceFile(
    "registry/extension-readiness.toml",
    `
schema = "dx.extension_readiness"
manifest_version = 1

[[extensions]]
id = "dx.alpha.command-center"
stage = "package-proof"
manifest = "hosts/alpha/dx.extension.toml"
source_guard = "test:alpha"
latest_readiness_receipt = ".dx/receipts/extensions/dx.alpha.command-center/readiness-latest.json"
next_proof = "load alpha"
blocked_by = ["signing proof", "distribution review proof"]
loaded_host_receipt = ".dx/receipts/extensions/dx.alpha.command-center/loaded-host.json"
package_receipt = ".dx/receipts/extensions/dx.alpha.command-center/package-output-latest.json"
signing_receipt = ".dx/receipts/extensions/dx.alpha.command-center/signing-latest.json"
checksum_receipt = ".dx/receipts/extensions/dx.alpha.command-center/checksum-latest.json"
distribution_receipt = ".dx/receipts/extensions/dx.alpha.command-center/distribution-latest.json"

[[extensions]]
id = "dx.beta.command-center"
stage = "source-level"
manifest = "hosts/beta/dx.extension.toml"
source_guard = "test:beta"
latest_readiness_receipt = ".dx/receipts/extensions/dx.beta.command-center/readiness-latest.json"
next_proof = "load beta"
blocked_by = ["loaded host"]

[[extensions]]
id = "dx.gamma.command-center"
stage = "source-level"
manifest = "hosts/gamma/dx.extension.toml"
source_guard = "test:gamma"
latest_readiness_receipt = ".dx/receipts/extensions/dx.gamma.command-center/readiness-latest.json"
next_proof = "load gamma"
blocked_by = ["loaded host"]

[[extensions]]
id = "dx.delta.command-center"
stage = "source-level"
manifest = "hosts/delta/dx.extension.toml"
source_guard = "test:delta"
latest_readiness_receipt = ".dx/receipts/extensions/dx.delta.command-center/readiness-latest.json"
next_proof = "load delta"
blocked_by = ["loaded host"]
`
  );
  writeWorkspaceFile("hosts/alpha/dx.extension.toml", "[extension]\nid = \"dx.alpha.command-center\"\n");
  writeWorkspaceFile("hosts/beta/dx.extension.toml", "[extension]\nid = \"dx.beta.command-center\"\n");
  writeWorkspaceFile("hosts/gamma/dx.extension.toml", "[extension]\nid = \"dx.gamma.command-center\"\n");
  writeWorkspaceFile("hosts/delta/dx.extension.toml", "[extension]\nid = \"dx.delta.command-center\"\n");
  writeWorkspaceFile(".dx/receipts/extensions/dx.alpha.command-center/package-output-latest.json", "{}\n");
  writeWorkspaceFile(".dx/receipts/extensions/dx.alpha.command-center/loaded-host.json", "{}\n");
  writeWorkspaceFile(".dx/receipts/extensions/dx.alpha.command-center/loaded-host-preflight-latest.json", "{}\n");
  writeWorkspaceFile(
    ".dx/receipts/extensions/dx.alpha.command-center/host-discovery-latest.json",
    `{"discoveryMode":"local-tooling","status":"candidate-found"}\n`
  );
  writeWorkspaceFile(".dx/receipts/extensions/dx.beta.command-center/package-output-latest.json", "{}\n");
  writeWorkspaceFile(
    ".dx/receipts/extensions/dx.beta.command-center/host-discovery-latest.json",
    `{"discoveryMode":"local-tooling","status":"missing"}\n`
  );
  writeWorkspaceFile(
    ".dx/receipts/extensions/dx.gamma.command-center/host-discovery-latest.json",
    `{"discoveryMode":"manual-only","status":"manual-only"}\n`
  );
  writeWorkspaceFile(
    ".dx/receipts/extensions/dx.delta.command-center/host-discovery-latest.json",
    `{"discoveryMode":"cloud-service","status":"cloud-service"}\n`
  );
  writeWorkspaceFile(
    "registry/release-evidence-gates.toml",
    `
schema = "dx.release_evidence_gates"
manifest_version = 1

${writeReleaseEvidenceGateEntry("dx.alpha.command-center", "load alpha")}
${writeReleaseEvidenceGateEntry("dx.beta.command-center", "load beta")}
${writeReleaseEvidenceGateEntry("dx.gamma.command-center", "load gamma")}
${writeReleaseEvidenceGateEntry("dx.delta.command-center", "load delta")}
`
  );

  const report = writeExtensionProgressReport(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run report:extension-progress:j1"
  });

  assert.equal(report.summary.officialExtensions, 4);
  assert.equal(report.summary.sourceLevel, 3);
  assert.equal(report.summary.releaseReady, 0);
  assert.equal(report.summary.packageOutputProofs, 2);
  assert.equal(report.summary.loadedHostPreflights, 1);
  assert.equal(report.summary.hostDiscoveryReceipts, 4);
  assert.equal(report.summary.hostDiscoveryCandidateFound, 1);
  assert.equal(report.summary.hostDiscoveryMissing, 1);
  assert.equal(report.summary.hostDiscoveryManualOnly, 1);
  assert.equal(report.summary.hostDiscoveryCloudService, 1);
  assert.equal(report.summary.releaseEvidenceGates, 4);
  assert.deepEqual(report.summary.releaseEvidenceSnapshot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    releaseGateEntries: 4,
    expectedReceiptCount: 20,
    existingReceiptCount: 3,
    missingReceiptCount: 17,
    weakReceiptCount: 3,
    missingEvidenceCount: 20,
    weakEvidenceCount: 3,
    environmentBlockerCount: 0,
    releaseReady: 0
  });
  assert.equal(report.summary.releaseEvidenceReady, 0);
  assert.equal(report.summary.missingReleaseEvidenceCount, 20);
  assert.equal(report.summary.weakReleaseEvidenceCount, 3);
  assert.equal(report.summary.missingReleaseReceiptCount, 17);
  assert.equal(report.summary.weakReleaseReceiptCount, 3);
  assert.equal(report.summary.staleReadinessReceipts, 0);
  assert.deepEqual(report.summary.remainingProofSourceCounts, {
    developer_attestation: 0,
    host_application: 0,
    marketplace_review: 4,
    service_endpoint: 0,
    signature_authority: 4,
    workspace_artifact: 4
  });
  assert.deepEqual(
    report.extensions.find((extension) => extension.id === "dx.alpha.command-center")?.remainingProofSources,
    ["marketplace_review", "signature_authority", "workspace_artifact"]
  );
  assert.deepEqual(
    report.extensions.find((extension) => extension.id === "dx.alpha.command-center")?.remainingProofSourceCounts,
    {
      developer_attestation: 0,
      host_application: 0,
      marketplace_review: 1,
      service_endpoint: 0,
      signature_authority: 1,
      workspace_artifact: 1
    }
  );
  assert.deepEqual(
    report.extensions.map((extension) => ({
      id: extension.id,
      packageOutputReceipt: extension.packageOutputReceipt,
      loadedHostPreflightReceipt: extension.loadedHostPreflightReceipt,
      hostDiscoveryReceipt: extension.hostDiscoveryReceipt,
      hostDiscoveryMode: extension.hostDiscoveryMode,
      hostDiscoveryStatus: extension.hostDiscoveryStatus,
      releaseEvidenceGate: extension.releaseEvidenceGate,
      releaseEvidenceReady: extension.releaseEvidenceReady,
      missingReleaseEvidence: extension.missingReleaseEvidence,
      weakReleaseEvidence: extension.weakReleaseEvidence,
      missingReleaseReceiptCount: extension.missingReleaseReceiptCount,
      weakReleaseReceiptCount: extension.weakReleaseReceiptCount
    })),
    [
      {
        id: "dx.alpha.command-center",
        packageOutputReceipt: true,
        loadedHostPreflightReceipt: true,
        hostDiscoveryReceipt: true,
        hostDiscoveryMode: "local-tooling",
        hostDiscoveryStatus: "candidate-found",
        releaseEvidenceGate: true,
        releaseEvidenceReady: false,
        missingReleaseEvidence: [
          "checksum",
          "distribution_review",
          "host_execution",
          "package_output",
          "signing"
        ],
        weakReleaseEvidence: ["host_execution", "package_output"],
        missingReleaseReceiptCount: 3,
        weakReleaseReceiptCount: 2
      },
      {
        id: "dx.beta.command-center",
        packageOutputReceipt: true,
        loadedHostPreflightReceipt: false,
        hostDiscoveryReceipt: true,
        hostDiscoveryMode: "local-tooling",
        hostDiscoveryStatus: "missing",
        releaseEvidenceGate: true,
        releaseEvidenceReady: false,
        missingReleaseEvidence: [
          "checksum",
          "distribution_review",
          "host_execution",
          "package_output",
          "signing"
        ],
        weakReleaseEvidence: ["package_output"],
        missingReleaseReceiptCount: 4,
        weakReleaseReceiptCount: 1
      },
      {
        id: "dx.delta.command-center",
        packageOutputReceipt: false,
        loadedHostPreflightReceipt: false,
        hostDiscoveryReceipt: true,
        hostDiscoveryMode: "cloud-service",
        hostDiscoveryStatus: "cloud-service",
        releaseEvidenceGate: true,
        releaseEvidenceReady: false,
        missingReleaseEvidence: [
          "checksum",
          "distribution_review",
          "host_execution",
          "package_output",
          "signing"
        ],
        weakReleaseEvidence: [],
        missingReleaseReceiptCount: 5,
        weakReleaseReceiptCount: 0
      },
      {
        id: "dx.gamma.command-center",
        packageOutputReceipt: false,
        loadedHostPreflightReceipt: false,
        hostDiscoveryReceipt: true,
        hostDiscoveryMode: "manual-only",
        hostDiscoveryStatus: "manual-only",
        releaseEvidenceGate: true,
        releaseEvidenceReady: false,
        missingReleaseEvidence: [
          "checksum",
          "distribution_review",
          "host_execution",
          "package_output",
          "signing"
        ],
        weakReleaseEvidence: [],
        missingReleaseReceiptCount: 5,
        weakReleaseReceiptCount: 0
      }
    ]
  );
  assert.equal(existsSync(join(workspaceRoot, ".dx", "receipts", "extensions", "progress-latest.json")), true);
  assert.equal(
    existsSync(join(workspaceRoot, ".dx", "receipts", "extensions", "release-evidence-gaps-latest.json")),
    true
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("extension progress report verified");

function writeWorkspaceFile(relativePath: string, source: string): void {
  const absolutePath = join(workspaceRoot, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);
}

function writeReleaseEvidenceGateEntry(id: string, nextReleaseProof: string): string {
  const requirements = releaseEvidenceKinds.map(
    (evidence) => `${evidence.kind}=.dx/receipts/extensions/${id}/${evidence.receiptName}`
  );
  const receipts = releaseEvidenceKinds.map(
    (evidence) => `.dx/receipts/extensions/${id}/${evidence.receiptName}`
  );

  return `
[[extensions]]
id = "${id}"
stage = "not-release-ready"
required_evidence = [${quotedList(releaseEvidenceKinds.map((evidence) => evidence.kind))}]
evidence_receipt_requirements = [${quotedList(requirements)}]
evidence_receipts = [${quotedList(receipts)}]
next_release_proof = "${nextReleaseProof}"
blocked_by = ["loaded host"]
`;
}

function quotedList(values: readonly string[]): string {
  return values.map((value) => `"${value}"`).join(", ");
}
