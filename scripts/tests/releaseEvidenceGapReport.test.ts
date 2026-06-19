import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { writeReleaseEvidenceGapReport } from "../write-release-evidence-gap-report.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-release-evidence-gaps-"));

try {
  writeWorkspaceFile(
    "registry/official-extensions.toml",
    `
schema = "dx.extensions.registry"
manifest_version = 1

[[extensions]]
id = "dx.alpha.command-center"
name = "dx.alpha.command-center"
path = "hosts/alpha"
manifest = "hosts/alpha/dx.extension.toml"
status = "experimental"
professional_targets = ["fixture.alpha"]

[[extensions]]
id = "dx.beta.command-center"
name = "dx.beta.command-center"
path = "hosts/beta"
manifest = "hosts/beta/dx.extension.toml"
status = "experimental"
professional_targets = ["fixture.beta"]
`
  );
  writeWorkspaceFile(
    "hosts/alpha/dx.extension.toml",
    `
[extension]
id = "dx.alpha.command-center"

[[capabilities]]
id = "local_service.connect"
`
  );
  writeWorkspaceFile(
    "hosts/beta/dx.extension.toml",
    `
[extension]
id = "dx.beta.command-center"
`
  );
  writeWorkspaceFile(
    "registry/release-evidence-gates.toml",
    `
schema = "dx.release_evidence_gates"
manifest_version = 1

[[extensions]]
id = "dx.alpha.command-center"
stage = "not-release-ready"
required_evidence = ["host_execution", "package_output", "signing", "checksum", "distribution_review", "local_service", "native_host_package", "ccx_package"]
evidence_receipt_requirements = ["host_execution=.dx/receipts/extensions/dx.alpha.command-center/loaded-host.json", "package_output=.dx/receipts/extensions/dx.alpha.command-center/package-output-latest.json", "signing=.dx/receipts/extensions/dx.alpha.command-center/signing.json", "checksum=.dx/receipts/extensions/dx.alpha.command-center/checksum-latest.json", "distribution_review=.dx/receipts/extensions/dx.alpha.command-center/distribution-latest.json", "local_service=.dx/receipts/extensions/dx.alpha.command-center/local-service-latest.json", "native_host_package=.dx/receipts/extensions/dx.alpha.command-center/native-host-release-package-latest.json", "ccx_package=.dx/receipts/extensions/dx.alpha.command-center/ccx-package-latest.json"]
evidence_receipts = [".dx/receipts/extensions/dx.alpha.command-center/loaded-host.json", ".dx/receipts/extensions/dx.alpha.command-center/package-output-latest.json", ".dx/receipts/extensions/dx.alpha.command-center/signing.json", ".dx/receipts/extensions/dx.alpha.command-center/checksum-latest.json", ".dx/receipts/extensions/dx.alpha.command-center/distribution-latest.json", ".dx/receipts/extensions/dx.alpha.command-center/local-service-latest.json", ".dx/receipts/extensions/dx.alpha.command-center/native-host-release-package-latest.json", ".dx/receipts/extensions/dx.alpha.command-center/ccx-package-latest.json"]
next_release_proof = "load alpha"
blocked_by = ["loaded host", "signing"]

[[extensions]]
id = "dx.beta.command-center"
stage = "not-release-ready"
required_evidence = ["host_execution", "package_output", "signing", "checksum", "distribution_review"]
evidence_receipt_requirements = ["host_execution=.dx/receipts/extensions/dx.beta.command-center/loaded-host.json", "package_output=.dx/receipts/extensions/dx.beta.command-center/package-output-latest.json", "signing=.dx/receipts/extensions/dx.beta.command-center/signing-latest.json", "checksum=.dx/receipts/extensions/dx.beta.command-center/checksum-latest.json", "distribution_review=.dx/receipts/extensions/dx.beta.command-center/distribution-latest.json"]
evidence_receipts = [".dx/receipts/extensions/dx.beta.command-center/loaded-host.json", ".dx/receipts/extensions/dx.beta.command-center/package-output-latest.json", ".dx/receipts/extensions/dx.beta.command-center/signing-latest.json", ".dx/receipts/extensions/dx.beta.command-center/checksum-latest.json", ".dx/receipts/extensions/dx.beta.command-center/distribution-latest.json"]
next_release_proof = "load beta"
blocked_by = ["loaded host"]
`
  );
  writeWorkspaceFile(".dx/receipts/extensions/dx.alpha.command-center/loaded-host.json", "{}\n");
  writeWorkspaceFile(".dx/receipts/extensions/dx.alpha.command-center/package-output-latest.json", "{}\n");
  writeWorkspaceFile(
    ".dx/receipts/extensions/dx.alpha.command-center/checksum-latest.json",
    JSON.stringify(
      {
        receipt: "dx.extension.package_output.checksum",
        adapterId: "dx.alpha.command-center",
        checksum: {
          scope: "package-output"
        },
        releaseClaims: {
          packageOutputChecksumVerified: true,
          publicReleasePackageVerified: false
        }
      },
      null,
      2
    )
  );
  writeWorkspaceFile(
    ".dx/receipts/extensions/dx.alpha.command-center/ccx-package-latest.json",
    JSON.stringify(
      {
        receipt: "dx.extension.adobe_uxp.ccx_package",
        adapterId: "dx.alpha.command-center",
        releaseClaims: {
          packageOutputVerified: true,
          ccxPackaged: true
        }
      },
      null,
      2
    )
  );
  writeWorkspaceFile(
    ".dx/receipts/extensions/dx.alpha.command-center/signing.json",
    JSON.stringify(
      {
        receipt: "dx.extension.package.signing",
        adapterId: "dx.alpha.command-center",
        releaseClaims: {
          signingVerified: true,
          publicReleasePackageVerified: false
        }
      },
      null,
      2
    )
  );
  writeWorkspaceFile(
    ".dx/receipts/extensions/dx.alpha.command-center/distribution-latest.json",
    JSON.stringify(
      {
        receipt: "dx.extension.distribution_review",
        adapterId: "dx.alpha.command-center",
        review: {
          reviewKinds: ["distribution_review"]
        },
        releaseClaims: {
          reviewVerified: true,
          distributionVerified: false
        }
      },
      null,
      2
    )
  );
  writeWorkspaceFile(
    ".dx/receipts/extensions/dx.alpha.command-center/local-service-latest.json",
    JSON.stringify(
      {
        receipt: "dx.extension.local_service",
        adapterId: "dx.alpha.command-center",
        localService: {
          connected: true
        },
        releaseClaims: {
          loadedHostVerified: true,
          localServiceVerified: true
        }
      },
      null,
      2
    )
  );
  writeWorkspaceFile(
    ".dx/receipts/extensions/dx.alpha.command-center/native-host-release-package-latest.json",
    JSON.stringify(
      {
        receipt: "dx.extension.browser.native_host_package",
        adapterId: "dx.alpha.command-center",
        releaseClaims: {
          packageOutputVerified: true,
          nativeHostReleasePackageVerified: true
        }
      },
      null,
      2
    )
  );
  writeWorkspaceFile(
    ".dx/receipts/extensions/dx.beta.command-center/checksum-latest.json",
    JSON.stringify(
      {
        receipt: "dx.extension.package_output.checksum",
        adapterId: "dx.beta.command-center",
        checksum: {
          algorithm: "sha256",
          scope: "public-release-package",
          sha256: "b".repeat(64)
        },
        releaseClaims: {
          publicReleasePackageVerified: true,
          releaseChecksumVerified: true
        }
      },
      null,
      2
    )
  );
  writeWorkspaceFile(
    ".dx/receipts/extensions/dx.beta.command-center/signing-latest.json",
    JSON.stringify(
      {
        receipt: "dx.extension.package.signing",
        adapterId: "dx.beta.command-center",
        releaseClaims: {
          publicReleasePackageVerified: true,
          releaseChecksumVerified: true,
          signingVerified: true
        }
      },
      null,
      2
    )
  );

  const report = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });

  assert.equal(report.summary.releaseGateEntries, 2);
  assert.equal(report.summary.expectedReceiptCount, 13);
  assert.equal(report.summary.existingReceiptCount, 10);
  assert.equal(report.summary.missingReceiptCount, 3);
  assert.equal(report.summary.weakReceiptCount, 10);
  assert.equal(report.summary.expectedUniqueReceiptCount, 13);
  assert.equal(report.summary.existingUniqueReceiptCount, 10);
  assert.equal(report.summary.missingUniqueReceiptCount, 3);
  assert.equal(report.summary.weakUniqueReceiptCount, 10);
  assert.equal(report.summary.expectedEvidenceCount, 13);
  assert.equal(report.summary.existingEvidenceCount, 0);
  assert.equal(report.summary.missingEvidenceCount, 13);
  assert.equal(report.summary.weakEvidenceCount, 10);
  assert.equal(report.summary.releaseReady, 0);
  assert.deepEqual(
    report.extensions.map((extension) => ({
      id: extension.id,
      expectedReceiptCount: extension.expectedReceiptCount,
      existingReceiptCount: extension.existingReceiptCount,
      missingReceiptCount: extension.missingReceiptCount,
      expectedUniqueReceiptCount: extension.expectedUniqueReceiptCount,
      existingUniqueReceiptCount: extension.existingUniqueReceiptCount,
      missingUniqueReceiptCount: extension.missingUniqueReceiptCount,
      weakReceiptCount: extension.weakReceiptCount,
      weakUniqueReceiptCount: extension.weakUniqueReceiptCount,
      weakEvidence: extension.weakEvidence,
      existingEvidence: extension.existingEvidence,
      missingEvidence: extension.missingEvidence,
      existingReceipts: extension.existingReceipts,
      missingReceipts: extension.missingReceipts,
      weakReceipts: extension.weakReceipts,
      releaseReady: extension.releaseReady
    })),
    [
      {
        id: "dx.alpha.command-center",
        expectedReceiptCount: 8,
        existingReceiptCount: 8,
        missingReceiptCount: 0,
        weakReceiptCount: 8,
        expectedUniqueReceiptCount: 8,
        existingUniqueReceiptCount: 8,
        missingUniqueReceiptCount: 0,
        weakUniqueReceiptCount: 8,
        weakEvidence: [
          "ccx_package",
          "checksum",
          "distribution_review",
          "host_execution",
          "local_service",
          "native_host_package",
          "package_output",
          "signing"
        ],
        existingEvidence: [],
        missingEvidence: [
          "ccx_package",
          "checksum",
          "distribution_review",
          "host_execution",
          "local_service",
          "native_host_package",
          "package_output",
          "signing"
        ],
        existingReceipts: [
          ".dx/receipts/extensions/dx.alpha.command-center/ccx-package-latest.json",
          ".dx/receipts/extensions/dx.alpha.command-center/checksum-latest.json",
          ".dx/receipts/extensions/dx.alpha.command-center/distribution-latest.json",
          ".dx/receipts/extensions/dx.alpha.command-center/loaded-host.json",
          ".dx/receipts/extensions/dx.alpha.command-center/local-service-latest.json",
          ".dx/receipts/extensions/dx.alpha.command-center/native-host-release-package-latest.json",
          ".dx/receipts/extensions/dx.alpha.command-center/package-output-latest.json",
          ".dx/receipts/extensions/dx.alpha.command-center/signing.json"
        ],
        missingReceipts: [],
        weakReceipts: [
          ".dx/receipts/extensions/dx.alpha.command-center/ccx-package-latest.json",
          ".dx/receipts/extensions/dx.alpha.command-center/checksum-latest.json",
          ".dx/receipts/extensions/dx.alpha.command-center/distribution-latest.json",
          ".dx/receipts/extensions/dx.alpha.command-center/loaded-host.json",
          ".dx/receipts/extensions/dx.alpha.command-center/local-service-latest.json",
          ".dx/receipts/extensions/dx.alpha.command-center/native-host-release-package-latest.json",
          ".dx/receipts/extensions/dx.alpha.command-center/package-output-latest.json",
          ".dx/receipts/extensions/dx.alpha.command-center/signing.json"
        ],
        releaseReady: false
      },
      {
        id: "dx.beta.command-center",
        expectedReceiptCount: 5,
        existingReceiptCount: 2,
        missingReceiptCount: 3,
        weakReceiptCount: 2,
        expectedUniqueReceiptCount: 5,
        existingUniqueReceiptCount: 2,
        missingUniqueReceiptCount: 3,
        weakUniqueReceiptCount: 2,
        weakEvidence: ["checksum", "signing"],
        existingEvidence: [],
        missingEvidence: [
          "checksum",
          "distribution_review",
          "host_execution",
          "package_output",
          "signing"
        ],
        existingReceipts: [
          ".dx/receipts/extensions/dx.beta.command-center/checksum-latest.json",
          ".dx/receipts/extensions/dx.beta.command-center/signing-latest.json"
        ],
        missingReceipts: [
          ".dx/receipts/extensions/dx.beta.command-center/distribution-latest.json",
          ".dx/receipts/extensions/dx.beta.command-center/loaded-host.json",
          ".dx/receipts/extensions/dx.beta.command-center/package-output-latest.json"
        ],
        weakReceipts: [
          ".dx/receipts/extensions/dx.beta.command-center/checksum-latest.json",
          ".dx/receipts/extensions/dx.beta.command-center/signing-latest.json"
        ],
        releaseReady: false
      }
    ]
  );
  assert.equal(
    existsSync(join(workspaceRoot, ".dx", "receipts", "extensions", "release-evidence-gaps-latest.json")),
    true
  );
  assert.deepEqual(JSON.parse(readFileSync(report.receiptPath, "utf8")), report);
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("release evidence gap report verified");

function writeWorkspaceFile(relativePath: string, source: string): void {
  const absolutePath = join(workspaceRoot, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);
}
