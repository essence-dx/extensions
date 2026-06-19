import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { writeExtensionProgressReport } from "../write-extension-progress-report.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-affinity-progress-"));
const adapterId = "dx.affinity-content.bridge";
const packageReceiptPath = `.dx/receipts/extensions/${adapterId}/affinity-release-content-package.json`;

try {
  writeWorkspaceFile(
    "registry/official-extensions.toml",
    `
schema = "dx.official_extensions"
manifest_version = 1

[[extensions]]
id = "${adapterId}"
host = "affinity"
kind = "content"
manifest = "hosts/affinity/dx-affinity-content/dx.extension.toml"
package = "hosts/affinity/dx-affinity-content"
commands = ["dx.affinity"]
receipts = [".dx/receipts/extensions/${adapterId}/readiness-latest.json"]
`
  );
  writeWorkspaceFile(
    "registry/extension-readiness.toml",
    `
schema = "dx.extension_readiness"
manifest_version = 1

[[extensions]]
id = "${adapterId}"
stage = "source-level"
manifest = "hosts/affinity/dx-affinity-content/dx.extension.toml"
source_guard = "test:affinity-content-addon-adapter"
latest_readiness_receipt = ".dx/receipts/extensions/${adapterId}/readiness-latest.json"
next_proof = "Import DX content assets manually into Affinity apps and capture metadata-only import receipts."
blocked_by = ["manual import proof"]
`
  );
  writeWorkspaceFile(
    "hosts/affinity/dx-affinity-content/dx.extension.toml",
    `[extension]\nid = "${adapterId}"\n`
  );
  writeWorkspaceFile(
    "registry/release-evidence-gates.toml",
    `
schema = "dx.release_evidence_gates"
manifest_version = 1

[[extensions]]
id = "${adapterId}"
stage = "not-release-ready"
required_evidence = ["host_execution", "package_output", "signing", "checksum", "distribution_review", "manual_import", "content_package", "photoshop_filter_plugin"]
evidence_receipt_requirements = ["host_execution=.dx/receipts/extensions/${adapterId}/loaded-app-latest.json", "manual_import=.dx/receipts/extensions/${adapterId}/manual-import-latest.json", "photoshop_filter_plugin=.dx/receipts/extensions/${adapterId}/photoshop-filter-plugin-latest.json", "package_output=${packageReceiptPath}", "content_package=${packageReceiptPath}", "signing=.dx/receipts/extensions/${adapterId}/signing-latest.json", "checksum=.dx/receipts/extensions/${adapterId}/checksum-latest.json", "distribution_review=.dx/receipts/extensions/${adapterId}/distribution-latest.json"]
evidence_receipts = [".dx/receipts/extensions/${adapterId}/loaded-app-latest.json", ".dx/receipts/extensions/${adapterId}/manual-import-latest.json", ".dx/receipts/extensions/${adapterId}/photoshop-filter-plugin-latest.json", "${packageReceiptPath}", ".dx/receipts/extensions/${adapterId}/signing-latest.json", ".dx/receipts/extensions/${adapterId}/checksum-latest.json", ".dx/receipts/extensions/${adapterId}/distribution-latest.json"]
next_release_proof = "Import DX content assets manually into Affinity apps and capture Photoshop-compatible filter plugin proof."
blocked_by = ["manual import proof", "Photoshop-compatible filter plugin proof"]
`
  );
  writeWorkspaceFile(packageReceiptPath, "{}\n");

  const report = writeExtensionProgressReport(workspaceRoot, {
    generatedAt: "2026-06-08T00:00:00.000Z",
    verificationCommand: "npm run report:extension-progress:j1"
  });
  const affinity = report.extensions.find((extension) => extension.id === adapterId);

  assert.ok(affinity);
  assert.equal(report.summary.packageOutputProofs, 1);
  assert.equal(affinity.packageOutputReceipt, true);
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("Affinity progress content-package receipt verified");

function writeWorkspaceFile(relativePath: string, source: string): void {
  const absolutePath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);
}
