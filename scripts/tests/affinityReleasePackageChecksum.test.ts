import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";

import { buildAffinityReleasePackage } from "../build-affinity-release-package.ts";
import { writeAffinityContentPackageReceipt } from "../write-affinity-content-package-receipt.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-affinity-release-package-"));
const repositoryRoot = join(import.meta.dirname, "..", "..");
const adapterId = "dx.affinity-content.bridge";
const contentPackageReceiptPath = `.dx/receipts/extensions/${adapterId}/affinity-content-release-source.json`;
const proofPath = join(workspaceRoot, ".tmp", "proofs", "affinity-release-package-checksum.json");
const artifactRoot = join(workspaceRoot, ".tmp", "release-packages", "affinity");

try {
  const packageOutputSha256 = writeContentPackageFixture();
  const result = buildAffinityReleasePackage(workspaceRoot, {
    artifactRoot,
    proofPath
  });

  assert.equal(result.proofPath, proofPath);
  assert.equal(result.artifact.path, join(artifactRoot, "dx-affinity-content-bridge.zip"));
  assert.equal(existsSync(result.artifact.path), true);
  assert.equal(result.artifact.entries, 4);
  assert.equal(result.proof.adapterId, adapterId);
  assert.equal(result.proof.host, "affinity");
  assert.equal(result.proof.packageOutputReceiptPath, join(workspaceRoot, ...contentPackageReceiptPath.split("/")));
  assert.equal(result.proof.packageOutputSha256, packageOutputSha256);
  assert.equal(result.proof.releaseArtifactKind, "zip");
  assert.equal(result.proof.artifactCreatedFromPackageOutput, true);
  assert.equal(isAbsolute(result.proof.packageOutputReceiptPath), true);
  assert.equal(isAbsolute(result.proof.releaseArtifactPath), true);
  assert.equal(result.proof.releaseArtifactSha256, sha256(readFileSync(result.artifact.path)));
  assert.deepEqual(JSON.parse(readFileSync(proofPath, "utf8")), result.proof);

  const artifactBytes = readFileSync(result.artifact.path);
  assert.equal(artifactBytes.subarray(0, 4).toString("binary"), "PK\u0003\u0004");
  assert.notEqual(artifactBytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])), -1);
  assert.notEqual(artifactBytes.indexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])), -1);

  const wrapperSource = readFileSync(
    join(repositoryRoot, "scripts", "package-affinity-release-checksum-j1.ps1"),
    "utf8"
  );
  assert.match(wrapperSource, /Set-DxSerialBuildEnvironment/);
  assert.match(wrapperSource, /Assert-NoCompetingHeavyProcess/);
  assert.match(wrapperSource, /DX_RELEASE_PACKAGE_CHECKSUM_PROOF_JSON/);
  assert.match(wrapperSource, /build-affinity-release-package\.ts/);
  assert.match(wrapperSource, /smoke:release-package-checksum:j1/);
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("Affinity release package checksum workflow verified");

function writeContentPackageFixture(): string {
  const adapterRoot = join(workspaceRoot, "hosts", "affinity", "dx-affinity-content");
  const packageRoot = join(workspaceRoot, "hosts", "affinity", "dx-affinity-content", "dist", "content-package");
  const manifestSource = JSON.stringify(
    {
      name: "DX Affinity Content Bridge",
      supportedHosts: ["Affinity Photo 2"],
      supportedContentTypes: [{ type: "swatches", extensions: [".ase"] }]
    },
    null,
    2
  );
  writeWorkspaceFile("hosts/affinity/dx-affinity-content/src/contentPlans.ts", "export const contentPlans = [];\n");
  writeWorkspaceFile("hosts/affinity/dx-affinity-content/src/importGuide.ts", "export const importGuide = 'Import DX content.';\n");
  writeWorkspaceFile("hosts/affinity/dx-affinity-content/affinity-content-manifest.json", manifestSource);
  const files = [
    writePackageFile(packageRoot, "README.md", "DX Affinity Content Bridge\n"),
    writePackageFile(packageRoot, "affinity-content-manifest.json", manifestSource),
    writePackageFile(packageRoot, "metadata/dx-content-package.json", "{}\n"),
    writePackageFile(packageRoot, "swatches/dx-core.ase", "ASE\n")
  ];

  writeWorkspaceFile(
    "registry/release-evidence-gates.toml",
    `
schema = "dx.release_evidence_gates"
manifest_version = 1

[[extensions]]
id = "${adapterId}"
stage = "not-release-ready"
required_evidence = ["host_execution", "package_output", "signing", "checksum", "distribution_review", "manual_import", "content_package", "photoshop_filter_plugin"]
evidence_receipt_requirements = ["host_execution=.dx/receipts/extensions/${adapterId}/loaded-app-latest.json", "manual_import=.dx/receipts/extensions/${adapterId}/manual-import-latest.json", "photoshop_filter_plugin=.dx/receipts/extensions/${adapterId}/photoshop-filter-plugin-latest.json", "package_output=${contentPackageReceiptPath}", "content_package=${contentPackageReceiptPath}", "signing=.dx/receipts/extensions/${adapterId}/signing-latest.json", "checksum=.dx/receipts/extensions/${adapterId}/checksum-latest.json", "distribution_review=.dx/receipts/extensions/${adapterId}/distribution-latest.json"]
evidence_receipts = [".dx/receipts/extensions/${adapterId}/loaded-app-latest.json", ".dx/receipts/extensions/${adapterId}/manual-import-latest.json", ".dx/receipts/extensions/${adapterId}/photoshop-filter-plugin-latest.json", "${contentPackageReceiptPath}", ".dx/receipts/extensions/${adapterId}/signing-latest.json", ".dx/receipts/extensions/${adapterId}/checksum-latest.json", ".dx/receipts/extensions/${adapterId}/distribution-latest.json"]
next_release_proof = "Import DX content assets manually into Affinity apps and capture Photoshop-compatible filter plugin proof."
blocked_by = ["manual import proof", "Photoshop-compatible filter plugin proof"]
`
  );
  const receipt = writeAffinityContentPackageReceipt({
    adapterRoot,
    packageRoot,
    receiptPath: join(workspaceRoot, ...contentPackageReceiptPath.split("/")),
    generatedAt: "2026-06-08T00:00:00.000Z",
    verificationCommand: "npm run package:affinity-content:j1"
  });

  assert.deepEqual(receipt.package.files, files);

  return receipt.package.sha256;
}

function writePackageFile(packageRoot: string, relativePath: string, source: string) {
  const targetPath = join(packageRoot, ...relativePath.split("/"));
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, source);
  const bytes = readFileSync(targetPath);

  return {
    relativePath,
    bytes: bytes.length,
    sha256: sha256(bytes)
  };
}

function writeWorkspaceFile(relativePath: string, source: string): string {
  const targetPath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, source);

  return targetPath;
}

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}
