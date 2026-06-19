import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { writeUnityEditorPackageOutputReceipt } from "../write-unity-editor-package-output-receipt.ts";

const root = process.cwd();
const adapterRoot = join(root, "hosts", "unity", "dx-unity-editor");
const receiptRoot = mkdtempSync(join(tmpdir(), "dx-unity-package-output-"));
const receiptPath = join(receiptRoot, "receipts", "package-output-latest.json");

try {
  const receipt = writeUnityEditorPackageOutputReceipt({
    adapterRoot,
    packageRoot: adapterRoot,
    receiptPath,
    upmTarballPath: join(receiptRoot, "artifacts", "dev.dx.unity-command-center-0.1.0.tgz"),
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run package:unity-editor:j1"
  });

  assert.equal(receipt.receipt, "dx.extension.unity_editor.package_output");
  assert.equal(receipt.adapterId, "dx.unity-editor.command-center");
  assert.equal(receipt.host, "unity-editor");
  assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
  assert.equal(receipt.verificationCommand, "npm run package:unity-editor:j1");
  assert.equal(receipt.receiptPath, receiptPath);
  assert.equal(receipt.package.root, adapterRoot);
  assert.equal(receipt.package.format, "unity-upm-source-layout");
  assert.equal(receipt.package.fileCount, 9);
  assert.deepEqual(
    receipt.package.files.map((file) => file.relativePath),
    [
      "Editor/DX.Unity.Editor.asmdef",
      "Editor/DxUnityCommandCenterWindow.cs",
      "Editor/DxUnityCommandPlans.cs",
      "Editor/DxUnityLocalServiceBoundary.cs",
      "Editor/DxUnityMenu.cs",
      "README.md",
      "Tests/Editor/DX.Unity.Editor.Tests.asmdef",
      "dx.extension.toml",
      "package.json"
    ]
  );
  assert.deepEqual(receipt.packageManifest, {
    name: "dev.dx.unity-command-center",
    displayName: "DX Unity Editor Command Center",
    version: "0.1.0",
    unity: "2022.3"
  });
  assert.deepEqual(receipt.editorAssembly, {
    name: "DX.Unity.Editor",
    includePlatforms: ["Editor"]
  });
  assert.deepEqual(receipt.commandPlans, {
    commandCount: 3,
    mutatesProject: false,
    localServiceProofRequired: true
  });
  assertArchiveProof(receipt.upmTarball, ".tgz", [0x1f, 0x8b, 0x08]);
  assert.equal(receipt.upmTarball.gzipHeaderVerified, true);
  assert.deepEqual(receipt.releaseClaims, {
    loadedUnityEditorVerified: false,
    testProjectSmokeVerified: false,
    projectImportVerified: false,
    localServiceVerified: false,
    packageTarballVerified: false,
    signingVerified: false,
    releaseChecksumVerified: false,
    assetStoreReviewVerified: false,
    distributionVerified: false
  });

  assertPackageHashes(receipt.package.root, receipt.package.files, receipt.package.sha256);
  assert.equal(existsSync(receipt.upmTarball.path), true, "Unity UPM tarball should be written");
  assert.equal(existsSync(receiptPath), true, "Unity Editor receipt should be written");
  assert.deepEqual(JSON.parse(readFileSync(receiptPath, "utf8")), receipt);
} finally {
  rmSync(receiptRoot, { recursive: true, force: true });
}

console.log("Unity Editor package output receipt verified");

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
