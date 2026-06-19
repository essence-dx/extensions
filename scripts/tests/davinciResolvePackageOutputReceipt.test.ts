import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { writeDavinciResolvePackageOutputReceipt } from "../write-davinci-resolve-package-output-receipt.ts";

const root = process.cwd();
const adapterRoot = join(root, "hosts", "blackmagic", "dx-davinci-resolve");
const receiptRoot = mkdtempSync(join(tmpdir(), "dx-davinci-package-output-"));
const receiptPath = join(receiptRoot, "receipts", "package-output-latest.json");

try {
  const receipt = writeDavinciResolvePackageOutputReceipt({
    adapterRoot,
    packageRoot: adapterRoot,
    receiptPath,
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run package:davinci-resolve:j1"
  });

  assert.equal(receipt.receipt, "dx.extension.davinci_resolve.package_output");
  assert.equal(receipt.adapterId, "dx.davinci-resolve.command-center");
  assert.equal(receipt.host, "davinci-resolve");
  assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
  assert.equal(receipt.verificationCommand, "npm run package:davinci-resolve:j1");
  assert.equal(receipt.receiptPath, receiptPath);
  assert.equal(receipt.package.root, adapterRoot);
  assert.equal(receipt.package.fileCount, 4);
  assert.deepEqual(
    receipt.package.files.map((file) => file.relativePath),
    [
      "command-plans.json",
      "dx.extension.toml",
      "scripts/dx_command_center.lua",
      "scripts/dx_command_center.py"
    ]
  );
  assert.deepEqual(receipt.commandPlans, {
    schema: "dx.davinci_resolve.command_plans",
    commandCount: 3,
    mutatesResolveProject: false
  });
  assert.deepEqual(receipt.releaseClaims, {
    loadedResolveVerified: false,
    readOnlyProjectMetadataVerified: false,
    workflowIntegrationVerified: false,
    localServiceVerified: false,
    signingVerified: false,
    releaseChecksumVerified: false,
    distributionVerified: false
  });

  assertPackageHashes(receipt.package.root, receipt.package.files, receipt.package.sha256);
  assert.equal(existsSync(receiptPath), true, "DaVinci Resolve receipt should be written");
  assert.deepEqual(JSON.parse(readFileSync(receiptPath, "utf8")), receipt);
} finally {
  rmSync(receiptRoot, { recursive: true, force: true });
}

console.log("DaVinci Resolve package output receipt verified");

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
