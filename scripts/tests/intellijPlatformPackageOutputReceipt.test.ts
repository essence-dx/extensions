import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { writeIntellijPlatformPackageOutputReceipt } from "../write-intellij-platform-package-output-receipt.ts";

const root = process.cwd();
const adapterRoot = join(root, "hosts", "jetbrains", "dx-intellij-platform");
const receiptRoot = mkdtempSync(join(tmpdir(), "dx-intellij-package-output-"));
const receiptPath = join(receiptRoot, "receipts", "package-output-latest.json");

try {
  const receipt = writeIntellijPlatformPackageOutputReceipt({
    adapterRoot,
    packageRoot: adapterRoot,
    receiptPath,
    gradlePluginPackagePath: join(receiptRoot, "artifacts", "dx-intellij-platform-0.1.0.zip"),
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run package:intellij-platform:j1"
  });

  assert.equal(receipt.receipt, "dx.extension.intellij_platform.package_output");
  assert.equal(receipt.adapterId, "dx.intellij-platform.command-center");
  assert.equal(receipt.host, "intellij-platform");
  assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
  assert.equal(receipt.verificationCommand, "npm run package:intellij-platform:j1");
  assert.equal(receipt.receiptPath, receiptPath);
  assert.equal(receipt.package.root, adapterRoot);
  assert.equal(receipt.package.format, "intellij-platform-gradle-source-layout");
  assert.equal(receipt.package.fileCount, 11);
  assert.deepEqual(
    receipt.package.files.map((file) => file.relativePath),
    [
      "README.md",
      "build.gradle.kts",
      "dx.extension.toml",
      "gradle.properties",
      "settings.gradle.kts",
      "src/main/kotlin/dev/dx/intellij/actions/DxCommandCenterAction.kt",
      "src/main/kotlin/dev/dx/intellij/commands/DxCommandPlans.kt",
      "src/main/kotlin/dev/dx/intellij/services/DxCommandPlanService.kt",
      "src/main/kotlin/dev/dx/intellij/toolwindow/DxToolWindowFactory.kt",
      "src/main/resources/META-INF/plugin.xml",
      "src/main/resources/icons/dx.svg"
    ]
  );
  assert.deepEqual(receipt.pluginXml, {
    id: "dev.dx.intellij-platform.command-center",
    name: "DX IntelliJ Platform Command Center",
    vendor: "DX",
    dependency: "com.intellij.modules.platform",
    actionCount: 3,
    hasToolWindow: true,
    hasProjectService: true
  });
  assert.deepEqual(receipt.commandPlans, {
    commandCount: 3,
    mutatesProject: false,
    localServiceProofRequired: true
  });
  assertArchiveProof(receipt.gradlePluginPackage, ".zip", [0x50, 0x4b, 0x03, 0x04]);
  assert.equal(receipt.gradlePluginPackage.zipHeaderVerified, true);
  assert.deepEqual(receipt.releaseClaims, {
    sandboxIdeVerified: false,
    pluginVerifierVerified: false,
    gradlePluginPackageVerified: false,
    localServiceVerified: false,
    signingVerified: false,
    releaseChecksumVerified: false,
    marketplaceReviewVerified: false,
    distributionVerified: false
  });

  assertPackageHashes(receipt.package.root, receipt.package.files, receipt.package.sha256);
  assert.equal(existsSync(receipt.gradlePluginPackage.path), true, "IntelliJ artifact should be written");
  assert.equal(existsSync(receiptPath), true, "IntelliJ Platform receipt should be written");
  assert.deepEqual(JSON.parse(readFileSync(receiptPath, "utf8")), receipt);
} finally {
  rmSync(receiptRoot, { recursive: true, force: true });
}

console.log("IntelliJ Platform package output receipt verified");

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
