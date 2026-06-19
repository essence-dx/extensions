import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildCanvaApp } from "../build-canva-app.ts";
import { buildFigmaPlugin } from "../build-figma-plugin.ts";
import { writeFigmaCanvaPackageOutputReceipt } from "../write-figma-canva-package-output-receipts.ts";
import { assertSourceInputReceipt } from "./sourceInputReceiptAssertions.ts";

const root = process.cwd();
const outputRoot = mkdtempSync(join(tmpdir(), "dx-figma-canva-package-output-"));

try {
  await verifyFigmaReceipt();
  await verifyCanvaReceipt();
} finally {
  rmSync(outputRoot, { recursive: true, force: true });
}

console.log("Figma and Canva package output receipts verified");

async function verifyFigmaReceipt(): Promise<void> {
  const adapterRoot = join(root, "hosts", "figma", "dx-figma");
  const packageRoot = join(outputRoot, "figma-package");
  const receiptPath = join(outputRoot, "figma-receipts", "package-output-latest.json");

  mkdirSync(packageRoot, { recursive: true });
  copyFileSync(join(adapterRoot, "manifest.json"), join(packageRoot, "manifest.json"));
  copyFileSync(join(adapterRoot, "ui.html"), join(packageRoot, "ui.html"));

  const buildResult = await buildFigmaPlugin({
    adapterRoot,
    outputRoot: packageRoot
  });

  const receipt = writeFigmaCanvaPackageOutputReceipt({
    adapterId: "dx.figma.command-center",
    host: "figma",
    adapterRoot,
    packageRoot,
    receiptPath,
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run build:figma:j1"
  });

  assert.equal(receipt.receipt, "dx.extension.figma_canva.package_output");
  assert.equal(receipt.adapterId, "dx.figma.command-center");
  assert.equal(receipt.host, "figma");
  assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
  assert.equal(receipt.verificationCommand, "npm run build:figma:j1");
  assert.equal(receipt.receiptPath, receiptPath);
  assert.equal(receipt.package.root, packageRoot);
  assert.equal(receipt.package.fileCount, 4);
  assert.deepEqual(
    receipt.package.files.map((file) => file.relativePath),
    ["main.js", "main.js.map", "manifest.json", "ui.html"]
  );
  assert.equal(receipt.hostPolicy.entrypoint, "main.js");
  assert.equal(receipt.hostPolicy.configFile, "manifest.json");
  assert.equal(receipt.hostPolicy.productionNetworkRestricted, true);
  assert.equal(receipt.hostPolicy.runtimePermissionsEmpty, true);
  assert.deepEqual(receipt.inputs, buildResult.inputs);
  assertSourceInputReceipt(receipt, adapterRoot, [
    "manifest.json",
    "src/commandPlans.ts",
    "src/main.ts",
    "src/messages.ts",
    "ui.html"
  ]);
  assert.deepEqual(receipt.externalModules, []);
  assert.deepEqual(receipt.releaseClaims, {
    loadedHostVerified: false,
    localServiceVerified: false,
    signingVerified: false,
    releaseChecksumVerified: false,
    distributionVerified: false
  });

  assertPackageHashes(receipt.package.root, receipt.package.files, receipt.package.sha256);
  assert.equal(existsSync(receiptPath), true, "Figma receipt should be written");
  assert.deepEqual(JSON.parse(readFileSync(receiptPath, "utf8")), receipt);
}

async function verifyCanvaReceipt(): Promise<void> {
  const adapterRoot = join(root, "hosts", "canva", "dx-canva");
  const packageRoot = join(outputRoot, "canva-package");
  const receiptPath = join(outputRoot, "canva-receipts", "package-output-latest.json");

  mkdirSync(packageRoot, { recursive: true });
  copyFileSync(join(adapterRoot, "canva-app.json"), join(packageRoot, "canva-app.json"));

  const buildResult = await buildCanvaApp({
    adapterRoot,
    outputRoot: packageRoot
  });

  const receipt = writeFigmaCanvaPackageOutputReceipt({
    adapterId: "dx.canva.command-center",
    host: "canva",
    adapterRoot,
    packageRoot,
    receiptPath,
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run build:canva:j1"
  });

  assert.equal(receipt.receipt, "dx.extension.figma_canva.package_output");
  assert.equal(receipt.adapterId, "dx.canva.command-center");
  assert.equal(receipt.host, "canva");
  assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
  assert.equal(receipt.verificationCommand, "npm run build:canva:j1");
  assert.equal(receipt.receiptPath, receiptPath);
  assert.equal(receipt.package.root, packageRoot);
  assert.equal(receipt.package.fileCount, 3);
  assert.deepEqual(
    receipt.package.files.map((file) => file.relativePath),
    ["app.js", "app.js.map", "canva-app.json"]
  );
  assert.equal(receipt.hostPolicy.entrypoint, "app.js");
  assert.equal(receipt.hostPolicy.configFile, "canva-app.json");
  assert.equal(receipt.hostPolicy.productionNetworkRestricted, true);
  assert.equal(receipt.hostPolicy.runtimePermissionsEmpty, true);
  assert.deepEqual(receipt.inputs, buildResult.inputs);
  assertSourceInputReceipt(receipt, adapterRoot, [
    "canva-app.json",
    "src/app.tsx",
    "src/commandPlans.ts",
    "src/messages.ts"
  ]);
  assert.deepEqual(receipt.externalModules, []);
  assert.deepEqual(receipt.releaseClaims, {
    loadedHostVerified: false,
    localServiceVerified: false,
    signingVerified: false,
    releaseChecksumVerified: false,
    distributionVerified: false
  });

  assertPackageHashes(receipt.package.root, receipt.package.files, receipt.package.sha256);
  assert.equal(existsSync(receiptPath), true, "Canva receipt should be written");
  assert.deepEqual(JSON.parse(readFileSync(receiptPath, "utf8")), receipt);
}

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
