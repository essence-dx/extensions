import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildAdobeUxpPackage } from "../build-adobe-uxp-package.ts";
import { writeAdobeUxpPackageOutputReceipt } from "../write-adobe-uxp-package-output-receipts.ts";

const root = process.cwd();
const outputRoot = mkdtempSync(join(tmpdir(), "dx-adobe-uxp-package-receipts-"));
const adapters = [
  {
    id: "dx.photoshop.command-center",
    host: "photoshop",
    folder: "dx-photoshop-uxp"
  },
  {
    id: "dx.premiere-pro.command-center",
    host: "premiere-pro",
    folder: "dx-premiere-pro-uxp"
  },
  {
    id: "dx.indesign.command-center",
    host: "indesign",
    folder: "dx-indesign-uxp"
  }
] as const;

try {
  for (const adapter of adapters) {
    const adapterRoot = join(root, "hosts", "adobe", adapter.folder);
    const receiptPath = join(outputRoot, adapter.folder, "receipts", "package-output-latest.json");
    const buildResult = await buildAdobeUxpPackage({
      adapterRoot,
      outputRoot: join(outputRoot, adapter.folder)
    });

    const receipt = writeAdobeUxpPackageOutputReceipt({
      adapterId: adapter.id,
      host: adapter.host,
      adapterRoot,
      packageRoot: buildResult.packageRoot,
      receiptPath,
      generatedAt: "2026-06-07T00:00:00.000Z",
      verificationCommand: "npm run build:adobe-uxp:j1"
    });

    assert.equal(receipt.receipt, "dx.extension.adobe_uxp.package_output");
    assert.equal(receipt.adapterId, adapter.id);
    assert.equal(receipt.host, adapter.host);
    assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
    assert.equal(receipt.verificationCommand, "npm run build:adobe-uxp:j1");
    assert.equal(receipt.receiptPath, receiptPath);
    assert.equal(receipt.package.root, buildResult.packageRoot);
    assert.equal(receipt.package.fileCount, 4);
    assert.deepEqual(
      receipt.package.files.map((file) => file.relativePath),
      ["index.html", "index.js", "index.js.map", "manifest.json"]
    );
    assert.deepEqual(receipt.inputs, ["src/messages.ts", "src/commandPlans.ts", "src/index.ts"]);
    assert.deepEqual(receipt.externalModules, ["uxp"]);
    assert.equal(receipt.manifest.main, "index.html");
    assert.equal(receipt.manifest.requiredPermissionsEmpty, true);
    assert.deepEqual(receipt.releaseClaims, {
      loadedHostVerified: false,
      developerToolVerified: false,
      ccxPackaged: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      distributionVerified: false
    });

    for (const file of receipt.package.files) {
      const absolutePath = join(buildResult.packageRoot, file.relativePath);
      const bytes = readFileSync(absolutePath);

      assert.equal(file.bytes, bytes.length);
      assert.equal(file.sha256, createHash("sha256").update(bytes).digest("hex"));
    }

    const packageHash = createHash("sha256");

    for (const file of receipt.package.files) {
      packageHash.update(file.relativePath);
      packageHash.update("\0");
      packageHash.update(file.sha256);
      packageHash.update("\0");
      packageHash.update(String(file.bytes));
      packageHash.update("\n");
    }

    assert.equal(receipt.package.sha256, packageHash.digest("hex"));
    assert.equal(existsSync(receiptPath), true, `${adapter.id} receipt should be written`);
    assert.deepEqual(JSON.parse(readFileSync(receiptPath, "utf8")), receipt);
  }
} finally {
  rmSync(outputRoot, { recursive: true, force: true });
}

console.log("Adobe UXP package output receipts verified");
