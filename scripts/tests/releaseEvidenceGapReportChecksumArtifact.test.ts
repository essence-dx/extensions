import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { writeReleaseEvidenceGapReport } from "../write-release-evidence-gap-report.ts";
import { hashSourceInputs, readSourceInputProofs } from "../lib/source-input-proof.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-release-gaps-checksum-artifact-"));
const adapterId = "dx.blender.command-center";
const host = "blender";
const packageReceiptPath = `.dx/receipts/extensions/${adapterId}/package-output-latest.json`;
const checksumReceiptPath = `.dx/receipts/extensions/${adapterId}/checksum-latest.json`;
const packageRoot = join(workspaceRoot, "hosts", "blender", "dx-blender");
const releaseArtifactPath = join(workspaceRoot, "release", "dx-blender-command-center.zip");

try {
  writeWorkspaceFixtures();
  writePackageOutputReceipt();
  writeReleaseArtifact("public release package\n");
  writeChecksumReceipt();

  const validReport = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-08T00:00:00.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });

  assert.equal(requirementByKind(validReport, "package_output").releaseValid, true);
  assert.equal(requirementByKind(validReport, "checksum").releaseValid, true);
  assert.deepEqual(extensionById(validReport).existingEvidence, ["checksum", "package_output"]);

  writeReleaseArtifact("mutated release package\n");
  const changedReport = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-08T00:00:30.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });

  assert.equal(requirementByKind(changedReport, "checksum").releaseValid, false);
  assert.match(
    requirementByKind(changedReport, "checksum").weakness ?? "",
    /checksum release artifact file size changed|checksum release artifact file hash changed/
  );
  assert.deepEqual(requirementByKind(changedReport, "checksum").remediation, {
    command: "npm run package:package-output-release-checksum:j1 -- -AdapterId dx.blender.command-center",
    proofSource: "workspace_artifact",
    requiresRealHost: false
  });
  assert.deepEqual(extensionById(changedReport).existingEvidence, ["package_output"]);
  assert.deepEqual(extensionById(changedReport).weakEvidence, ["checksum"]);

  rmSync(releaseArtifactPath);
  const missingReport = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-08T00:01:00.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });

  assert.equal(requirementByKind(missingReport, "checksum").releaseValid, false);
  assert.match(
    requirementByKind(missingReport, "checksum").weakness ?? "",
    /checksum release artifact file does not exist/
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("release checksum artifact current-state classification verified");

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
next_release_proof = "Load the Blender add-on in Blender and sign the public release package."
blocked_by = ["loaded host", "signing", "distribution review"]
`
  );
}

function writePackageOutputReceipt(): void {
  const packageFile = readPackageFileProof("panel.py");
  const sourceInputs = readSourceInputProofs(packageRoot, ["__init__.py", "blender_manifest.toml"]);

  writeJsonFile(packageReceiptPath, {
    receipt: "dx.extension.blender.package_output",
    adapterId,
    host,
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
  const releaseArtifactBytes = readFileSync(releaseArtifactPath);

  writeJsonFile(checksumReceiptPath, {
    receipt: "dx.extension.release_package.checksum",
    adapterId,
    host,
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

function requirementByKind(report: ReturnType<typeof writeReleaseEvidenceGapReport>, kind: string) {
  const requirement = extensionById(report).evidenceRequirements.find((entry) => entry.kind === kind);
  assert.ok(requirement, `${kind} requirement must exist`);

  return requirement;
}

function extensionById(report: ReturnType<typeof writeReleaseEvidenceGapReport>) {
  const extension = report.extensions.find((entry) => entry.id === adapterId);
  assert.ok(extension, "Blender gap entry must exist");

  return extension;
}

function writeJsonFile(relativePath: string, value: unknown): void {
  writeWorkspaceFile(relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeWorkspaceFile(relativePath: string, source: string): void {
  const absolutePath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);
}

function writeReleaseArtifact(source: string): void {
  mkdirSync(dirname(releaseArtifactPath), { recursive: true });
  writeFileSync(releaseArtifactPath, source);
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
