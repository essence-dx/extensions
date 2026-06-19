import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildSketchPlugin } from "../build-sketch-plugin.ts";
import { writeSketchPackageOutputReceipt } from "../write-sketch-package-output-receipt.ts";
import { assertSourceInputReceipt } from "./sourceInputReceiptAssertions.ts";

const root = process.cwd();
const adapterRoot = join(root, "hosts", "sketch", "dx-sketch");
const outputRoot = mkdtempSync(join(tmpdir(), "dx-sketch-package-output-"));
const receiptPath = join(outputRoot, "receipts", "package-output-latest.json");

try {
  const buildResult = await buildSketchPlugin({
    adapterRoot,
    outputRoot
  });

  const receipt = writeSketchPackageOutputReceipt({
    adapterRoot,
    bundleRoot: buildResult.bundleRoot,
    receiptPath,
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run build:sketch:j1"
  });

  assert.equal(receipt.receipt, "dx.extension.sketch.package_output");
  assert.equal(receipt.adapterId, "dx.sketch.command-center");
  assert.equal(receipt.host, "sketch");
  assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
  assert.equal(receipt.verificationCommand, "npm run build:sketch:j1");
  assert.equal(receipt.receiptPath, receiptPath);
  assert.equal(receipt.bundle.root, buildResult.bundleRoot);
  assert.equal(receipt.bundle.fileCount, 3);
  assert.deepEqual(
    receipt.bundle.files.map((file) => file.relativePath),
    [
      "Contents/Sketch/index.js",
      "Contents/Sketch/index.js.map",
      "Contents/Sketch/manifest.json"
    ]
  );
  assert.deepEqual(receipt.externalModules, []);
  assert.deepEqual(
    receipt.inputs,
    ["src/commandPlans.ts", "src/index.ts", "src/messages.ts"],
    "Sketch package receipt should preserve the esbuild input list"
  );
  assertSourceInputReceipt(receipt, adapterRoot, [
    "manifest.json",
    "src/commandPlans.ts",
    "src/index.ts",
    "src/messages.ts"
  ]);
  assert.deepEqual(receipt.releaseClaims, {
    loadedHostVerified: false,
    sketchtoolVerified: false,
    localServiceVerified: false,
    signingVerified: false,
    notarizationVerified: false,
    distributionVerified: false
  });

  for (const file of receipt.bundle.files) {
    const absolutePath = join(buildResult.bundleRoot, file.relativePath);
    const bytes = readFileSync(absolutePath);

    assert.equal(file.bytes, bytes.length);
    assert.equal(file.sha256, createHash("sha256").update(bytes).digest("hex"));
  }

  const bundleHash = createHash("sha256");

  for (const file of receipt.bundle.files) {
    bundleHash.update(file.relativePath);
    bundleHash.update("\0");
    bundleHash.update(file.sha256);
    bundleHash.update("\0");
    bundleHash.update(String(file.bytes));
    bundleHash.update("\n");
  }

  assert.equal(receipt.bundle.sha256, bundleHash.digest("hex"));

  assert.equal(existsSync(receiptPath), true, "receipt should be written");
  assert.deepEqual(JSON.parse(readFileSync(receiptPath, "utf8")), receipt);
} finally {
  rmSync(outputRoot, { recursive: true, force: true });
}

console.log("Sketch package output receipt verified");
