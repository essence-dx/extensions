import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { writeVisualStudioPackageOutputReceipt } from "../write-visual-studio-package-output-receipt.ts";

const root = process.cwd();
const adapterRoot = join(root, "hosts", "visual-studio", "dx-visual-studio");
const receiptRoot = mkdtempSync(join(tmpdir(), "dx-visual-studio-package-output-"));
const receiptPath = join(receiptRoot, "receipts", "package-output-latest.json");

try {
  const receipt = writeVisualStudioPackageOutputReceipt({
    adapterRoot,
    packageRoot: adapterRoot,
    receiptPath,
    vsixPath: join(receiptRoot, "artifacts", "dx-visual-studio-0.1.0.vsix"),
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run package:visual-studio:j1"
  });

  assert.equal(receipt.receipt, "dx.extension.visual_studio.package_output");
  assert.equal(receipt.adapterId, "dx.visual-studio.command-center");
  assert.equal(receipt.host, "visual-studio");
  assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
  assert.equal(receipt.verificationCommand, "npm run package:visual-studio:j1");
  assert.equal(receipt.receiptPath, receiptPath);
  assert.equal(receipt.package.root, adapterRoot);
  assert.equal(receipt.package.format, "visual-studio-vsix-source-layout");
  assert.equal(receipt.package.fileCount, 12);
  assert.deepEqual(
    receipt.package.files.map((file) => file.relativePath),
    [
      "Dx.VisualStudio.CommandCenter.csproj",
      "README.md",
      "Resources/DxCommandCenter.vsct",
      "dx.extension.toml",
      "source.extension.vsixmanifest",
      "src/CommandPlans/DxCommandPlan.cs",
      "src/CommandPlans/DxCommandPlans.cs",
      "src/Commands/CommandIds.cs",
      "src/Commands/RegisterDxCommands.cs",
      "src/DxVisualStudioPackage.cs",
      "src/Receipts/ReceiptPaths.cs",
      "src/Services/DxLocalServiceBoundary.cs"
    ]
  );
  assert.deepEqual(receipt.vsixManifest, {
    identityId: "dev.dx.visual-studio.command-center",
    version: "0.1.0",
    publisher: "DX",
    displayName: "DX Visual Studio Command Center",
    targetVersion: "[17.0,18.0)",
    assetType: "Microsoft.VisualStudio.VsPackage"
  });
  assert.deepEqual(receipt.commandPlans, {
    commandCount: 3,
    mutatesSolution: false,
    localServiceProofRequired: true
  });
  assertArchiveProof(receipt.vsix, ".vsix", [0x50, 0x4b, 0x03, 0x04]);
  assert.equal(receipt.vsix.zipHeaderVerified, true);
  assert.deepEqual(receipt.releaseClaims, {
    loadedExperimentalInstanceVerified: false,
    vsixPackageVerified: false,
    localServiceVerified: false,
    signingVerified: false,
    releaseChecksumVerified: false,
    marketplaceReviewVerified: false,
    distributionVerified: false
  });

  assertPackageHashes(receipt.package.root, receipt.package.files, receipt.package.sha256);
  assert.equal(existsSync(receipt.vsix.path), true, "Visual Studio VSIX should be written");
  assert.equal(existsSync(receiptPath), true, "Visual Studio receipt should be written");
  assert.deepEqual(JSON.parse(readFileSync(receiptPath, "utf8")), receipt);
} finally {
  rmSync(receiptRoot, { recursive: true, force: true });
}

console.log("Visual Studio package output receipt verified");

function assertPackageHashes(
  packageRoot: string,
  files: Array<{ relativePath: string; bytes: number; sha256: string }>,
  actualPackageHash: string
): void {
  const packageHash = createHash("sha256");

  for (const file of files) {
    const bytes = readFileSync(join(packageRoot, file.relativePath));

    assert.equal(file.bytes, bytes.length);
    assert.equal(file.sha256, createHash("sha256").update(bytes).digest("hex"));
    packageHash.update(file.relativePath);
    packageHash.update("\0");
    packageHash.update(file.sha256);
    packageHash.update("\0");
    packageHash.update(String(file.bytes));
    packageHash.update("\n");
  }

  assert.equal(actualPackageHash, packageHash.digest("hex"));
}

function assertArchiveProof(
  proof: { path: string; fileName: string; bytes: number; sha256: string },
  extension: string,
  expectedHeader: number[]
): void {
  assert.equal(proof.fileName.endsWith(extension), true);
  const bytes = readFileSync(proof.path);

  assert.equal(proof.bytes, bytes.length);
  assert.equal(proof.sha256, createHash("sha256").update(bytes).digest("hex"));
  assert.deepEqual(Array.from(bytes.subarray(0, expectedHeader.length)), expectedHeader);
}
