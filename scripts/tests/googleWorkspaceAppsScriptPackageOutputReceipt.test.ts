import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildGoogleWorkspaceAppsScriptOutput } from "../build-google-workspace-apps-script-output.ts";
import { verifyPackageOutputReceipt } from "../lib/package-output-proof.ts";
import { classifyPackageOutputWeakness } from "../lib/release-evidence-package-output-classifier.ts";
import { writeGoogleWorkspaceAppsScriptPackageOutputReceipt } from "../write-google-workspace-apps-script-package-output-receipt.ts";

const root = process.cwd();
const adapterRoot = join(root, "hosts", "google-workspace", "dx-google-workspace-addon");
const outputRoot = mkdtempSync(join(tmpdir(), "dx-google-workspace-package-output-"));
const receiptPath = join(outputRoot, "receipts", "package-output-latest.json");

try {
  const buildResult = buildGoogleWorkspaceAppsScriptOutput({
    adapterRoot,
    outputRoot
  });

  const receipt = writeGoogleWorkspaceAppsScriptPackageOutputReceipt({
    adapterRoot,
    packageRoot: buildResult.outputRoot,
    receiptPath,
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run build:google-workspace-apps-script:j1"
  });

  assert.equal(receipt.receipt, "dx.extension.google_workspace.apps_script_package_output");
  assert.equal(receipt.adapterId, "dx.google-workspace.command-center");
  assert.equal(receipt.host, "google-workspace");
  assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
  assert.equal(receipt.verificationCommand, "npm run build:google-workspace-apps-script:j1");
  assert.equal(receipt.receiptPath, receiptPath);
  assert.equal(receipt.package.root, outputRoot);
  assert.equal(receipt.package.fileCount, 2);
  assert.deepEqual(
    receipt.package.files.map((file) => file.relativePath),
    ["Code.gs", "appsscript.json"]
  );
  assert.deepEqual(receipt.inputs, [
    "appsscript.json",
    "src/cards.ts",
    "src/commandPlans.ts",
    "src/entrypoints.ts",
    "src/localServiceBoundary.ts",
    "src/messages.ts"
  ]);
  assert.equal(receipt.sourceRoot, adapterRoot);
  assert.deepEqual(
    receipt.sourceInputs.map((input) => input.relativePath),
    [
      "appsscript.json",
      "src/cards.ts",
      "src/commandPlans.ts",
      "src/entrypoints.ts",
      "src/localServiceBoundary.ts",
      "src/messages.ts"
    ]
  );
  assertPackageHashes(receipt.sourceRoot, receipt.sourceInputs, receipt.sourceSha256);
  assert.equal(classifyPackageOutputWeakness("package_output", receipt), undefined);
  assert.equal(verifyPackageOutputReceipt("dx.google-workspace.command-center", receipt).filesVerified, 2);

  const staleReceipt = structuredClone(receipt);
  staleReceipt.sourceInputs[1].sha256 = "0".repeat(64);
  assert.match(
    classifyPackageOutputWeakness("package_output", staleReceipt) ?? "",
    /source input hash changed/
  );
  assert.throws(
    () => verifyPackageOutputReceipt("dx.google-workspace.command-center", staleReceipt),
    /source input hash changed/
  );

  assert.deepEqual(receipt.entrypoints, buildResult.entrypoints);
  assert.deepEqual(receipt.actions, buildResult.actions);
  assert.deepEqual(receipt.manifest, {
    runtimeVersion: "V8",
    oauthScopesEmpty: true,
    homepageTrigger: "showDxCommandCenter"
  });
  assert.deepEqual(receipt.releaseClaims, {
    appsScriptDeploymentVerified: false,
    oauthReviewVerified: false,
    workspaceFileSmokeVerified: false,
    cloudServiceVerified: false,
    signingVerified: false,
    releaseChecksumVerified: false,
    marketplaceApproved: false,
    distributionVerified: false
  });

  assertPackageHashes(receipt.package.root, receipt.package.files, receipt.package.sha256);
  assert.equal(existsSync(receiptPath), true, "Google Workspace receipt should be written");
  assert.deepEqual(JSON.parse(readFileSync(receiptPath, "utf8")), receipt);
} finally {
  rmSync(outputRoot, { recursive: true, force: true });
}

console.log("Google Workspace Apps Script package output receipt verified");

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
