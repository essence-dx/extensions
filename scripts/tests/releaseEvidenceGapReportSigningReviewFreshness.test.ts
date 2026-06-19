import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { writeApplicationLoadedHostReceipt } from "../write-application-loaded-host-receipts.ts";
import { writeReleaseEvidenceGapReport } from "../write-release-evidence-gap-report.ts";
import { hashSourceInputs, readSourceInputProofs } from "../lib/source-input-proof.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-release-gaps-signing-review-"));
const adapterId = "dx.blender.command-center";
const host = "blender";
const packageReceiptPath = `.dx/receipts/extensions/${adapterId}/package-output-latest.json`;
const hostReceiptPath = `.dx/receipts/extensions/${adapterId}/loaded-host-latest.json`;
const checksumReceiptPath = `.dx/receipts/extensions/${adapterId}/checksum-latest.json`;
const signingReceiptPath = `.dx/receipts/extensions/${adapterId}/signing-latest.json`;
const reviewReceiptPath = `.dx/receipts/extensions/${adapterId}/marketplace-review-latest.json`;

try {
  const fixture = writeFixture();

  assert.equal(requirementByKind(writeReport(), "signing").releaseValid, true);
  assert.equal(requirementByKind(writeReport(), "distribution_review").releaseValid, true);
  assert.equal(requirementByKind(writeReport(), "marketplace_review").releaseValid, true);

  withMutatedFile(fixture.packageOutputReceiptPath, "{}\n", () => {
    assert.match(
      requirementByKind(writeReport(), "signing").weakness ?? "",
      /signing package-output receipt hash changed/
    );
  });

  withMutatedFile(fixture.checksumReceiptPath, "{}\n", () => {
    assert.match(
      requirementByKind(writeReport(), "signing").weakness ?? "",
      /signing checksum receipt hash changed/
    );
  });

  withMutatedFile(fixture.signedArtifactPath, "changed signed artifact\n", () => {
    assert.match(
      requirementByKind(writeReport(), "signing").weakness ?? "",
      /signing signed artifact file hash changed/
    );
  });

  withMutatedFile(fixture.signatureFilePath, "changed signature\n", () => {
    assert.match(
      requirementByKind(writeReport(), "signing").weakness ?? "",
      /signing signature file hash changed/
    );
  });

  withMutatedFile(fixture.verificationOutputPath, "changed verification output\n", () => {
    assert.match(
      requirementByKind(writeReport(), "signing").weakness ?? "",
      /signing signature verification output file hash changed/
    );
  });

  withMutatedFile(fixture.signingReceiptPath, "{}\n", () => {
    assert.match(
      requirementByKind(writeReport(), "distribution_review").weakness ?? "",
      /distribution review signing receipt hash changed/
    );
  });

  withMutatedFile(fixture.checksumReceiptPath, "{}\n", () => {
    assert.match(
      requirementByKind(writeReport(), "distribution_review").weakness ?? "",
      /distribution review checksum receipt hash changed/
    );
  });

  withMutatedFile(fixture.reviewProofFilePath, "changed review proof\n", () => {
    assert.match(
      requirementByKind(writeReport(), "marketplace_review").weakness ?? "",
      /distribution review manual proof file hash changed/
    );
  });

  withWeakLinkedReviewSupportReceipts(fixture, () => {
    assert.match(
      requirementByKind(writeReport(), "distribution_review").weakness ?? "",
      /distribution review signing receipt is weak: signing receipt is missing package output checksum linkage/
    );
  });

  withWeakLinkedSigningChecksumReceipt(fixture, () => {
    assert.match(
      requirementByKind(writeReport(), "signing").weakness ?? "",
      /signing checksum receipt is weak: checksum receipt is missing package-output receipt linkage/
    );
  });

  withMutatedReviewReceipt((receipt) => {
    receipt.review.reviewStatus = "submitted";
  }, () => {
    assert.match(
      requirementByKind(writeReport(), "distribution_review").weakness ?? "",
      /review receipt status must be approved/
    );
  });

  withMutatedReviewReceipt((receipt) => {
    receipt.review.reviewKind = "distribution_review";
  }, () => {
    assert.match(
      requirementByKind(writeReport(), "marketplace_review").weakness ?? "",
      /primary review kind does not cover the required review kind/
    );
  });

  withMutatedReviewReceipt((receipt) => {
    delete receipt.review.reviewRecordSha256;
  }, () => {
    assert.match(
      requirementByKind(writeReport(), "distribution_review").weakness ?? "",
      /review receipt must carry submission and review record hashes/
    );
  });

  writeReleaseReadyGate();
  writeBlockedEnvironmentReceipts(fixture);
  const blockedEnvironmentReport = writeReport();
  const blockedEnvironmentExtension = extensionById(blockedEnvironmentReport);

  assert.equal(requirementByKind(blockedEnvironmentReport, "host_execution").releaseValid, true);
  assert.equal(requirementByKind(blockedEnvironmentReport, "package_output").releaseValid, true);
  assert.equal(requirementByKind(blockedEnvironmentReport, "checksum").releaseValid, true);
  assert.equal(requirementByKind(blockedEnvironmentReport, "signing").releaseValid, true);
  assert.equal(requirementByKind(blockedEnvironmentReport, "distribution_review").releaseValid, true);
  assert.deepEqual(blockedEnvironmentExtension.missingEvidence, []);
  assert.deepEqual(blockedEnvironmentExtension.weakEvidence, []);
  assert.equal(blockedEnvironmentExtension.environment.blockers.length, 3);
  assert.deepEqual(blockedEnvironmentExtension.blockedBy, [
    "environment blocker: host discovery: host_application_unavailable",
    "environment blocker: loaded-host preflight: Fixture host launch proof",
    "environment blocker: missing required tool: blender"
  ]);
  assert.equal(blockedEnvironmentExtension.releaseReady, false);
  assert.equal(blockedEnvironmentReport.summary.releaseReady, 0);
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("release evidence signing and review freshness verified");

function writeFixture() {
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
professional_targets = ["blender"]
`
  );
  writeWorkspaceFile("hosts/blender/dx-blender/dx.extension.toml", `[extension]\nid = "${adapterId}"\n`);
  writeWorkspaceFile(
    "registry/release-evidence-gates.toml",
    `
schema = "dx.release_evidence_gates"
manifest_version = 1

[[extensions]]
id = "${adapterId}"
stage = "not-release-ready"
required_evidence = ["host_execution", "package_output", "signing", "checksum", "distribution_review", "marketplace_review"]
evidence_receipt_requirements = ["host_execution=${hostReceiptPath}", "package_output=${packageReceiptPath}", "signing=${signingReceiptPath}", "checksum=${checksumReceiptPath}", "distribution_review=${reviewReceiptPath}", "marketplace_review=${reviewReceiptPath}"]
evidence_receipts = ["${hostReceiptPath}", "${packageReceiptPath}", "${signingReceiptPath}", "${checksumReceiptPath}", "${reviewReceiptPath}"]
next_release_proof = "Keep signing and marketplace approval evidence current."
blocked_by = ["stale signing proof", "stale marketplace review proof"]
`
  );

  const packageRoot = join(workspaceRoot, "package");
  writeWorkspaceFile("package/__init__.py", "print('dx blender command center')\n");
  writeWorkspaceFile("package/blender_manifest.toml", "id = \"dx_blender_command_center\"\n");
  writeWorkspaceFile("package/entrypoint.txt", "package entrypoint\n");
  const packageFile = readPackageFileProof(packageRoot, "entrypoint.txt");
  const sourceInputs = readSourceInputProofs(packageRoot, ["__init__.py", "blender_manifest.toml"]);
  const packageOutputSha256 = hashPackageFiles([packageFile]);
  const packageOutputReceiptPath = writeJsonFile(packageReceiptPath, {
    receipt: "dx.extension.blender.package_output",
    adapterId,
    host,
    package: {
      root: packageRoot,
      format: "fixture-source-layout",
      fileCount: 1,
      sha256: packageOutputSha256,
      files: [packageFile]
    },
    inputs: ["__init__.py", "blender_manifest.toml"],
    sourceRoot: packageRoot,
    sourceInputs,
    sourceSha256: hashSourceInputs(sourceInputs),
    releaseClaims: {
      loadedHostVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      distributionVerified: false
    }
  });
  const loadedHostProofFilePath = writeWorkspaceFile("proofs/blender-loaded-host.txt", "Blender add-on loaded\n");
  const hostExecutablePath = writeWorkspaceFile("bin/blender.exe", "blender executable\n");

  writeApplicationLoadedHostReceipt(workspaceRoot, {
    generatedAt: "2026-06-08T00:00:00.000Z",
    verificationCommand: "npm run smoke:application-loaded-host:j1",
    proof: {
      target: "blender",
      hostApplication: "Blender",
      hostVersion: "4.3.0",
      hostExecutablePath,
      packageOutputReceiptPath,
      proofFilePath: loadedHostProofFilePath,
      verificationMode: "blender-addon",
      loadedHostVerified: true,
      extensionInstalled: true,
      commandIdsVisible: ["dx.show_status", "dx.run_doctor", "dx.open_receipts"],
      commandResults: [
        { commandId: "dx.show_status", status: "visible" },
        { commandId: "dx.run_doctor", status: "proof-blocked" },
        { commandId: "dx.open_receipts", status: "visible" }
      ],
      localServiceRequestsBlocked: true,
      hostState: "loaded",
      mutatesHostDocument: false,
      extensionId: "dx_blender_command_center",
      addonInstalled: true
    }
  });
  const signedArtifactPath = writeWorkspaceFile("release/dx-blender-command-center.zip", "signed artifact\n");
  const signedArtifactSha256 = sha256(readFileSync(signedArtifactPath));
  const checksumReceiptAbsolutePath = writeJsonFile(checksumReceiptPath, {
    receipt: "dx.extension.release_package.checksum",
    adapterId,
    host,
    packageOutput: {
      receiptPath: packageOutputReceiptPath,
      receiptSha256: sha256(readFileSync(packageOutputReceiptPath)),
      packageOutputSha256,
      fileCount: 1,
      filesVerified: 1
    },
    releaseArtifact: {
      path: signedArtifactPath,
      kind: "zip",
      bytes: readFileSync(signedArtifactPath).length,
      sha256: signedArtifactSha256,
      createdFromPackageOutput: true
    },
    checksum: {
      algorithm: "sha256",
      scope: "public-release-package",
      sha256: signedArtifactSha256,
      bytes: readFileSync(signedArtifactPath).length
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
  const signatureFilePath = writeWorkspaceFile("release/dx-blender-command-center.zip.sig", "signature\n");
  const verificationOutputPath = writeWorkspaceFile("release/signature-verification.txt", "signature verified\n");
  const signingReceiptAbsolutePath = writeJsonFile(signingReceiptPath, {
    receipt: "dx.extension.package.signing",
    adapterId,
    host,
    packageOutput: {
      receiptPath: packageOutputReceiptPath,
      receiptSha256: sha256(readFileSync(packageOutputReceiptPath)),
      checksumReceiptPath: checksumReceiptAbsolutePath,
      checksumReceiptSha256: sha256(readFileSync(checksumReceiptAbsolutePath)),
      packageOutputSha256
    },
    signedArtifact: {
      path: signedArtifactPath,
      sha256: signedArtifactSha256
    },
    signature: {
      path: signatureFilePath,
      sha256: sha256(readFileSync(signatureFilePath)),
      tool: "gpg",
      verificationCommand: "gpg --verify dx-blender-command-center.zip.sig dx-blender-command-center.zip",
      verificationOutputPath,
      verificationOutputSha256: sha256(readFileSync(verificationOutputPath)),
      signerName: "DX Release Engineering",
      certificateFingerprintSha256: "a".repeat(64),
      verified: true
    },
    releaseClaims: {
      packageOutputVerified: true,
      releaseChecksumVerified: true,
      signingVerified: true,
      loadedHostVerified: false,
      distributionVerified: false,
      publicReleasePackageVerified: true
    }
  });
  const reviewProofFilePath = writeWorkspaceFile("proofs/marketplace-review.txt", "marketplace approval\n");
  writeJsonFile(reviewReceiptPath, {
    receipt: "dx.extension.distribution_review",
    adapterId,
    host,
    review: {
      reviewKind: "marketplace_review",
      reviewKinds: ["distribution_review", "marketplace_review"],
      reviewSystem: "Fixture Marketplace",
      reviewStatus: "approved",
      decidedAt: "2026-06-08T00:00:00.000Z",
      submissionIdSha256: "b".repeat(64),
      reviewRecordSha256: "c".repeat(64),
      publicListingHost: "marketplace.example"
    },
    manualProof: {
      proofFilePath: reviewProofFilePath,
      proofFileSha256: sha256(readFileSync(reviewProofFilePath))
    },
    linkedReceipts: {
      signingReceiptPath: signingReceiptAbsolutePath,
      signingReceiptSha256: sha256(readFileSync(signingReceiptAbsolutePath)),
      checksumReceiptPath: checksumReceiptAbsolutePath,
      checksumReceiptSha256: sha256(readFileSync(checksumReceiptAbsolutePath))
    },
    releaseClaims: {
      reviewVerified: true,
      distributionVerified: true,
      oauthReviewVerified: false,
      signingVerified: true,
      releaseChecksumVerified: true,
      publicReleasePackageVerified: true
    }
  });

  return {
    packageOutputReceiptPath,
    checksumReceiptPath: checksumReceiptAbsolutePath,
    signingReceiptPath: signingReceiptAbsolutePath,
    signedArtifactPath,
    signatureFilePath,
    verificationOutputPath,
    reviewProofFilePath
  };
}

function writeReleaseReadyGate(): void {
  writeWorkspaceFile(
    "registry/extension-readiness.toml",
    `
schema = "dx.extension_readiness"
manifest_version = 1

[[extensions]]
id = "${adapterId}"
stage = "release-ready"
manifest = "hosts/blender/dx-blender/dx.extension.toml"
source_guard = "test:blender-adapter"
latest_readiness_receipt = ".dx/receipts/extensions/${adapterId}/readiness-latest.json"
next_proof = "Environment must be clear before release."
blocked_by = []
loaded_host_receipt = "${hostReceiptPath}"
package_receipt = "${packageReceiptPath}"
signing_receipt = "${signingReceiptPath}"
checksum_receipt = "${checksumReceiptPath}"
distribution_receipt = "${reviewReceiptPath}"
`
  );
  writeWorkspaceFile(
    "registry/release-evidence-gates.toml",
    `
schema = "dx.release_evidence_gates"
manifest_version = 1

[[extensions]]
id = "${adapterId}"
stage = "release-ready"
required_evidence = ["host_execution", "package_output", "signing", "checksum", "distribution_review"]
evidence_receipt_requirements = ["host_execution=${hostReceiptPath}", "package_output=${packageReceiptPath}", "signing=${signingReceiptPath}", "checksum=${checksumReceiptPath}", "distribution_review=${reviewReceiptPath}"]
evidence_receipts = ["${hostReceiptPath}", "${packageReceiptPath}", "${signingReceiptPath}", "${checksumReceiptPath}", "${reviewReceiptPath}"]
next_release_proof = "Environment must be clear before release."
blocked_by = []
`
  );
}

function writeBlockedEnvironmentReceipts(fixture: ReturnType<typeof writeFixture>): void {
  writeJsonFile(`.dx/receipts/extensions/${adapterId}/host-discovery-latest.json`, {
    receipt: "dx.extension.platform_host_discovery",
    adapterId,
    discoveryMode: "local-tooling",
    host,
    status: "missing",
    reason: "host_application_unavailable",
    candidateFound: false,
    missingRequiredTools: ["blender"],
    preflightClaims: {
      hostExecuted: false,
      loadedHostVerified: false,
      releaseReady: false
    }
  });
  writeJsonFile(`.dx/receipts/extensions/${adapterId}/loaded-host-preflight-latest.json`, {
    receipt: "dx.extension.loaded_host_preflight",
    adapterId,
    host,
    packageOutputReceiptPath: fixture.packageOutputReceiptPath,
    packageOutputReceiptSha256: sha256(readFileSync(fixture.packageOutputReceiptPath)),
    readiness: {
      nextProof: "Launch fixture host.",
      blockedBy: ["Fixture host launch proof"]
    },
    preflightClaims: {
      hostExecuted: false,
      loadedHostVerified: false,
      releaseReady: false,
      marketplaceOrStoreVerified: true
    }
  });
}

function writeReport() {
  return writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-08T00:00:00.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });
}

function extensionById(report: ReturnType<typeof writeReleaseEvidenceGapReport>) {
  const extension = report.extensions.find((entry) => entry.id === adapterId);
  assert.ok(extension, "fixture gap entry must exist");

  return extension;
}

function requirementByKind(
  report: ReturnType<typeof writeReleaseEvidenceGapReport>,
  kind: string
) {
  const extension = report.extensions.find((entry) => entry.id === adapterId);
  assert.ok(extension, "fixture gap entry must exist");

  const requirement = extension.evidenceRequirements.find((entry) => entry.kind === kind);
  assert.ok(requirement, `fixture must include ${kind} requirement`);

  return requirement;
}

function withMutatedFile(path: string, source: string, assertion: () => void): void {
  const originalSource = readFileSync(path, "utf8");
  writeFileSync(path, source);

  try {
    assertion();
  } finally {
    writeFileSync(path, originalSource);
  }
}

function withWeakLinkedReviewSupportReceipts(
  fixture: ReturnType<typeof writeFixture>,
  assertion: () => void
): void {
  const originalSigningSource = readFileSync(fixture.signingReceiptPath, "utf8");
  const originalChecksumSource = readFileSync(fixture.checksumReceiptPath, "utf8");
  const originalReviewSource = readFileSync(join(workspaceRoot, ...reviewReceiptPath.split("/")), "utf8");
  const weakSigningSource = `${JSON.stringify(
    {
      receipt: "dx.extension.package.signing",
      adapterId,
      host,
      releaseClaims: {
        packageOutputVerified: true,
        publicReleasePackageVerified: true,
        releaseChecksumVerified: true,
        signingVerified: true
      }
    },
    null,
    2
  )}\n`;
  const weakChecksumSource = `${JSON.stringify(
    {
      receipt: "dx.extension.release_package.checksum",
      adapterId,
      host,
      releaseClaims: {
        packageOutputVerified: true,
        publicReleasePackageVerified: true,
        releaseChecksumVerified: true
      }
    },
    null,
    2
  )}\n`;
  const reviewReceipt = JSON.parse(originalReviewSource) as {
    linkedReceipts: {
      signingReceiptSha256: string;
      checksumReceiptSha256: string;
    };
  };

  writeFileSync(fixture.signingReceiptPath, weakSigningSource);
  writeFileSync(fixture.checksumReceiptPath, weakChecksumSource);
  reviewReceipt.linkedReceipts.signingReceiptSha256 = sha256(weakSigningSource);
  reviewReceipt.linkedReceipts.checksumReceiptSha256 = sha256(weakChecksumSource);
  writeFileSync(join(workspaceRoot, ...reviewReceiptPath.split("/")), `${JSON.stringify(reviewReceipt, null, 2)}\n`);

  try {
    assertion();
  } finally {
    writeFileSync(fixture.signingReceiptPath, originalSigningSource);
    writeFileSync(fixture.checksumReceiptPath, originalChecksumSource);
    writeFileSync(join(workspaceRoot, ...reviewReceiptPath.split("/")), originalReviewSource);
  }
}

function withWeakLinkedSigningChecksumReceipt(
  fixture: ReturnType<typeof writeFixture>,
  assertion: () => void
): void {
  const originalSigningSource = readFileSync(fixture.signingReceiptPath, "utf8");
  const originalChecksumSource = readFileSync(fixture.checksumReceiptPath, "utf8");
  const signingReceipt = JSON.parse(originalSigningSource) as {
    packageOutput: {
      checksumReceiptSha256: string;
    };
  };
  const checksumReceipt = JSON.parse(originalChecksumSource) as {
    packageOutput: {
      receiptSha256?: string;
    };
  };

  delete checksumReceipt.packageOutput.receiptSha256;
  const weakChecksumSource = `${JSON.stringify(checksumReceipt, null, 2)}\n`;
  signingReceipt.packageOutput.checksumReceiptSha256 = sha256(weakChecksumSource);
  writeFileSync(fixture.checksumReceiptPath, weakChecksumSource);
  writeFileSync(fixture.signingReceiptPath, `${JSON.stringify(signingReceipt, null, 2)}\n`);

  try {
    assertion();
  } finally {
    writeFileSync(fixture.signingReceiptPath, originalSigningSource);
    writeFileSync(fixture.checksumReceiptPath, originalChecksumSource);
  }
}

function withMutatedReviewReceipt(
  mutate: (receipt: MutableReviewReceipt) => void,
  assertion: () => void
): void {
  const reviewReceiptAbsolutePath = join(workspaceRoot, ...reviewReceiptPath.split("/"));
  const originalSource = readFileSync(reviewReceiptAbsolutePath, "utf8");
  const receipt = JSON.parse(originalSource) as MutableReviewReceipt;

  mutate(receipt);
  writeFileSync(reviewReceiptAbsolutePath, `${JSON.stringify(receipt, null, 2)}\n`);

  try {
    assertion();
  } finally {
    writeFileSync(reviewReceiptAbsolutePath, originalSource);
  }
}

interface MutableReviewReceipt {
  review: Record<string, unknown>;
}

function writeJsonFile(relativePath: string, value: unknown): string {
  return writeWorkspaceFile(relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeWorkspaceFile(relativePath: string, source: string): string {
  const absolutePath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);

  return absolutePath;
}

function readPackageFileProof(packageRoot: string, relativePath: string) {
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
