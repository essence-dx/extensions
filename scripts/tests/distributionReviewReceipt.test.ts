import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  browserPackageSourceInputs,
  hashSourceInputs,
  readSourceInputProofs
} from "../lib/source-input-proof.ts";
import { writeDistributionReviewReceipt } from "../write-distribution-review-receipts.ts";
import { writePackageSigningReceipt } from "../write-package-signing-receipts.ts";
import { writeReleasePackageChecksumReceipt } from "../write-release-package-checksum-receipts.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-distribution-review-"));

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

[[extensions]]
id = "dx.browser.command-center"
name = "DX Browser Command Center"
path = "hosts/browser/dx-browser"
manifest = "hosts/browser/dx-browser/dx.extension.toml"
status = "experimental"
professional_targets = ["browser.chrome", "browser.edge", "browser.firefox"]
`
  );
  writeWorkspaceFile("hosts/alpha/dx.extension.toml", "[extension]\nid = \"dx.alpha.command-center\"\n");
  writeWorkspaceFile("hosts/beta/dx.extension.toml", "[extension]\nid = \"dx.beta.command-center\"\n");
  writeWorkspaceFile("hosts/browser/dx-browser/dx.extension.toml", "[extension]\nid = \"dx.browser.command-center\"\n");
  writeWorkspaceFile(
    "registry/release-evidence-gates.toml",
    `
schema = "dx.release_evidence_gates"
manifest_version = 1

[[extensions]]
id = "dx.alpha.command-center"
stage = "not-release-ready"
required_evidence = ["host_execution", "package_output", "signing", "checksum", "distribution_review", "marketplace_review"]
evidence_receipt_requirements = ["host_execution=.dx/receipts/extensions/dx.alpha.command-center/loaded-host.json", "package_output=.dx/receipts/extensions/dx.alpha.command-center/package-output-latest.json", "signing=.dx/receipts/extensions/dx.alpha.command-center/signing-latest.json", "checksum=.dx/receipts/extensions/dx.alpha.command-center/checksum-latest.json", "distribution_review=.dx/receipts/extensions/dx.alpha.command-center/marketplace-review-latest.json", "marketplace_review=.dx/receipts/extensions/dx.alpha.command-center/marketplace-review-latest.json"]
evidence_receipts = [".dx/receipts/extensions/dx.alpha.command-center/loaded-host.json", ".dx/receipts/extensions/dx.alpha.command-center/package-output-latest.json", ".dx/receipts/extensions/dx.alpha.command-center/signing-latest.json", ".dx/receipts/extensions/dx.alpha.command-center/checksum-latest.json", ".dx/receipts/extensions/dx.alpha.command-center/marketplace-review-latest.json"]
next_release_proof = "review alpha"
blocked_by = ["marketplace review"]

[[extensions]]
id = "dx.beta.command-center"
stage = "not-release-ready"
required_evidence = ["host_execution", "package_output", "signing", "checksum", "distribution_review", "oauth_review"]
evidence_receipt_requirements = ["host_execution=.dx/receipts/extensions/dx.beta.command-center/loaded-host.json", "package_output=.dx/receipts/extensions/dx.beta.command-center/package-output-latest.json", "signing=.dx/receipts/extensions/dx.beta.command-center/signing-latest.json", "checksum=.dx/receipts/extensions/dx.beta.command-center/checksum-latest.json", "distribution_review=.dx/receipts/extensions/dx.beta.command-center/marketplace-review-latest.json", "oauth_review=.dx/receipts/extensions/dx.beta.command-center/oauth-review-latest.json"]
evidence_receipts = [".dx/receipts/extensions/dx.beta.command-center/loaded-host.json", ".dx/receipts/extensions/dx.beta.command-center/package-output-latest.json", ".dx/receipts/extensions/dx.beta.command-center/signing-latest.json", ".dx/receipts/extensions/dx.beta.command-center/checksum-latest.json", ".dx/receipts/extensions/dx.beta.command-center/marketplace-review-latest.json", ".dx/receipts/extensions/dx.beta.command-center/oauth-review-latest.json"]
next_release_proof = "review beta"
blocked_by = ["oauth review"]

[[extensions]]
id = "dx.browser.command-center"
stage = "not-release-ready"
required_evidence = ["host_execution", "package_output", "signing", "checksum", "distribution_review"]
evidence_receipt_requirements = ["host_execution=.dx/receipts/extensions/dx.browser.command-center/loaded-host.json", "package_output=.dx/receipts/extensions/dx.browser.command-center/package-output-latest.json", "signing=.dx/receipts/extensions/dx.browser.command-center/signing-latest.json", "checksum=.dx/receipts/extensions/dx.browser.command-center/checksum-latest.json", "distribution_review=.dx/receipts/extensions/dx.browser.command-center/store-distribution-latest.json"]
evidence_receipts = [".dx/receipts/extensions/dx.browser.command-center/loaded-host.json", ".dx/receipts/extensions/dx.browser.command-center/package-output-latest.json", ".dx/receipts/extensions/dx.browser.command-center/signing-latest.json", ".dx/receipts/extensions/dx.browser.command-center/checksum-latest.json", ".dx/receipts/extensions/dx.browser.command-center/store-distribution-latest.json"]
next_release_proof = "review browser stores"
blocked_by = ["browser store review"]
`
  );

  const alphaPackageOutput = writePackageOutputReceipt("dx.alpha.command-center", "alpha");
  const releaseArtifactPath = writeWorkspaceFile("release/dx-alpha-command-center.zip", "release artifact\n");
  const releaseArtifactSha256 = sha256(readFileSync(releaseArtifactPath));
  const alphaChecksumReceipt = writeReleasePackageChecksumReceipt(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run smoke:release-package-checksum:j1",
    proof: {
      adapterId: "dx.alpha.command-center",
      host: "alpha",
      packageOutputReceiptPath: alphaPackageOutput.receiptPath,
      packageOutputSha256: alphaPackageOutput.sha256,
      releaseArtifactPath,
      releaseArtifactSha256,
      releaseArtifactKind: "zip",
      artifactCreatedFromPackageOutput: true
    }
  });
  const signatureFilePath = writeWorkspaceFile("release/dx-alpha-command-center.zip.sig", "signature\n");
  const verificationOutputPath = writeWorkspaceFile("release/signature-verification.txt", "signature verified\n");
  const alphaSigningReceipt = writePackageSigningReceipt(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run smoke:package-signing:j1",
    proof: {
      adapterId: "dx.alpha.command-center",
      host: "alpha",
      packageOutputReceiptPath: alphaPackageOutput.receiptPath,
      checksumReceiptPath: alphaChecksumReceipt.receiptPath,
      packageOutputSha256: alphaPackageOutput.sha256,
      signedArtifactPath: releaseArtifactPath,
      signedArtifactSha256: releaseArtifactSha256,
      signatureFilePath,
      signatureSha256: sha256(readFileSync(signatureFilePath)),
      verificationOutputPath,
      verificationTool: "gpg",
      verificationCommand: "gpg --verify dx-alpha-command-center.zip.sig dx-alpha-command-center.zip",
      signerName: "DX Release Engineering",
      certificateFingerprintSha256: "e".repeat(64),
      verified: true
    }
  });
  const alphaChecksumReceiptPath = alphaChecksumReceipt.receiptPath;
  const alphaSigningReceiptPath = alphaSigningReceipt.receiptPath;
  const fakeChecksumReceiptPath = writeReviewSupportReceipt(
    ".dx/receipts/extensions/dx.alpha.command-center/fake-checksum-latest.json",
    {
      receipt: "dx.extension.release_package.checksum",
      adapterId: "dx.alpha.command-center",
      host: "alpha",
      releaseClaims: {
        packageOutputVerified: true,
        publicReleasePackageVerified: true,
        releaseChecksumVerified: true
      }
    }
  );
  const fakeSigningReceiptPath = writeReviewSupportReceipt(
    ".dx/receipts/extensions/dx.alpha.command-center/fake-signing-latest.json",
    {
      receipt: "dx.extension.package.signing",
      adapterId: "dx.alpha.command-center",
      host: "alpha",
      releaseClaims: {
        packageOutputVerified: true,
        publicReleasePackageVerified: true,
        releaseChecksumVerified: true,
        signingVerified: true
      }
    }
  );
  const proofFilePath = writeWorkspaceFile("proofs/alpha-marketplace-review.txt", "marketplace approval\n");
  const receipt = writeDistributionReviewReceipt(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run smoke:distribution-review:j1",
    proof: {
      adapterId: "dx.alpha.command-center",
      host: "alpha",
      reviewKind: "marketplace_review",
      receiptPath: ".dx/receipts/extensions/dx.alpha.command-center/marketplace-review-latest.json",
      proofFilePath,
      signingReceiptPath: alphaSigningReceiptPath,
      checksumReceiptPath: alphaChecksumReceiptPath,
      reviewSystem: "Fixture Marketplace",
      reviewStatus: "approved",
      decidedAt: "2026-06-07T00:00:00.000Z",
      submissionIdSha256: "a".repeat(64),
      reviewRecordSha256: "b".repeat(64),
      publicListingHost: "marketplace.example"
    }
  });

  assert.equal(receipt.receipt, "dx.extension.distribution_review");
  assert.equal(receipt.adapterId, "dx.alpha.command-center");
  assert.equal(receipt.host, "alpha");
  assert.equal(receipt.receiptPath, join(workspaceRoot, ".dx", "receipts", "extensions", "dx.alpha.command-center", "marketplace-review-latest.json"));
  assert.deepEqual(receipt.review.reviewKinds, ["distribution_review", "marketplace_review"]);
  assert.deepEqual(receipt.linkedReceipts, {
    signingReceiptPath: alphaSigningReceiptPath,
    signingReceiptSha256: sha256(readFileSync(alphaSigningReceiptPath)),
    checksumReceiptPath: alphaChecksumReceiptPath,
    checksumReceiptSha256: sha256(readFileSync(alphaChecksumReceiptPath))
  });
  assert.deepEqual(receipt.releaseClaims, {
    reviewVerified: true,
    distributionVerified: true,
    oauthReviewVerified: false,
    signingVerified: true,
    releaseChecksumVerified: true,
    publicReleasePackageVerified: true
  });
  assert.equal(existsSync(receipt.receiptPath), true);
  assert.deepEqual(JSON.parse(readFileSync(receipt.receiptPath, "utf8")), receipt);

  const oauthProofFilePath = writeWorkspaceFile("proofs/beta-oauth-review.txt", "oauth approval\n");
  const oauthReceipt = writeDistributionReviewReceipt(workspaceRoot, {
    proof: {
      adapterId: "dx.beta.command-center",
      host: "beta",
      reviewKind: "oauth_review",
      receiptPath: ".dx/receipts/extensions/dx.beta.command-center/oauth-review-latest.json",
      proofFilePath: oauthProofFilePath,
      reviewSystem: "Fixture OAuth Review",
      reviewStatus: "approved",
      decidedAt: "2026-06-07T00:00:00.000Z",
      submissionIdSha256: "c".repeat(64),
      reviewRecordSha256: "d".repeat(64)
    }
  });

  assert.deepEqual(oauthReceipt.review.reviewKinds, ["oauth_review"]);
  assert.equal(oauthReceipt.linkedReceipts, undefined);
  assert.equal(oauthReceipt.releaseClaims.distributionVerified, false);
  assert.equal(oauthReceipt.releaseClaims.oauthReviewVerified, true);

  const browserSupport = writeSignedReleaseSupport(
    "dx.browser.command-center",
    "browser",
    "dx.extension.browser.package_output",
    "dx-browser-command-center"
  );
  const browserProofFilePath = writeWorkspaceFile("proofs/browser-store-distribution-review.txt", "store approval\n");
  const browserReceipt = writeDistributionReviewReceipt(workspaceRoot, {
    proof: {
      adapterId: "dx.browser.command-center",
      host: "browser",
      reviewKind: "distribution_review",
      receiptPath: ".dx/receipts/extensions/dx.browser.command-center/store-distribution-latest.json",
      proofFilePath: browserProofFilePath,
      signingReceiptPath: browserSupport.signingReceiptPath,
      checksumReceiptPath: browserSupport.checksumReceiptPath,
      reviewSystem: "Browser Store Distribution",
      reviewStatus: "approved",
      decidedAt: "2026-06-07T00:00:00.000Z",
      submissionIdSha256: "1".repeat(64),
      reviewRecordSha256: "2".repeat(64),
      browserStoreTargets: ["chrome_web_store", "edge_add_ons", "firefox_amo"]
    }
  });

  assert.deepEqual(browserReceipt.review.browserStoreTargets, [
    "chrome_web_store",
    "edge_add_ons",
    "firefox_amo"
  ]);

  assert.throws(
    () =>
      writeDistributionReviewReceipt(workspaceRoot, {
        proof: {
          adapterId: "dx.browser.command-center",
          host: "browser",
          reviewKind: "distribution_review",
          receiptPath: ".dx/receipts/extensions/dx.browser.command-center/store-distribution-latest.json",
          proofFilePath: browserProofFilePath,
          signingReceiptPath: browserSupport.signingReceiptPath,
          checksumReceiptPath: browserSupport.checksumReceiptPath,
          reviewSystem: "Browser Store Distribution",
          reviewStatus: "approved",
          decidedAt: "2026-06-07T00:00:00.000Z",
          submissionIdSha256: "1".repeat(64),
          reviewRecordSha256: "2".repeat(64),
          browserStoreTargets: ["chrome_web_store", "edge_add_ons"]
        }
      }),
    /must cover Chrome Web Store, Microsoft Edge Add-ons, and Firefox AMO/
  );

  assert.throws(
    () =>
      writeDistributionReviewReceipt(workspaceRoot, {
        proof: {
          adapterId: "dx.alpha.command-center",
          host: "alpha",
          reviewKind: "marketplace_review",
          receiptPath: ".dx/receipts/extensions/dx.alpha.command-center/marketplace-review-latest.json",
          proofFilePath,
          signingReceiptPath: fakeSigningReceiptPath,
          checksumReceiptPath: fakeChecksumReceiptPath,
          reviewSystem: "Fixture Marketplace",
          reviewStatus: "approved",
          decidedAt: "2026-06-07T00:00:00.000Z",
          submissionIdSha256: "a".repeat(64),
          reviewRecordSha256: "b".repeat(64)
        }
      }),
    /must include package-output linkage/
  );

  assert.throws(
    () =>
      writeDistributionReviewReceipt(workspaceRoot, {
        proof: {
          adapterId: "dx.alpha.command-center",
          host: "alpha",
          reviewKind: "marketplace_review",
          receiptPath: ".dx/receipts/extensions/dx.alpha.command-center/marketplace-review-latest.json",
          proofFilePath,
          signingReceiptPath: alphaSigningReceiptPath,
          checksumReceiptPath: alphaChecksumReceiptPath,
          reviewSystem: "Fixture Marketplace",
          reviewStatus: "submitted",
          decidedAt: "2026-06-07T00:00:00.000Z",
          submissionIdSha256: "a".repeat(64),
          reviewRecordSha256: "b".repeat(64)
        }
      }),
    /must be approved/
  );

  assert.throws(
    () =>
      writeDistributionReviewReceipt(workspaceRoot, {
        proof: {
          adapterId: "dx.alpha.command-center",
          host: "alpha",
          reviewKind: "marketplace_review",
          receiptPath: ".dx/receipts/extensions/dx.alpha.command-center/unmapped-review-latest.json",
          proofFilePath,
          signingReceiptPath: alphaSigningReceiptPath,
          checksumReceiptPath: alphaChecksumReceiptPath,
          reviewSystem: "Fixture Marketplace",
          reviewStatus: "approved",
          decidedAt: "2026-06-07T00:00:00.000Z",
          submissionIdSha256: "a".repeat(64),
          reviewRecordSha256: "b".repeat(64)
        }
      }),
    /must match a release evidence review receipt/
  );

  assert.throws(
    () =>
      writeDistributionReviewReceipt(workspaceRoot, {
        proof: {
          adapterId: "dx.alpha.command-center",
          host: "alpha",
          reviewKind: "marketplace_review",
          receiptPath: ".dx/receipts/extensions/dx.alpha.command-center/marketplace-review-latest.json",
          proofFilePath,
          signingReceiptPath: alphaSigningReceiptPath,
          checksumReceiptPath: alphaChecksumReceiptPath,
          reviewSystem: "Fixture Marketplace",
          reviewStatus: "approved",
          decidedAt: "2026-06-07T00:00:00.000Z",
          submissionIdSha256: "a".repeat(64),
          reviewRecordSha256: "b".repeat(64),
          token: "do-not-store"
        }
      }),
    /privacy-sensitive distribution review proof field/
  );

  assert.throws(
    () =>
      writeDistributionReviewReceipt(workspaceRoot, {
        proof: {
          adapterId: "dx.alpha.command-center",
          host: "alpha",
          reviewKind: "marketplace_review",
          receiptPath: ".dx/receipts/extensions/dx.alpha.command-center/marketplace-review-latest.json",
          proofFilePath: writeWorkspaceFile("proofs/empty-marketplace-review.txt", ""),
          signingReceiptPath: alphaSigningReceiptPath,
          checksumReceiptPath: alphaChecksumReceiptPath,
          reviewSystem: "Fixture Marketplace",
          reviewStatus: "approved",
          decidedAt: "2026-06-07T00:00:00.000Z",
          submissionIdSha256: "a".repeat(64),
          reviewRecordSha256: "b".repeat(64)
        }
      }),
    /proof file must not be empty/
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("Distribution review receipt verified");

function writeReviewSupportReceipt(relativePath: string, receipt: Record<string, unknown>): string {
  return writeWorkspaceFile(relativePath, JSON.stringify(receipt, null, 2));
}

function writeSignedReleaseSupport(
  adapterId: string,
  host: string,
  receiptType: string,
  artifactName: string
): { checksumReceiptPath: string; signingReceiptPath: string } {
  const packageOutput = writePackageOutputReceipt(adapterId, host, receiptType);
  const releaseArtifactPath = writeWorkspaceFile(`release/${artifactName}.zip`, `${artifactName} release artifact\n`);
  const releaseArtifactSha256 = sha256(readFileSync(releaseArtifactPath));
  const checksumReceipt = writeReleasePackageChecksumReceipt(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run smoke:release-package-checksum:j1",
    proof: {
      adapterId,
      host,
      packageOutputReceiptPath: packageOutput.receiptPath,
      packageOutputSha256: packageOutput.sha256,
      releaseArtifactPath,
      releaseArtifactSha256,
      releaseArtifactKind: "zip",
      artifactCreatedFromPackageOutput: true
    }
  });
  const signatureFilePath = writeWorkspaceFile(`release/${artifactName}.zip.sig`, `${artifactName} signature\n`);
  const verificationOutputPath = writeWorkspaceFile(
    `release/${artifactName}-signature-verification.txt`,
    `${artifactName} signature verified\n`
  );
  const signingReceipt = writePackageSigningReceipt(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run smoke:package-signing:j1",
    proof: {
      adapterId,
      host,
      packageOutputReceiptPath: packageOutput.receiptPath,
      checksumReceiptPath: checksumReceipt.receiptPath,
      packageOutputSha256: packageOutput.sha256,
      signedArtifactPath: releaseArtifactPath,
      signedArtifactSha256: releaseArtifactSha256,
      signatureFilePath,
      signatureSha256: sha256(readFileSync(signatureFilePath)),
      verificationOutputPath,
      verificationTool: "gpg",
      verificationCommand: `gpg --verify ${artifactName}.zip.sig ${artifactName}.zip`,
      signerName: "DX Release Engineering",
      certificateFingerprintSha256: "f".repeat(64),
      verified: true
    }
  });

  return {
    checksumReceiptPath: checksumReceipt.receiptPath,
    signingReceiptPath: signingReceipt.receiptPath
  };
}

function writePackageOutputReceipt(
  adapterId: string,
  host: string,
  receiptType = "dx.extension.blender.package_output"
): { receiptPath: string; sha256: string } {
  const packageRoot = join(workspaceRoot, "packages", adapterId);
  writeWorkspaceFile(`packages/${adapterId}/entrypoint.txt`, `${adapterId}\n`);
  writeWorkspaceFile(`packages/${adapterId}/manifest.txt`, `${host}\n`);

  const files = ["entrypoint.txt", "manifest.txt"].map((relativePath) => {
    const bytes = readFileSync(join(packageRoot, relativePath));

    return {
      relativePath,
      bytes: bytes.length,
      sha256: sha256(bytes)
    };
  });
  const packageSha256 = hashPackageFiles(files);
  const sourceProof = adapterId === "dx.browser.command-center" ? writeBrowserSourceProof() : undefined;
  const receiptPath = writeWorkspaceFile(
    `.dx/receipts/extensions/${adapterId}/package-output-latest.json`,
    `${JSON.stringify(
      {
        receipt: receiptType,
        adapterId,
        host,
        package: {
          root: packageRoot,
          fileCount: files.length,
          sha256: packageSha256,
          files
        },
        ...(sourceProof ?? {}),
        releaseClaims: {
          loadedHostVerified: false,
          signingVerified: false,
          releaseChecksumVerified: false,
          distributionVerified: false
        }
      },
      null,
      2
    )}\n`
  );

  return {
    receiptPath,
    sha256: packageSha256
  };
}

function writeBrowserSourceProof(): {
  sourceRoot: string;
  sourceInputs: ReturnType<typeof readSourceInputProofs>;
  sourceSha256: string;
} {
  const sourceRoot = join(workspaceRoot, "source-inputs", "dx.browser.command-center");

  for (const relativePath of browserPackageSourceInputs) {
    writePackageFile(sourceRoot, relativePath, `browser source for ${relativePath}\n`);
  }

  const sourceInputs = readSourceInputProofs(sourceRoot, browserPackageSourceInputs);

  return {
    sourceRoot,
    sourceInputs,
    sourceSha256: hashSourceInputs(sourceInputs)
  };
}

function writePackageFile(packageRoot: string, relativePath: string, source: string): void {
  const targetPath = join(packageRoot, ...relativePath.split("/"));
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, source);
}

function writeWorkspaceFile(relativePath: string, source: string): string {
  const absolutePath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);

  return absolutePath;
}

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
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
