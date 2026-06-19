import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildObsidianPlugin } from "../build-obsidian-plugin.ts";
import { writeObsidianPackageOutputReceipt } from "../write-obsidian-package-output-receipt.ts";
import { assertSourceInputReceipt } from "./sourceInputReceiptAssertions.ts";

const root = process.cwd();
const adapterRoot = join(root, "hosts", "obsidian", "dx-command-center");
const outputRoot = mkdtempSync(join(tmpdir(), "dx-obsidian-package-output-"));
const receiptPath = join(outputRoot, "receipts", "package-output-latest.json");

try {
  const buildResult = await buildObsidianPlugin({
    adapterRoot,
    outputRoot
  });
  copyFileSync(join(adapterRoot, "manifest.json"), join(outputRoot, "manifest.json"));

  const receipt = writeObsidianPackageOutputReceipt({
    adapterRoot,
    packageRoot: outputRoot,
    receiptPath,
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run build:obsidian:j1"
  });

  assert.equal(receipt.receipt, "dx.extension.obsidian.package_output");
  assert.equal(receipt.adapterId, "dx.obsidian.command-center");
  assert.equal(receipt.host, "obsidian");
  assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
  assert.equal(receipt.verificationCommand, "npm run build:obsidian:j1");
  assert.equal(receipt.receiptPath, receiptPath);
  assert.equal(receipt.package.root, outputRoot);
  assert.equal(receipt.package.fileCount, 3);
  assert.deepEqual(
    receipt.package.files.map((file) => file.relativePath),
    ["main.js", "main.js.map", "manifest.json"]
  );
  assert.deepEqual(receipt.manifest, {
    id: "dx-command-center",
    version: "0.1.0",
    desktopOnly: true
  });
  assert.deepEqual(receipt.inputs, buildResult.inputs);
  assertSourceInputReceipt(receipt, adapterRoot, [
    "manifest.json",
    "src/dxCommandRunner.ts",
    "src/main.ts"
  ]);
  assert.deepEqual(receipt.externalModules, ["obsidian"]);
  assert.deepEqual(receipt.releaseClaims, {
    loadedVaultVerified: false,
    releaseAssetsVerified: false,
    signingVerified: false,
    releaseChecksumVerified: false,
    communityReviewVerified: false,
    distributionVerified: false
  });

  assertPackageHashes(receipt.package.root, receipt.package.files, receipt.package.sha256);
  assert.equal(existsSync(receiptPath), true, "Obsidian receipt should be written");
  assert.deepEqual(JSON.parse(readFileSync(receiptPath, "utf8")), receipt);
} finally {
  rmSync(outputRoot, { recursive: true, force: true });
}

console.log("Obsidian package output receipt verified");

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
