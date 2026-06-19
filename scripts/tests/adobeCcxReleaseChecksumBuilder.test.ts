import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { buildAdobeCcxReleaseChecksumProofs } from "../build-adobe-ccx-release-checksum-proofs.ts";
import { writeReleasePackageChecksumReceipt } from "../write-release-package-checksum-receipts.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-adobe-ccx-release-checksums-"));
const adapters = [
  {
    adapterId: "dx.photoshop.command-center",
    host: "photoshop"
  },
  {
    adapterId: "dx.premiere-pro.command-center",
    host: "premiere-pro"
  },
  {
    adapterId: "dx.indesign.command-center",
    host: "indesign"
  }
] as const;

try {
  for (const adapter of adapters) {
    writeFixture(adapter);
  }

  const result = buildAdobeCcxReleaseChecksumProofs(workspaceRoot, {
    proofPath: ".tmp/proofs/adobe-ccx-release-checksums.json"
  });

  assert.equal(result.proofPath, join(workspaceRoot, ".tmp", "proofs", "adobe-ccx-release-checksums.json"));
  assert.equal(result.proofs.length, adapters.length);
  assert.deepEqual(JSON.parse(readFileSync(result.proofPath, "utf8")), result.proofs);

  for (const adapter of adapters) {
    const proof = result.proofs.find((candidate) => candidate.adapterId === adapter.adapterId);
    assert.ok(proof, `missing checksum proof for ${adapter.adapterId}`);
    assert.equal(proof.host, adapter.host);
    assert.equal(proof.releaseArtifactKind, "ccx");
    assert.equal(proof.artifactCreatedFromPackageOutput, true);
    assert.equal(proof.packageOutputReceiptPath, packageOutputReceiptPath(adapter.adapterId));
    assert.equal(proof.releaseArtifactPath, ccxArtifactPath(adapter.host));
    assert.equal(proof.releaseArtifactSha256, sha256(readFileSync(ccxArtifactPath(adapter.host))));

    const receipt = writeReleasePackageChecksumReceipt(workspaceRoot, {
      generatedAt: "2026-06-09T00:00:00.000Z",
      verificationCommand: "npm run package:adobe-ccx:j1",
      proof
    });

    assert.equal(receipt.releaseArtifact.kind, "ccx");
    assert.equal(receipt.releaseArtifact.path, ccxArtifactPath(adapter.host));
    assert.equal(receipt.checksum.sha256, proof.releaseArtifactSha256);
  }

  assert.throws(
    () => buildAdobeCcxReleaseChecksumProofs(workspaceRoot, { adapterIds: ["dx.browser.command-center"] }),
    /Adobe CCX release checksum adapter id is unsupported/
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("Adobe CCX release checksum proof builder verified");

function writeFixture(adapter: (typeof adapters)[number]): void {
  const packageRoot = join(workspaceRoot, "package-output", adapter.adapterId);
  const packageFile = writePackageFile(packageRoot, "manifest.json", `${adapter.adapterId}\n`);
  const packageSha256 = hashPackageFiles([packageFile]);
  const packageOutputReceipt = {
    receipt: "dx.extension.adobe_uxp.package_output",
    adapterId: adapter.adapterId,
    host: adapter.host,
    package: {
      root: packageRoot,
      fileCount: 1,
      sha256: packageSha256,
      files: [packageFile]
    },
    releaseClaims: {
      loadedHostVerified: false,
      developerToolVerified: false,
      ccxPackaged: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      distributionVerified: false
    }
  };
  const ccxPath = writeWorkspaceFile(
    `.tmp/release-packages/adobe-ccx/${adapter.host}/dx-command-center.ccx`,
    `${adapter.adapterId} ccx package\n`
  );
  const ccxBytes = readFileSync(ccxPath);

  writeJsonFile(`.dx/receipts/extensions/${adapter.adapterId}/package-output-latest.json`, packageOutputReceipt);
  writeJsonFile(`.dx/receipts/extensions/${adapter.adapterId}/ccx-package-latest.json`, {
    receipt: "dx.extension.adobe_uxp.ccx_package",
    adapterId: adapter.adapterId,
    host: adapter.host,
    packageOutput: {
      receiptPath: packageOutputReceiptPath(adapter.adapterId),
      receiptSha256: sha256(readFileSync(packageOutputReceiptPath(adapter.adapterId))),
      packageSha256,
      filesVerified: 1
    },
    ccxPackage: {
      artifactPath: ccxPath,
      fileName: "dx-command-center.ccx",
      format: "ccx",
      bytes: ccxBytes.length,
      sha256: sha256(ccxBytes),
      packagingTool: "dx-ccx-packager",
      packagingToolVersion: "0.1.0"
    },
    releaseClaims: {
      packageOutputVerified: true,
      ccxPackaged: true,
      loadedHostVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      distributionVerified: false
    }
  });
}

function writePackageFile(root: string, relativePath: string, source: string): {
  relativePath: string;
  bytes: number;
  sha256: string;
} {
  const absolutePath = join(root, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);

  return {
    relativePath,
    bytes: Buffer.byteLength(source),
    sha256: sha256(Buffer.from(source))
  };
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

function packageOutputReceiptPath(adapterId: string): string {
  return join(workspaceRoot, ".dx", "receipts", "extensions", adapterId, "package-output-latest.json");
}

function ccxArtifactPath(host: string): string {
  return join(workspaceRoot, ".tmp", "release-packages", "adobe-ccx", host, "dx-command-center.ccx");
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

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
