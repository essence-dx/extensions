import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { writeExtensionProgressReport } from "../write-extension-progress-report.ts";
import { hashSourceInputs, readSourceInputProofs } from "../lib/source-input-proof.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-extension-progress-stale-readiness-"));
const adapterId = "dx.blender.command-center";
const packageRoot = join(workspaceRoot, "hosts", "blender", "dx-blender");
const packageReceiptPath = `.dx/receipts/extensions/${adapterId}/package-output-latest.json`;
const checksumReceiptPath = `.dx/receipts/extensions/${adapterId}/checksum-latest.json`;
const readinessReceiptPath = `.dx/receipts/extensions/${adapterId}/readiness-latest.json`;
const releaseArtifactPath = join(workspaceRoot, "release", "dx-blender-command-center.zip");

try {
  writeWorkspaceFixtures();
  writeReadinessReceipt();
  writePackageOutputReceipt();
  writeChecksumReceipt();
  writeLoadedHostPreflightReceipt();

  const report = writeExtensionProgressReport(workspaceRoot, {
    generatedAt: "2026-06-08T00:00:00.000Z",
    verificationCommand: "npm run report:extension-progress:j1"
  });
  const blender = report.extensions.find((extension) => extension.id === adapterId);

  assert.ok(blender);
  assert.equal(report.summary.staleReadinessReceipts, 1);
  assert.equal(blender.readinessReceipt, true);
  assert.equal(blender.readinessReceiptStale, true);
  assert.equal(blender.blockedByCount, 3);
  assert.deepEqual(blender.staleReadinessReasons, [
    "package evidence is newer than the source-readiness receipt",
    "checksum evidence is newer than the source-readiness receipt",
    "loaded-host preflight package-output link is stale"
  ]);
  assert.deepEqual(blender.missingReleaseEvidence, [
    "distribution_review",
    "host_execution",
    "signing"
  ]);
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("extension progress stale readiness reporting verified");

function writeWorkspaceFixtures(): void {
  writeWorkspaceFile(
    "registry/official-extensions.toml",
    `
schema = "dx.extensions.registry"
manifest_version = 1

[[extensions]]
id = "${adapterId}"
name = "DX Blender Command Center"
path = "hosts/blender/dx-blender"
manifest = "hosts/blender/dx-blender/dx.extension.toml"
status = "experimental"
professional_targets = ["blender.python"]
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
manifest = "hosts/blender/dx-blender/dx.extension.toml"
source_guard = "test:blender-adapter"
latest_readiness_receipt = "${readinessReceiptPath}"
next_proof = "Load the Blender add-on and capture a loaded-host receipt."
blocked_by = ["loaded host", "package proof", "checksum receipt", "signing receipt", "distribution review proof"]
`
  );
  writeWorkspaceFile("hosts/blender/dx-blender/dx.extension.toml", `[extension]\nid = "${adapterId}"\n`);
  writeWorkspaceFile("hosts/blender/dx-blender/__init__.py", "print('dx blender command center')\n");
  writeWorkspaceFile("hosts/blender/dx-blender/blender_manifest.toml", "id = \"dx_blender_command_center\"\n");
  writeWorkspaceFile("hosts/blender/dx-blender/panel.py", "print('dx blender command center')\n");
  writeWorkspaceFile(
    "registry/release-evidence-gates.toml",
    `
schema = "dx.release_evidence_gates"
manifest_version = 1

[[extensions]]
id = "${adapterId}"
stage = "not-release-ready"
required_evidence = ["host_execution", "package_output", "signing", "checksum", "distribution_review"]
evidence_receipt_requirements = ["host_execution=.dx/receipts/extensions/${adapterId}/loaded-host-latest.json", "package_output=${packageReceiptPath}", "signing=.dx/receipts/extensions/${adapterId}/signing-latest.json", "checksum=${checksumReceiptPath}", "distribution_review=.dx/receipts/extensions/${adapterId}/distribution-latest.json"]
evidence_receipts = [".dx/receipts/extensions/${adapterId}/loaded-host-latest.json", "${packageReceiptPath}", ".dx/receipts/extensions/${adapterId}/signing-latest.json", "${checksumReceiptPath}", ".dx/receipts/extensions/${adapterId}/distribution-latest.json"]
next_release_proof = "Load the Blender add-on and sign the public release package."
blocked_by = ["loaded host", "signing", "distribution review"]
`
  );
}

function writeReadinessReceipt(): void {
  writeJsonFile(readinessReceiptPath, {
    schema: "dx.extension_readiness.receipt",
    manifest_version: 1,
    extension_id: adapterId,
    readiness_stage: "source-level",
    generated_at: "2026-06-07T00:00:00.000Z",
    release_ready: false,
    loaded_host_verified: false,
    package_verified: false,
    signing_verified: false,
    checksum_verified: false,
    distribution_verified: false,
    blocked_by: ["loaded host", "package proof", "checksum proof"]
  });
}

function writePackageOutputReceipt(): void {
  const packageFile = readPackageFileProof("panel.py");
  const sourceInputs = readSourceInputProofs(packageRoot, ["__init__.py", "blender_manifest.toml"]);

  writeJsonFile(packageReceiptPath, {
    receipt: "dx.extension.blender.package_output",
    adapterId,
    host: "blender",
    package: {
      root: packageRoot,
      format: "blender-python-addon",
      fileCount: 1,
      sha256: hashPackageFiles([packageFile]),
      files: [packageFile]
    },
    inputs: ["__init__.py", "blender_manifest.toml"],
    sourceRoot: packageRoot,
    sourceInputs,
    sourceSha256: hashSourceInputs(sourceInputs),
    generatedAt: "2026-06-08T00:00:00.000Z",
    releaseClaims: {
      loadedHostVerified: false,
      localServiceVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      distributionVerified: false
    }
  });
}

function writeChecksumReceipt(): void {
  writeWorkspaceFile("release/dx-blender-command-center.zip", "public release package\n");
  const releaseArtifactBytes = readFileSync(releaseArtifactPath);

  writeJsonFile(checksumReceiptPath, {
    receipt: "dx.extension.release_package.checksum",
    adapterId,
    host: "blender",
    packageOutput: {
      receiptPath: join(workspaceRoot, ...packageReceiptPath.split("/")),
      receiptSha256: sha256(readFileSync(join(workspaceRoot, ...packageReceiptPath.split("/")))),
      packageOutputSha256: hashPackageFiles([readPackageFileProof("panel.py")]),
      fileCount: 1,
      filesVerified: 1
    },
    releaseArtifact: {
      path: releaseArtifactPath,
      kind: "zip",
      bytes: releaseArtifactBytes.length,
      sha256: sha256(releaseArtifactBytes),
      createdFromPackageOutput: true
    },
    checksum: {
      algorithm: "sha256",
      scope: "public-release-package",
      sha256: sha256(releaseArtifactBytes),
      bytes: releaseArtifactBytes.length
    },
    generatedAt: "2026-06-08T00:00:30.000Z",
    releaseClaims: {
      packageOutputVerified: true,
      publicReleasePackageVerified: true,
      releaseChecksumVerified: true,
      loadedHostVerified: false,
      signingVerified: false,
      distributionVerified: false
    }
  });
}

function writeLoadedHostPreflightReceipt(): void {
  writeJsonFile(`.dx/receipts/extensions/${adapterId}/loaded-host-preflight-latest.json`, {
    receipt: "dx.extension.loaded_host_preflight",
    adapterId,
    host: "blender",
    generatedAt: "2026-06-07T00:00:30.000Z",
    packageOutputReceiptPath: join(workspaceRoot, ...packageReceiptPath.split("/")),
    packageOutputReceiptSha256: "a".repeat(64),
    readiness: {
      stage: "source-level",
      nextProof: "Load the Blender add-on and capture a loaded-host receipt.",
      blockedBy: ["loaded host"]
    },
    preflightClaims: {
      hostExecuted: false,
      loadedHostVerified: false,
      releaseReady: false,
      marketplaceOrStoreVerified: false
    }
  });
}

function writeJsonFile(relativePath: string, value: unknown): void {
  writeWorkspaceFile(relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeWorkspaceFile(relativePath: string, source: string): void {
  const absolutePath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);
}

function readPackageFileProof(relativePath: string) {
  const bytes = readFileSync(join(packageRoot, ...relativePath.split("/")));

  return {
    relativePath,
    bytes: bytes.length,
    sha256: sha256(bytes)
  };
}

function hashPackageFiles(files: Array<{ relativePath: string; bytes: number; sha256: string }>): string {
  const hash = createHash("sha256");

  for (const file of files) {
    hash.update(file.relativePath);
    hash.update("\0");
    hash.update(file.sha256);
    hash.update("\0");
    hash.update(String(file.bytes));
    hash.update("\n");
  }

  return hash.digest("hex");
}

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}
