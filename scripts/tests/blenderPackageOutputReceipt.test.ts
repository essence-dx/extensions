import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildBlenderPackageOutput } from "../build-blender-package-output.ts";
import { writeBlenderPackageOutputReceipt } from "../write-blender-package-output-receipt.ts";
import { assertSourceInputReceipt } from "./sourceInputReceiptAssertions.ts";

const root = process.cwd();
const adapterRoot = join(root, "hosts", "blender", "dx-blender");
const outputRoot = mkdtempSync(join(tmpdir(), "dx-blender-package-receipt-"));
const receiptPath = join(outputRoot, "receipts", "package-output-latest.json");

try {
  const buildResult = buildBlenderPackageOutput({
    adapterRoot,
    outputRoot
  });

  const receipt = writeBlenderPackageOutputReceipt({
    adapterRoot,
    packageRoot: buildResult.outputRoot,
    receiptPath,
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run build:blender:j1"
  });

  assert.equal(receipt.receipt, "dx.extension.blender.package_output");
  assert.equal(receipt.adapterId, "dx.blender.command-center");
  assert.equal(receipt.host, "blender");
  assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
  assert.equal(receipt.verificationCommand, "npm run build:blender:j1");
  assert.equal(receipt.receiptPath, receiptPath);
  assert.equal(receipt.package.root, outputRoot);
  assert.equal(receipt.package.fileCount, 2);
  assert.deepEqual(
    receipt.package.files.map((file) => file.relativePath),
    ["__init__.py", "blender_manifest.toml"]
  );
  assert.deepEqual(receipt.manifest, {
    id: "dx_blender_command_center",
    type: "add-on",
    blenderVersionMin: "4.2.0"
  });
  assert.deepEqual(receipt.inputs, ["__init__.py", "blender_manifest.toml"]);
  assertSourceInputReceipt(receipt, adapterRoot, ["__init__.py", "blender_manifest.toml"]);
  assert.deepEqual(receipt.releaseClaims, {
    loadedHostVerified: false,
    installedAddonVerified: false,
    packageArchiveVerified: false,
    signingVerified: false,
    releaseChecksumVerified: false,
    distributionVerified: false
  });

  assertPackageHashes(receipt.package.root, receipt.package.files, receipt.package.sha256);
  assert.equal(existsSync(receiptPath), true, "Blender receipt should be written");
  assert.deepEqual(JSON.parse(readFileSync(receiptPath, "utf8")), receipt);
} finally {
  rmSync(outputRoot, { recursive: true, force: true });
}

console.log("Blender package output receipt verified");

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
