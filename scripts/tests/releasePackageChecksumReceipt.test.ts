import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { writeReleasePackageChecksumReceipt } from "../write-release-package-checksum-receipts.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-release-package-checksum-"));
const adapterId = "dx.alpha.command-center";
const host = "alpha";

try {
  const packageRoot = join(workspaceRoot, "package-output");
  writeWorkspaceFile("package-output/entrypoint.txt", "release package entrypoint\n");
  writeWorkspaceFile("package-output/manifest.txt", "release package manifest\n");

  const packageFiles = ["entrypoint.txt", "manifest.txt"].map((relativePath) => {
    const bytes = readFileSync(join(packageRoot, relativePath));

    return {
      relativePath,
      bytes: bytes.length,
      sha256: sha256(bytes)
    };
  });
  const packageOutputSha256 = hashPackageFiles(packageFiles);
  const packageOutputReceiptPath = writeWorkspaceFile(
    `.dx/receipts/extensions/${adapterId}/package-output-latest.json`,
    JSON.stringify(
      {
        receipt: "fixture.package_output",
        adapterId,
        host,
        package: {
          root: packageRoot,
          fileCount: packageFiles.length,
          sha256: packageOutputSha256,
          files: packageFiles
        },
        releaseClaims: {
          loadedHostVerified: false,
          signingVerified: false,
          distributionVerified: false
        }
      },
      null,
      2
    )
  );
  const releaseArtifactPath = writeWorkspaceFile("release/dx-alpha-command-center.zip", "release artifact\n");
  const releaseArtifactSha256 = sha256(readFileSync(releaseArtifactPath));
  const receipt = writeReleasePackageChecksumReceipt(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run smoke:release-package-checksum:j1",
    proof: {
      adapterId,
      host,
      packageOutputReceiptPath,
      packageOutputSha256,
      releaseArtifactPath,
      releaseArtifactSha256,
      releaseArtifactKind: "zip",
      artifactCreatedFromPackageOutput: true
    }
  });

  assert.equal(receipt.receipt, "dx.extension.release_package.checksum");
  assert.equal(receipt.adapterId, adapterId);
  assert.equal(receipt.host, host);
  assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
  assert.equal(receipt.verificationCommand, "npm run smoke:release-package-checksum:j1");
  assert.equal(
    receipt.receiptPath,
    join(workspaceRoot, ".dx", "receipts", "extensions", adapterId, "checksum-latest.json")
  );
  assert.deepEqual(receipt.packageOutput, {
    receiptPath: packageOutputReceiptPath,
    receiptSha256: sha256(readFileSync(packageOutputReceiptPath)),
    packageOutputSha256,
    fileCount: 2,
    filesVerified: 2
  });
  assert.deepEqual(receipt.releaseArtifact, {
    path: releaseArtifactPath,
    kind: "zip",
    bytes: readFileSync(releaseArtifactPath).length,
    sha256: releaseArtifactSha256,
    createdFromPackageOutput: true
  });
  assert.deepEqual(receipt.checksum, {
    algorithm: "sha256",
    scope: "public-release-package",
    sha256: releaseArtifactSha256,
    bytes: readFileSync(releaseArtifactPath).length
  });
  assert.deepEqual(receipt.releaseClaims, {
    packageOutputVerified: true,
    publicReleasePackageVerified: true,
    releaseChecksumVerified: true,
    loadedHostVerified: false,
    signingVerified: false,
    distributionVerified: false
  });
  assert.equal(existsSync(receipt.receiptPath), true);
  assert.deepEqual(JSON.parse(readFileSync(receipt.receiptPath, "utf8")), receipt);

  assert.throws(
    () =>
      writeReleasePackageChecksumReceipt(workspaceRoot, {
        proof: {
          adapterId,
          host,
          packageOutputReceiptPath,
          packageOutputSha256,
          releaseArtifactPath,
          releaseArtifactSha256: "b".repeat(64),
          releaseArtifactKind: "zip",
          artifactCreatedFromPackageOutput: true
        }
      }),
    /release artifact hash mismatch/
  );

  assert.throws(
    () =>
      writeReleasePackageChecksumReceipt(workspaceRoot, {
        proof: {
          adapterId,
          host,
          packageOutputReceiptPath,
          packageOutputSha256,
          releaseArtifactPath,
          releaseArtifactSha256,
          releaseArtifactKind: "zip",
          artifactCreatedFromPackageOutput: false
        }
      }),
    /must verify the release artifact was created from package output/
  );

  assert.throws(
    () =>
      writeReleasePackageChecksumReceipt(workspaceRoot, {
        proof: {
          adapterId,
          host,
          packageOutputReceiptPath,
          packageOutputSha256,
          releaseArtifactPath,
          releaseArtifactSha256,
          releaseArtifactKind: "zip",
          artifactCreatedFromPackageOutput: true,
          token: "do-not-store"
        }
      }),
    /privacy-sensitive release package checksum proof field/
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("Release package checksum receipt verified");

function writeWorkspaceFile(relativePath: string, source: string): string {
  const targetPath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, source);

  return targetPath;
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
