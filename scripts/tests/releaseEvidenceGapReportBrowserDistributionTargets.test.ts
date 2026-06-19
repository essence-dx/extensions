import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  browserPackageSourceInputs,
  hashSourceInputs,
  readSourceInputProofs
} from "../lib/source-input-proof.ts";
import { writePackageSigningReceipt } from "../write-package-signing-receipts.ts";
import { writeReleaseEvidenceGapReport } from "../write-release-evidence-gap-report.ts";
import { writeReleasePackageChecksumReceipt } from "../write-release-package-checksum-receipts.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-browser-store-distribution-"));
const adapterId = "dx.browser.command-center";
const host = "browser";
const packageReceiptPath = `.dx/receipts/extensions/${adapterId}/package-output-latest.json`;
const checksumReceiptPath = `.dx/receipts/extensions/${adapterId}/checksum-latest.json`;
const signingReceiptPath = `.dx/receipts/extensions/${adapterId}/signing-latest.json`;
const reviewReceiptPath = `.dx/receipts/extensions/${adapterId}/store-distribution-latest.json`;
const brandedIconSource = "<svg><title>DX</title></svg>\n";
const brandedIconSha256 = sha256(brandedIconSource);

try {
  writeBrowserWorkspace();
  const packageOutput = writePackageOutputReceipt();
  const releaseArtifactPath = writeWorkspaceFile("release/dx-browser-command-center.zip", "browser release\n");
  const releaseArtifactSha256 = sha256(readFileSync(releaseArtifactPath));
  const checksumReceipt = writeReleasePackageChecksumReceipt(workspaceRoot, {
    generatedAt: "2026-06-08T00:00:00.000Z",
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
  const signatureFilePath = writeWorkspaceFile("release/dx-browser-command-center.zip.sig", "signature\n");
  const verificationOutputPath = writeWorkspaceFile("release/signature-verification.txt", "signature verified\n");
  const signingReceipt = writePackageSigningReceipt(workspaceRoot, {
    generatedAt: "2026-06-08T00:00:00.000Z",
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
      verificationCommand: "gpg --verify dx-browser-command-center.zip.sig dx-browser-command-center.zip",
      signerName: "DX Release Engineering",
      certificateFingerprintSha256: "a".repeat(64),
      verified: true
    }
  });

  writeStoreDistributionReceipt(
    ["chrome_web_store"],
    signingReceipt.receiptPath,
    checksumReceipt.receiptPath
  );

  const partialDistributionRequirement = requirementByKind(writeReport(), "distribution_review");

  assert.equal(partialDistributionRequirement.releaseValid, false);
  assert.match(
    partialDistributionRequirement.weakness ?? "",
    /browser store distribution receipt must cover Chrome Web Store, Microsoft Edge Add-ons, and Firefox AMO/
  );

  writeStoreDistributionReceipt(
    ["chrome_web_store", "edge_add_ons", "firefox_amo"],
    signingReceipt.receiptPath,
    checksumReceipt.receiptPath
  );

  assert.equal(requirementByKind(writeReport(), "distribution_review").releaseValid, true);
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("browser distribution store target release evidence verified");

function writeBrowserWorkspace(): void {
  writeWorkspaceFile(
    "registry/official-extensions.toml",
    `
schema = "dx.extensions.registry"
manifest_version = 1

[[extensions]]
id = "${adapterId}"
name = "DX Browser Command Center"
path = "hosts/browser/dx-browser"
manifest = "hosts/browser/dx-browser/dx.extension.toml"
status = "experimental"
professional_targets = ["browser.chrome", "browser.edge", "browser.firefox"]
`
  );
  writeWorkspaceFile("hosts/browser/dx-browser/dx.extension.toml", `[extension]\nid = "${adapterId}"\n`);
  writeBrowserSourceInputs();
  writeWorkspaceFile(
    "registry/release-evidence-gates.toml",
    `
schema = "dx.release_evidence_gates"
manifest_version = 1

[[extensions]]
id = "${adapterId}"
stage = "not-release-ready"
required_evidence = ["host_execution", "package_output", "signing", "checksum", "distribution_review"]
evidence_receipt_requirements = ["host_execution=.dx/receipts/extensions/${adapterId}/loaded-host.json", "package_output=${packageReceiptPath}", "signing=${signingReceiptPath}", "checksum=${checksumReceiptPath}", "distribution_review=${reviewReceiptPath}"]
evidence_receipts = [".dx/receipts/extensions/${adapterId}/loaded-host.json", "${packageReceiptPath}", "${signingReceiptPath}", "${checksumReceiptPath}", "${reviewReceiptPath}"]
next_release_proof = "Capture Chrome Web Store, Microsoft Edge Add-ons, and Firefox AMO approval evidence."
blocked_by = ["browser store distribution proof"]
`
  );
}

function writePackageOutputReceipt(): { receiptPath: string; sha256: string } {
  const packageRoot = join(workspaceRoot, "dist", "browser");
  const files = [
    writePackageFile("chromium/manifest.json", "{}\n"),
    writePackageFile("chromium/static/dx.svg", brandedIconSource),
    writePackageFile("edge/manifest.json", "{}\n"),
    writePackageFile("edge/static/dx.svg", brandedIconSource),
    writePackageFile("firefox/manifest.json", "{}\n"),
    writePackageFile("firefox/static/dx.svg", brandedIconSource)
  ];
  const packageSha256 = hashPackageFiles(files);
  const sourceProof = readBrowserSourceProof();
  const receiptPath = writeJsonFile(packageReceiptPath, {
    receipt: "dx.extension.browser.package_output",
    adapterId,
    host,
    package: {
      root: packageRoot,
      fileCount: files.length,
      sha256: packageSha256,
      files
    },
    inputs: browserPackageSourceInputs,
    sourceRoot: sourceProof.sourceRoot,
    sourceInputs: sourceProof.sourceInputs,
    sourceSha256: sourceProof.sourceSha256,
    targets: [
      browserTarget("chromium"),
      browserTarget("edge"),
      browserTarget("firefox")
    ],
    releaseClaims: {
      loadedHostVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      distributionVerified: false
    }
  });

  return {
    receiptPath,
    sha256: packageSha256
  };
}

function browserTarget(name: "chromium" | "edge" | "firefox"): Record<string, unknown> {
  return {
    name,
    brandedIcon: {
      relativePath: `${name}/static/dx.svg`,
      sha256: brandedIconSha256,
      manifestReferences: [
        "action.default_icon.128",
        "action.default_icon.16",
        "action.default_icon.48",
        "icons.128",
        "icons.16",
        "icons.48"
      ]
    }
  };
}

function writeStoreDistributionReceipt(
  browserStoreTargets: string[],
  signingReceiptAbsolutePath: string,
  checksumReceiptAbsolutePath: string
): void {
  const proofFilePath = writeWorkspaceFile("proofs/browser-store-distribution.txt", "store approval\n");

  writeJsonFile(reviewReceiptPath, {
    receipt: "dx.extension.distribution_review",
    adapterId,
    host,
    review: {
      reviewKind: "distribution_review",
      reviewKinds: ["distribution_review"],
      reviewSystem: "Browser Store Distribution",
      reviewStatus: "approved",
      decidedAt: "2026-06-08T00:00:00.000Z",
      submissionIdSha256: "b".repeat(64),
      reviewRecordSha256: "c".repeat(64),
      browserStoreTargets
    },
    manualProof: {
      proofFilePath,
      proofFileSha256: sha256(readFileSync(proofFilePath))
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
}

function writePackageFile(relativePath: string, source: string): { relativePath: string; bytes: number; sha256: string } {
  const absolutePath = writeWorkspaceFile(`dist/browser/${relativePath}`, source);
  const bytes = readFileSync(absolutePath);

  return {
    relativePath,
    bytes: bytes.length,
    sha256: sha256(bytes)
  };
}

function writeJsonFile(relativePath: string, value: Record<string, unknown>): string {
  return writeWorkspaceFile(relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeWorkspaceFile(relativePath: string, source: string): string {
  const absolutePath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);

  return absolutePath;
}

function writeBrowserSourceInputs(): void {
  for (const relativePath of browserPackageSourceInputs) {
    writeWorkspaceFile(`hosts/browser/dx-browser/${relativePath}`, `browser source for ${relativePath}\n`);
  }
}

function readBrowserSourceProof(): {
  sourceRoot: string;
  sourceInputs: ReturnType<typeof readSourceInputProofs>;
  sourceSha256: string;
} {
  const sourceRoot = join(workspaceRoot, "hosts", "browser", "dx-browser");
  const sourceInputs = readSourceInputProofs(sourceRoot, browserPackageSourceInputs);

  return {
    sourceRoot,
    sourceInputs,
    sourceSha256: hashSourceInputs(sourceInputs)
  };
}

function requirementByKind(
  report: ReturnType<typeof writeReleaseEvidenceGapReport>,
  kind: string
) {
  const extension = report.extensions.find((entry) => entry.id === adapterId);
  assert.ok(extension, "browser gap entry must exist");
  const requirement = extension.evidenceRequirements.find((entry) => entry.kind === kind);
  assert.ok(requirement, `browser gap entry must include ${kind} requirement`);

  return requirement;
}

function writeReport() {
  return writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-08T00:00:00.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });
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
