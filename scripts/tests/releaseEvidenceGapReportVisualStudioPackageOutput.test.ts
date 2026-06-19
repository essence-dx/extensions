import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { writeZipArtifactProof } from "../lib/package-artifact-proof.ts";
import { writeReleaseEvidenceGapReport } from "../write-release-evidence-gap-report.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-release-gaps-visual-studio-package-output-"));
const adapterId = "dx.visual-studio.command-center";
const packageReceiptPath = `.dx/receipts/extensions/${adapterId}/package-output-latest.json`;
const checksumReceiptPath = `.dx/receipts/extensions/${adapterId}/checksum-latest.json`;
const packageRoot = join(workspaceRoot, "hosts", "visual-studio", "dx-visual-studio");
const packageOutputReceiptAbsolutePath = join(workspaceRoot, ...packageReceiptPath.split("/"));
const releaseArtifactPath = join(workspaceRoot, "release", "dx-visual-studio-command-center.zip");
const vsixPath = join(packageRoot, "dx-visual-studio-0.1.0.vsix");

try {
  writeWorkspaceFixtures();
  const packageFile = readPackageFileProof("source.extension.vsixmanifest");

  writeJsonFile(packageReceiptPath, {
    receipt: "dx.extension.visual_studio.package_output",
    adapterId,
    host: "visual-studio",
    package: {
      root: packageRoot,
      format: "visual-studio-vsix-source-layout",
      fileCount: 1,
      sha256: hashPackageFiles([packageFile]),
      files: [packageFile]
    },
    vsixManifest: {
      identityId: "dev.dx.visual-studio.command-center",
      version: "0.1.0",
      publisher: "DX",
      displayName: "DX Visual Studio Command Center",
      targetVersion: "[17.0,18.0)",
      assetType: "Microsoft.VisualStudio.VsPackage"
    },
    commandPlans: {
      commandCount: 3,
      mutatesSolution: false,
      localServiceProofRequired: true
    },
    releaseClaims: releaseClaims()
  });
  writeReleaseArtifact("visual studio source-layout release package\n");
  writeChecksumReceipt(hashPackageFiles([packageFile]));

  const sourceLayoutReport = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-08T00:00:00.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });
  const sourceLayoutRequirement = packageOutputRequirement(sourceLayoutReport);
  const sourceLayoutChecksumRequirement = requirementByKind(sourceLayoutReport, "checksum");
  const sourceLayoutExperimentalInstanceRequirement = requirementByKind(sourceLayoutReport, "experimental_instance");

  assert.equal(sourceLayoutRequirement.releaseValid, false);
  assert.match(
    sourceLayoutRequirement.weakness ?? "",
    /Visual Studio package-output receipt is missing VSIX package proof/
  );
  assert.equal(sourceLayoutChecksumRequirement.releaseValid, false);
  assert.match(
    sourceLayoutChecksumRequirement.weakness ?? "",
    /checksum linked package-output receipt is weak/
  );
  assert.deepEqual(sourceLayoutExperimentalInstanceRequirement.remediation, {
    command: "npm run smoke:ide-game-engine-loaded-host:j1",
    proofSource: "host_application",
    requiresRealHost: true
  });

  writeWorkspaceBytes(
    "hosts/visual-studio/dx-visual-studio/dx-visual-studio-0.1.0.vsix",
    Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 9, 8, 7, 6])
  );
  const vsixBytes = readFileSync(vsixPath);

  writeJsonFile(packageReceiptPath, {
    receipt: "dx.extension.visual_studio.package_output",
    adapterId,
    host: "visual-studio",
    package: {
      root: packageRoot,
      format: "visual-studio-vsix-source-layout",
      fileCount: 1,
      sha256: hashPackageFiles([packageFile]),
      files: [packageFile]
    },
    vsix: {
      path: vsixPath,
      fileName: "dx-visual-studio-0.1.0.vsix",
      bytes: vsixBytes.length,
      sha256: sha256(vsixBytes),
      zipHeaderVerified: true
    },
    vsixManifest: {
      identityId: "dev.dx.visual-studio.command-center",
      version: "0.1.0",
      publisher: "DX",
      displayName: "DX Visual Studio Command Center",
      targetVersion: "[17.0,18.0)",
      assetType: "Microsoft.VisualStudio.VsPackage"
    },
    commandPlans: {
      commandCount: 3,
      mutatesSolution: false,
      localServiceProofRequired: true
    },
    releaseClaims: releaseClaims()
  });
  writeChecksumReceipt(hashPackageFiles([packageFile]));

  const vsixReport = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-08T00:00:30.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });

  assert.equal(packageOutputRequirement(vsixReport).releaseValid, false);
  assert.match(
    packageOutputRequirement(vsixReport).weakness ?? "",
    /archive is not readable package content/
  );
  assert.equal(requirementByKind(vsixReport, "checksum").releaseValid, false);

  const realVsixProof = writeZipArtifactProof(vsixPath, [
    {
      relativePath: "source.extension.vsixmanifest",
      sourcePath: join(packageRoot, "source.extension.vsixmanifest")
    }
  ]);
  writeJsonFile(packageReceiptPath, {
    receipt: "dx.extension.visual_studio.package_output",
    adapterId,
    host: "visual-studio",
    package: {
      root: packageRoot,
      format: "visual-studio-vsix-source-layout",
      fileCount: 1,
      sha256: hashPackageFiles([packageFile]),
      files: [packageFile]
    },
    vsix: realVsixProof,
    vsixManifest: {
      identityId: "dev.dx.visual-studio.command-center",
      version: "0.1.0",
      publisher: "DX",
      displayName: "DX Visual Studio Command Center",
      targetVersion: "[17.0,18.0)",
      assetType: "Microsoft.VisualStudio.VsPackage"
    },
    commandPlans: {
      commandCount: 3,
      mutatesSolution: false,
      localServiceProofRequired: true
    },
    releaseClaims: releaseClaims()
  });
  writeChecksumReceipt(hashPackageFiles([packageFile]));

  const realVsixReport = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-08T00:00:45.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });

  assert.equal(packageOutputRequirement(realVsixReport).releaseValid, true);
  assert.equal(requirementByKind(realVsixReport, "checksum").releaseValid, true);
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("Visual Studio package-output release evidence classification verified");

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
  writeWorkspaceFile("hosts/visual-studio/dx-visual-studio/dx.extension.toml", `[extension]\nid = "${adapterId}"\n`);
  writeWorkspaceFile("hosts/visual-studio/dx-visual-studio/source.extension.vsixmanifest", "<PackageManifest />\n");
  writeWorkspaceFile(
    "registry/release-evidence-gates.toml",
    `
schema = "dx.release_evidence_gates"
manifest_version = 1

[[extensions]]
id = "${adapterId}"
stage = "not-release-ready"
required_evidence = ["host_execution", "experimental_instance", "package_output", "signing", "checksum", "distribution_review"]
evidence_receipt_requirements = ["host_execution=.dx/receipts/extensions/${adapterId}/experimental-instance-latest.json", "experimental_instance=.dx/receipts/extensions/${adapterId}/experimental-instance-latest.json", "package_output=${packageReceiptPath}", "signing=.dx/receipts/extensions/${adapterId}/signing-latest.json", "checksum=${checksumReceiptPath}", "distribution_review=.dx/receipts/extensions/${adapterId}/marketplace-review-latest.json"]
evidence_receipts = [".dx/receipts/extensions/${adapterId}/experimental-instance-latest.json", "${packageReceiptPath}", ".dx/receipts/extensions/${adapterId}/signing-latest.json", "${checksumReceiptPath}", ".dx/receipts/extensions/${adapterId}/marketplace-review-latest.json"]
next_release_proof = "Build signed VSIX and launch Visual Studio Experimental Instance."
blocked_by = ["VSIX package proof", "Experimental Instance proof", "Marketplace review"]
`
  );
}

function packageOutputRequirement(report: ReturnType<typeof writeReleaseEvidenceGapReport>) {
  const extension = report.extensions.find((entry) => entry.id === adapterId);
  assert.ok(extension, "Visual Studio gap entry must exist.");

  const requirement = extension.evidenceRequirements.find((entry) => entry.kind === "package_output");
  assert.ok(requirement, "Visual Studio must include package_output requirement.");

  return requirement;
}

function requirementByKind(report: ReturnType<typeof writeReleaseEvidenceGapReport>, kind: string) {
  const extension = report.extensions.find((entry) => entry.id === adapterId);
  assert.ok(extension, "Visual Studio gap entry must exist.");

  const requirement = extension.evidenceRequirements.find((entry) => entry.kind === kind);
  assert.ok(requirement, `Visual Studio must include ${kind} requirement.`);

  return requirement;
}

function releaseClaims() {
  return {
    loadedExperimentalInstanceVerified: false,
    vsixPackageVerified: false,
    localServiceVerified: false,
    signingVerified: false,
    releaseChecksumVerified: false,
    marketplaceReviewVerified: false,
    distributionVerified: false
  };
}

function writeJsonFile(relativePath: string, value: unknown): void {
  writeWorkspaceFile(relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeChecksumReceipt(packageOutputSha256: string): void {
  const releaseArtifactBytes = readFileSync(releaseArtifactPath);

  writeJsonFile(checksumReceiptPath, {
    receipt: "dx.extension.release_package.checksum",
    adapterId,
    host: "visual-studio",
    packageOutput: {
      receiptPath: packageOutputReceiptAbsolutePath,
      receiptSha256: sha256(readFileSync(packageOutputReceiptAbsolutePath)),
      packageOutputSha256,
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

function writeWorkspaceFile(relativePath: string, source: string): void {
  const absolutePath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);
}

function writeWorkspaceBytes(relativePath: string, source: Uint8Array): void {
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
