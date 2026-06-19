import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { classifySpecialProofWeakness } from "../lib/release-evidence-special-proof-classifier.ts";
import { hashSourceInputs, readSourceInputProofs } from "../lib/source-input-proof.ts";
import { writePackageNotarizationReceipt } from "../write-package-notarization-receipt.ts";
import { writePackageSigningReceipt } from "../write-package-signing-receipts.ts";
import { writeReleasePackageChecksumReceipt } from "../write-release-package-checksum-receipts.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-package-notarization-"));
const adapterId = "dx.sketch.command-center";
const host = "sketch";

try {
  const packageRoot = join(workspaceRoot, "package-output");
  const sourceRoot = join(workspaceRoot, "source", "dx-sketch");
  const sourceInputPaths = ["manifest.json", "src/commandPlans.ts", "src/index.ts", "src/messages.ts"];
  writePackageFile(sourceRoot, "manifest.json", "{\"name\":\"DX Sketch\"}\n");
  writePackageFile(sourceRoot, "src/commandPlans.ts", "export const commandPlans = [];\n");
  writePackageFile(sourceRoot, "src/index.ts", "export const sketchMain = true;\n");
  writePackageFile(sourceRoot, "src/messages.ts", "export const messages = {};\n");
  writePackageFile(packageRoot, "Contents/Sketch/index.js", "Sketch plugin entrypoint\n");
  writePackageFile(packageRoot, "Contents/Sketch/manifest.json", "Sketch plugin manifest\n");

  const packageFiles = ["Contents/Sketch/index.js", "Contents/Sketch/manifest.json"].map((relativePath) => {
    const bytes = readFileSync(join(packageRoot, ...relativePath.split("/")));

    return {
      relativePath,
      bytes: bytes.length,
      sha256: sha256(bytes)
    };
  });
  const packageOutputSha256 = hashPackageFiles(packageFiles);
  const sourceInputs = readSourceInputProofs(sourceRoot, sourceInputPaths);
  const packageOutputReceiptPath = writeWorkspaceFile(
    `.dx/receipts/extensions/${adapterId}/package-output-latest.json`,
    JSON.stringify(
      {
        receipt: "dx.extension.sketch.package_output",
        adapterId,
        host,
        bundle: {
          root: packageRoot,
          fileCount: packageFiles.length,
          sha256: packageOutputSha256,
          files: packageFiles
        },
        inputs: sourceInputPaths,
        sourceRoot,
        sourceInputs,
        sourceSha256: hashSourceInputs(sourceInputs),
        releaseClaims: {
          loadedHostVerified: false,
          sketchtoolVerified: false,
          localServiceVerified: false,
          signingVerified: false,
          notarizationVerified: false,
          distributionVerified: false
        }
      },
      null,
      2
    )
  );
  const releaseArtifactPath = writeWorkspaceFile("release/dx-sketch-command-center.zip", "Sketch release artifact\n");
  const releaseArtifactSha256 = sha256(readFileSync(releaseArtifactPath));
  const checksumReceipt = writeReleasePackageChecksumReceipt(workspaceRoot, {
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
  const signatureFilePath = writeWorkspaceFile("release/dx-sketch-command-center.zip.sig", "signature\n");
  const verificationOutputPath = writeWorkspaceFile("release/signature-verification.txt", "signature verified\n");
  const signingReceipt = writePackageSigningReceipt(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run smoke:package-signing:j1",
    proof: {
      adapterId,
      host,
      packageOutputReceiptPath,
      checksumReceiptPath: checksumReceipt.receiptPath,
      packageOutputSha256,
      signedArtifactPath: releaseArtifactPath,
      signedArtifactSha256: releaseArtifactSha256,
      signatureFilePath,
      signatureSha256: sha256(readFileSync(signatureFilePath)),
      verificationOutputPath,
      verificationTool: "signtool",
      verificationCommand: "signtool verify dx-sketch-command-center.zip",
      signerName: "DX Release Engineering",
      certificateFingerprintSha256: "a".repeat(64),
      verified: true
    }
  });
  const notarizationOutputPath = writeWorkspaceFile("release/notarization.txt", "accepted: ticket issued\n");
  const notarizationProof = {
    adapterId,
    host,
    signingReceiptPath: signingReceipt.receiptPath,
    notarizationOutputPath,
    notarizationToolName: "notarytool",
    notarizationCommand: "xcrun notarytool submit dx-sketch-command-center.zip --wait",
    ticketIdSha256: sha256(Buffer.from("notarization-ticket-id")),
    artifactSha256: releaseArtifactSha256,
    verified: true
  } as const;
  const receipt = writePackageNotarizationReceipt(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run smoke:package-notarization:j1",
    proof: notarizationProof
  });

  assert.equal(receipt.receipt, "dx.extension.package.notarization");
  assert.equal(receipt.adapterId, adapterId);
  assert.equal(receipt.host, host);
  assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
  assert.equal(receipt.verificationCommand, "npm run smoke:package-notarization:j1");
  assert.equal(
    receipt.receiptPath,
    join(workspaceRoot, ".dx", "receipts", "extensions", adapterId, "notarization-latest.json")
  );
  assert.equal(receipt.signingReceiptPath, signingReceipt.receiptPath);
  assert.equal(receipt.signingReceiptSha256, sha256(readFileSync(signingReceipt.receiptPath)));
  assert.equal(receipt.checksumReceiptPath, checksumReceipt.receiptPath);
  assert.equal(receipt.checksumReceiptSha256, sha256(readFileSync(checksumReceipt.receiptPath)));
  assert.equal(receipt.notarization.toolName, "notarytool");
  assert.equal(receipt.notarization.artifactSha256, releaseArtifactSha256);
  assert.equal(receipt.notarization.outputSha256, sha256(readFileSync(notarizationOutputPath)));
  assert.equal(receipt.releaseClaims.notarizationVerified, true);
  assert.equal(receipt.releaseClaims.signingVerified, true);
  assert.equal(receipt.releaseClaims.releaseChecksumVerified, true);
  assert.equal(receipt.releaseClaims.publicReleasePackageVerified, true);
  assert.equal(receipt.releaseClaims.distributionVerified, false);
  assert.equal(classifySpecialProofWeakness("notarization", receipt), undefined);
  assert.equal(existsSync(receipt.receiptPath), true);
  assert.deepEqual(JSON.parse(readFileSync(receipt.receiptPath, "utf8")), receipt);

  assertWriterRejectsMutatedFile(
    packageOutputReceiptPath,
    "{}\n",
    /Package notarization signing receipt is weak: signing package-output receipt hash changed/,
    notarizationProof
  );
  assertWriterRejectsMutatedFile(
    releaseArtifactPath,
    "changed release artifact\n",
    /Package notarization signing receipt is weak: signing signed artifact file hash changed/,
    notarizationProof
  );
  assertWriterRejectsMutatedFile(
    signatureFilePath,
    "changed signature\n",
    /Package notarization signing receipt is weak: signing signature file hash changed/,
    notarizationProof
  );
  assertWriterRejectsMutatedFile(
    verificationOutputPath,
    "changed verification output\n",
    /Package notarization signing receipt is weak: signing signature verification output file hash changed/,
    notarizationProof
  );

  withMutatedFile(signingReceipt.receiptPath, "{}\n", () => {
    assert.match(
      classifySpecialProofWeakness("notarization", receipt) ?? "",
      /notarization signing receipt hash changed/
    );
  });

  withMutatedFile(checksumReceipt.receiptPath, "{}\n", () => {
    assert.match(
      classifySpecialProofWeakness("notarization", receipt) ?? "",
      /notarization checksum receipt hash changed/
    );
  });

  withMutatedFile(packageOutputReceiptPath, "{}\n", () => {
    assert.match(
      classifySpecialProofWeakness("notarization", receipt) ?? "",
      /notarization signing receipt is weak: signing package-output receipt hash changed/
    );
  });

  withMutatedFile(releaseArtifactPath, "changed release artifact\n", () => {
    assert.match(
      classifySpecialProofWeakness("notarization", receipt) ?? "",
      /notarization signed artifact file hash changed/
    );
  });

  withMutatedFile(notarizationOutputPath, "changed notarization output\n", () => {
    assert.match(
      classifySpecialProofWeakness("notarization", receipt) ?? "",
      /notarization output file hash changed/
    );
  });

  assert.throws(
    () =>
      writePackageNotarizationReceipt(workspaceRoot, {
        proof: {
          adapterId,
          host,
          signingReceiptPath: signingReceipt.receiptPath,
          notarizationOutputPath,
          notarizationToolName: "notarytool",
          notarizationCommand: "xcrun notarytool submit dx-sketch-command-center.zip --wait",
          ticketIdSha256: sha256(Buffer.from("notarization-ticket-id")),
          artifactSha256: "b".repeat(64),
          verified: true
        }
      }),
    /artifact hash mismatch/
  );

  assert.throws(
    () =>
      writePackageNotarizationReceipt(workspaceRoot, {
        proof: {
          adapterId,
          host,
          signingReceiptPath: signingReceipt.receiptPath,
          notarizationOutputPath,
          notarizationToolName: "notarytool",
          notarizationCommand: "xcrun notarytool submit dx-sketch-command-center.zip --wait",
          ticketIdSha256: sha256(Buffer.from("notarization-ticket-id")),
          artifactSha256: releaseArtifactSha256,
          verified: false
        }
      }),
    /must verify package notarization/
  );

  assert.throws(
    () =>
      writePackageNotarizationReceipt(workspaceRoot, {
        proof: {
          adapterId,
          host,
          signingReceiptPath: signingReceipt.receiptPath,
          notarizationOutputPath,
          notarizationToolName: "notarytool",
          notarizationCommand: "xcrun notarytool submit dx-sketch-command-center.zip --wait",
          ticketIdSha256: sha256(Buffer.from("notarization-ticket-id")),
          artifactSha256: releaseArtifactSha256,
          appleIdPassword: "do-not-store",
          verified: true
        }
      }),
    /privacy-sensitive package notarization proof field/
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("Package notarization receipt verified");

function writeWorkspaceFile(relativePath: string, source: string): string {
  const targetPath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, source);

  return targetPath;
}

function writePackageFile(root: string, relativePath: string, source: string): void {
  const targetPath = join(root, ...relativePath.split("/"));
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, source);
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

function assertWriterRejectsMutatedFile(
  path: string,
  source: string,
  expectedMessage: RegExp,
  proof: Parameters<typeof writePackageNotarizationReceipt>[1]["proof"]
): void {
  withMutatedFile(path, source, () => {
    assert.throws(
      () =>
        writePackageNotarizationReceipt(workspaceRoot, {
          proof
        }),
      expectedMessage
    );
  });
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
