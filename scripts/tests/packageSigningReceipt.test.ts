import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { writePackageSigningReceipt } from "../write-package-signing-receipts.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-package-signing-"));
const adapterId = "dx.alpha.command-center";
const host = "alpha";

try {
  const packageRoot = join(workspaceRoot, "package");
  writePackageFile(packageRoot, "entrypoint.txt", "signed package entrypoint\n");
  writePackageFile(packageRoot, "manifest.txt", "signed package manifest\n");

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
  const packageOutputReceiptSha256 = sha256(readFileSync(packageOutputReceiptPath));
  const signedArtifactPath = writeWorkspaceFile("signed/dx-alpha-command-center.zip", "signed artifact\n");
  const signedArtifactBytes = readFileSync(signedArtifactPath).length;
  const signedArtifactSha256 = sha256(readFileSync(signedArtifactPath));
  const writeChecksumReceiptFixture = (receiptName: string, packageOutput: Record<string, unknown>) =>
    writeWorkspaceFile(
      `.dx/receipts/extensions/${adapterId}/${receiptName}`,
      JSON.stringify(
        {
          receipt: "dx.extension.release_package.checksum",
          adapterId,
          host,
          packageOutput,
          releaseArtifact: {
            path: signedArtifactPath,
            kind: "zip",
            bytes: signedArtifactBytes,
            sha256: signedArtifactSha256,
            createdFromPackageOutput: true
          },
          checksum: {
            algorithm: "sha256",
            scope: "public-release-package",
            sha256: signedArtifactSha256,
            bytes: signedArtifactBytes
          },
          releaseClaims: {
            packageOutputVerified: true,
            publicReleasePackageVerified: true,
            releaseChecksumVerified: true,
            loadedHostVerified: false,
            signingVerified: false,
            distributionVerified: false
          }
        },
        null,
        2
      )
    );
  const linkedPackageOutput = {
    receiptPath: packageOutputReceiptPath,
    receiptSha256: packageOutputReceiptSha256,
    packageOutputSha256,
    fileCount: packageFiles.length,
    filesVerified: packageFiles.length
  };
  const checksumReceiptPath = writeChecksumReceiptFixture(
    "checksum-latest.json",
    linkedPackageOutput
  );
  const packageOutputWithoutReceiptHash: Record<string, unknown> = { ...linkedPackageOutput };
  delete packageOutputWithoutReceiptHash.receiptSha256;
  const checksumReceiptWithoutPackageOutputReceiptHashPath = writeChecksumReceiptFixture(
    "checksum-without-package-output-receipt-hash.json",
    packageOutputWithoutReceiptHash
  );
  const unrelatedPackageOutputReceiptPath = writeWorkspaceFile(
    `.dx/receipts/extensions/${adapterId}/unrelated-package-output-latest.json`,
    "{}\n"
  );
  const checksumReceiptWithMismatchedPackageOutputReceiptPath = writeChecksumReceiptFixture(
    "checksum-with-mismatched-package-output-receipt-path.json",
    {
      ...linkedPackageOutput,
      receiptPath: unrelatedPackageOutputReceiptPath
    }
  );
  const checksumReceiptWithStalePackageOutputReceiptHash = writeChecksumReceiptFixture(
    "checksum-with-stale-package-output-receipt-hash.json",
    {
      ...linkedPackageOutput,
      receiptSha256: "b".repeat(64)
    }
  );
  const weakChecksumReceiptPath = writeWorkspaceFile(
    `.dx/receipts/extensions/${adapterId}/package-output-checksum-latest.json`,
    JSON.stringify(
      {
        receipt: "dx.extension.release_package.checksum",
        adapterId,
        host,
        checksum: {
          algorithm: "sha256",
          scope: "package-output",
          sha256: packageOutputSha256,
          fileCount: packageFiles.length
        },
        releaseClaims: {
          packageOutputVerified: true,
          packageOutputChecksumVerified: true,
          publicReleasePackageVerified: false
        }
      },
      null,
      2
    )
  );
  const forgedChecksumReceiptPath = writeWorkspaceFile(
    `.dx/receipts/extensions/${adapterId}/forged-checksum-latest.json`,
    JSON.stringify(
      {
        receipt: "dx.extension.package_output.checksum",
        adapterId,
        host,
        packageOutput: {
          packageOutputSha256
        },
        releaseArtifact: {
          sha256: signedArtifactSha256,
          createdFromPackageOutput: true
        },
        checksum: {
          algorithm: "sha256",
          scope: "public-release-package",
          sha256: signedArtifactSha256
        },
        releaseClaims: {
          publicReleasePackageVerified: true,
          releaseChecksumVerified: true
        }
      },
      null,
      2
    )
  );
  const signatureFilePath = writeWorkspaceFile("signed/dx-alpha-command-center.zip.sig", "detached signature\n");
  const verificationOutputPath = writeWorkspaceFile(
    "signed/signature-verification.txt",
    "signature verified for dx.alpha.command-center\n"
  );
  const proof = {
    adapterId,
    host,
    packageOutputReceiptPath,
    checksumReceiptPath,
    packageOutputSha256,
    signedArtifactPath,
    signedArtifactSha256,
    signatureFilePath,
    signatureSha256: sha256(readFileSync(signatureFilePath)),
    verificationOutputPath,
    verificationTool: "gpg",
    verificationCommand: "gpg --verify dx-alpha-command-center.zip.sig dx-alpha-command-center.zip",
    signerName: "DX Release Engineering",
    certificateFingerprintSha256: "a".repeat(64),
    verified: true
  };
  const receipt = writePackageSigningReceipt(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run smoke:package-signing:j1",
    proof
  });

  assert.equal(receipt.receipt, "dx.extension.package.signing");
  assert.equal(receipt.adapterId, adapterId);
  assert.equal(receipt.host, host);
  assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
  assert.equal(receipt.verificationCommand, "npm run smoke:package-signing:j1");
  assert.equal(
    receipt.receiptPath,
    join(workspaceRoot, ".dx", "receipts", "extensions", adapterId, "signing-latest.json")
  );
  assert.deepEqual(receipt.packageOutput, {
    receiptPath: packageOutputReceiptPath,
    receiptSha256: sha256(readFileSync(packageOutputReceiptPath)),
    checksumReceiptPath,
    checksumReceiptSha256: sha256(readFileSync(checksumReceiptPath)),
    packageOutputSha256
  });
  assert.deepEqual(receipt.signedArtifact, {
    path: signedArtifactPath,
    sha256: proof.signedArtifactSha256
  });
  assert.deepEqual(receipt.signature, {
    path: signatureFilePath,
    sha256: proof.signatureSha256,
    tool: "gpg",
    verificationCommand: proof.verificationCommand,
    verificationOutputPath,
    verificationOutputSha256: sha256(readFileSync(verificationOutputPath)),
    signerName: "DX Release Engineering",
    certificateFingerprintSha256: "a".repeat(64),
    verified: true
  });
  assert.deepEqual(receipt.releaseClaims, {
    packageOutputVerified: true,
    releaseChecksumVerified: true,
    signingVerified: true,
    loadedHostVerified: false,
    distributionVerified: false,
    publicReleasePackageVerified: true
  });
  assert.equal(existsSync(receipt.receiptPath), true);
  assert.deepEqual(JSON.parse(readFileSync(receipt.receiptPath, "utf8")), receipt);

  assert.throws(
    () =>
      writePackageSigningReceipt(workspaceRoot, {
        proof: {
          ...proof,
          verified: false
        }
      }),
    /must verify the package signature/
  );

  assert.throws(
    () =>
      writePackageSigningReceipt(workspaceRoot, {
        proof: {
          ...proof,
          signedArtifactSha256: "b".repeat(64)
        }
      }),
    /signed artifact hash mismatch/
  );

  assert.throws(
    () =>
      writePackageSigningReceipt(workspaceRoot, {
        proof: {
          ...proof,
          packageOutputSha256: "c".repeat(64)
        }
      }),
    /package output checksum mismatch/
  );

  assert.throws(
    () =>
      writePackageSigningReceipt(workspaceRoot, {
        proof: {
          ...proof,
          checksumReceiptPath: weakChecksumReceiptPath
        }
      }),
    /must verify a public release package checksum/
  );

  assert.throws(
    () =>
      writePackageSigningReceipt(workspaceRoot, {
        proof: {
          ...proof,
          checksumReceiptPath: forgedChecksumReceiptPath
        }
      }),
    /must verify a release package checksum receipt/
  );

  assert.throws(
    () =>
      writePackageSigningReceipt(workspaceRoot, {
        proof: {
          ...proof,
          checksumReceiptPath: checksumReceiptWithoutPackageOutputReceiptHashPath
        }
      }),
    /must link the package-output receipt hash/
  );

  assert.throws(
    () =>
      writePackageSigningReceipt(workspaceRoot, {
        proof: {
          ...proof,
          checksumReceiptPath: checksumReceiptWithMismatchedPackageOutputReceiptPath
        }
      }),
    /package-output receipt path mismatch/
  );

  assert.throws(
    () =>
      writePackageSigningReceipt(workspaceRoot, {
        proof: {
          ...proof,
          checksumReceiptPath: checksumReceiptWithStalePackageOutputReceiptHash
        }
      }),
    /package-output receipt hash changed/
  );

  assert.throws(
    () =>
      writePackageSigningReceipt(workspaceRoot, {
        proof: {
          ...proof,
          privateKey: "do-not-store"
        }
      }),
    /privacy-sensitive package signing proof field/
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("Package signing receipt verified");

function writeWorkspaceFile(relativePath: string, source: string): string {
  const targetPath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, source);

  return targetPath;
}

function writePackageFile(root: string, relativePath: string, source: string): void {
  const targetPath = join(root, relativePath);
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, source);
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
