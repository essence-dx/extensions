import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { assertSourceInputReceipt } from "./sourceInputReceiptAssertions.ts";
import { writeZedPackageOutputReceipt } from "../write-zed-package-output-receipt.ts";

const root = process.cwd();
const adapterRoot = join(root, "hosts", "zed", "dx-zed");
const zedSourceInputs = [
  "Cargo.lock",
  "Cargo.toml",
  "README.md",
  "extension.toml",
  "src/command_plans.rs",
  "src/lib.rs"
];
const receiptRoot = mkdtempSync(join(tmpdir(), "dx-zed-package-output-"));
const receiptPath = join(receiptRoot, "receipts", "package-output-latest.json");

try {
  const receipt = writeZedPackageOutputReceipt({
    adapterRoot,
    packageRoot: adapterRoot,
    receiptPath,
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run package:zed:j1"
  });

  assert.equal(receipt.receipt, "dx.extension.zed.package_output");
  assert.equal(receipt.adapterId, "dx.zed.command-center");
  assert.equal(receipt.host, "zed");
  assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
  assert.equal(receipt.verificationCommand, "npm run package:zed:j1");
  assert.equal(receipt.receiptPath, receiptPath);
  assert.equal(receipt.package.root, adapterRoot);
  assert.equal(receipt.package.format, "zed-extension-wasm-layout");
  assert.deepEqual(receipt.inputs, zedSourceInputs);
  assertSourceInputReceipt(receipt, adapterRoot, zedSourceInputs);
  assert.equal(receipt.package.fileCount, 3);
  assert.deepEqual(
    receipt.package.files.map((file) => file.relativePath),
    ["README.md", "extension.toml", "extension.wasm"]
  );
  assert.deepEqual(receipt.extensionManifest, {
    id: "dx-command-center",
    name: "DX Command Center",
    version: "0.1.0",
    slashCommandCount: 3
  });
  assert.equal(receipt.webAssembly.headerVerified, true);
  assert.ok(receipt.webAssembly.bytes > 8);
  assert.deepEqual(receipt.releaseClaims, {
    loadedZedDevExtensionVerified: false,
    localServiceVerified: false,
    galleryPackageVerified: false,
    signingVerified: false,
    releaseChecksumVerified: false,
    distributionVerified: false
  });

  assertPackageHashes(receipt.package.root, receipt.package.files, receipt.package.sha256);
  assert.equal(existsSync(receiptPath), true, "Zed receipt should be written");
  assert.deepEqual(JSON.parse(readFileSync(receiptPath, "utf8")), receipt);
} finally {
  rmSync(receiptRoot, { recursive: true, force: true });
}

console.log("Zed package output receipt verified");

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
