import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { writeUnrealEnginePackageOutputReceipt } from "../write-unreal-engine-package-output-receipt.ts";

const root = process.cwd();
const adapterRoot = join(root, "hosts", "unreal", "dx-unreal-engine");
const receiptRoot = mkdtempSync(join(tmpdir(), "dx-unreal-package-output-"));
const receiptPath = join(receiptRoot, "receipts", "package-output-latest.json");

try {
  const receipt = writeUnrealEnginePackageOutputReceipt({
    adapterRoot,
    packageRoot: adapterRoot,
    receiptPath,
    packagedPluginPath: join(receiptRoot, "artifacts", "DXUnrealCommandCenter-0.1.0.zip"),
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run package:unreal-engine:j1"
  });

  assert.equal(receipt.receipt, "dx.extension.unreal_engine.package_output");
  assert.equal(receipt.adapterId, "dx.unreal-engine.command-center");
  assert.equal(receipt.host, "unreal-engine");
  assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
  assert.equal(receipt.verificationCommand, "npm run package:unreal-engine:j1");
  assert.equal(receipt.receiptPath, receiptPath);
  assert.equal(receipt.package.root, adapterRoot);
  assert.equal(receipt.package.format, "unreal-editor-source-plugin-layout");
  assert.equal(receipt.package.fileCount, 7);
  assert.deepEqual(
    receipt.package.files.map((file) => file.relativePath),
    [
      "DXUnrealCommandCenter.uplugin",
      "README.md",
      "Source/DXUnrealCommandCenterEditor/DXUnrealCommandCenterEditor.Build.cs",
      "Source/DXUnrealCommandCenterEditor/Private/DXUnrealCommandCenterEditorModule.cpp",
      "Source/DXUnrealCommandCenterEditor/Private/DXUnrealCommandPlans.cpp",
      "Source/DXUnrealCommandCenterEditor/Public/DXUnrealCommandPlans.h",
      "dx.extension.toml"
    ]
  );
  assert.deepEqual(receipt.pluginDescriptor, {
    friendlyName: "DX Unreal Engine Command Center",
    versionName: "0.1.0",
    moduleName: "DXUnrealCommandCenterEditor",
    moduleType: "Editor",
    canContainContent: false
  });
  assert.deepEqual(receipt.commandPlans, {
    commandCount: 3,
    mutatesProject: false,
    localServiceProofRequired: true
  });
  assertArchiveProof(receipt.packagedPlugin, ".zip", [0x50, 0x4b, 0x03, 0x04]);
  assert.equal(receipt.packagedPlugin.zipHeaderVerified, true);
  assert.deepEqual(receipt.releaseClaims, {
    loadedUnrealEditorVerified: false,
    sampleProjectSmokeVerified: false,
    projectEnablementVerified: false,
    localServiceVerified: false,
    pluginPackageVerified: false,
    signingVerified: false,
    releaseChecksumVerified: false,
    fabMarketplaceReviewVerified: false,
    distributionVerified: false
  });

  assertPackageHashes(receipt.package.root, receipt.package.files, receipt.package.sha256);
  assert.equal(existsSync(receipt.packagedPlugin.path), true, "Unreal package artifact should be written");
  assert.equal(existsSync(receiptPath), true, "Unreal Engine receipt should be written");
  assert.deepEqual(JSON.parse(readFileSync(receiptPath, "utf8")), receipt);
} finally {
  rmSync(receiptRoot, { recursive: true, force: true });
}

console.log("Unreal Engine package output receipt verified");

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
