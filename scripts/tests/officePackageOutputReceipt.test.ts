import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildOfficeSideloadManifestOutput } from "../build-office-sideload-manifests.ts";
import { buildOfficeTaskpaneAssets } from "../build-office-taskpane-assets.ts";
import { verifyPackageOutputReceipt } from "../lib/package-output-proof.ts";
import { classifyPackageOutputWeakness } from "../lib/release-evidence-package-output-classifier.ts";
import { writeOfficePackageOutputReceipt } from "../write-office-package-output-receipts.ts";

const root = process.cwd();
const outputRoot = mkdtempSync(join(tmpdir(), "dx-office-package-output-"));
const baseUrl = "https://localhost:3979";
const adapters = [
  {
    name: "Excel",
    host: "excel",
    folder: "dx-excel",
    adapterId: "dx.excel.command-center",
    route: "excel",
    officeHost: "Workbook"
  },
  {
    name: "PowerPoint",
    host: "powerpoint",
    folder: "dx-powerpoint",
    adapterId: "dx.powerpoint.command-center",
    route: "powerpoint",
    officeHost: "Presentation"
  },
  {
    name: "Word",
    host: "word",
    folder: "dx-word",
    adapterId: "dx.word.command-center",
    route: "word",
    officeHost: "Document"
  }
] as const;
const sharedOfficeSourceInput = "shared/localServiceBoundary.ts";

try {
  for (const adapter of adapters) {
    const adapterRoot = join(root, "hosts", "office", adapter.folder);
    const packageRoot = join(outputRoot, adapter.folder);
    const receiptPath = join(outputRoot, adapter.folder, "receipts", "package-output-latest.json");
    const assetResult = await buildOfficeTaskpaneAssets({
      adapterRoot,
      outputRoot: packageRoot
    });
    const manifestResult = buildOfficeSideloadManifestOutput({
      adapterRoot,
      outputRoot: packageRoot,
      baseUrl
    });

    const receipt = writeOfficePackageOutputReceipt({
      adapterId: adapter.adapterId,
      host: adapter.host,
      adapterRoot,
      packageRoot,
      receiptPath,
      generatedAt: "2026-06-07T00:00:00.000Z",
      verificationCommand: "npm run build:office-taskpane:j1"
    });

    assert.equal(receipt.receipt, "dx.extension.office_taskpane.package_output");
    assert.equal(receipt.adapterId, adapter.adapterId);
    assert.equal(receipt.host, adapter.host);
    assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
    assert.equal(receipt.verificationCommand, "npm run build:office-taskpane:j1");
    assert.equal(receipt.receiptPath, receiptPath);
    assert.equal(receipt.package.root, packageRoot);
    assert.equal(receipt.package.fileCount, 4);
    assert.deepEqual(
      receipt.package.files.map((file) => file.relativePath),
      ["manifest.xml", "taskpane.html", "taskpane.js", "taskpane.js.map"]
    );
    assert.equal(receipt.manifest.officeHost, adapter.officeHost);
    assert.equal(receipt.manifest.permission, "ReadDocument");
    assert.equal(receipt.manifest.taskpaneUrl, `${baseUrl}/${adapter.route}/taskpane.html`);
    assert.equal(receipt.manifest.placeholderOriginRemoved, true);
    assert.deepEqual(
      receipt.inputs,
      [
        `${adapter.folder}/manifest.xml`,
        `${adapter.folder}/src/commandPlans.ts`,
        `${adapter.folder}/src/messages.ts`,
        `${adapter.folder}/src/taskpane.ts`,
        `${adapter.folder}/static/taskpane.html`,
        sharedOfficeSourceInput
      ]
    );
    assert.deepEqual(assetResult.inputs, [
      "../shared/localServiceBoundary.ts",
      "src/commandPlans.ts",
      "src/messages.ts",
      "src/taskpane.ts"
    ]);
    assert.equal(receipt.sourceRoot, join(root, "hosts", "office"));
    assert.deepEqual(
      receipt.sourceInputs.map((input) => input.relativePath),
      [
        `${adapter.folder}/manifest.xml`,
        `${adapter.folder}/src/commandPlans.ts`,
        `${adapter.folder}/src/messages.ts`,
        `${adapter.folder}/src/taskpane.ts`,
        `${adapter.folder}/static/taskpane.html`,
        sharedOfficeSourceInput
      ]
    );
    assertPackageHashes(receipt.sourceRoot, receipt.sourceInputs, receipt.sourceSha256);
    assert.equal(classifyPackageOutputWeakness("package_output", receipt), undefined);
    assert.equal(verifyPackageOutputReceipt(adapter.adapterId, receipt).filesVerified, 4);

    const staleReceipt = structuredClone(receipt);
    staleReceipt.sourceInputs[0].sha256 = "0".repeat(64);
    assert.match(
      classifyPackageOutputWeakness("package_output", staleReceipt) ?? "",
      /source input hash changed/
    );
    assert.throws(
      () => verifyPackageOutputReceipt(adapter.adapterId, staleReceipt),
      /source input hash changed/
    );

    assert.deepEqual(receipt.externalModules, []);
    assert.deepEqual(receipt.releaseClaims, {
      sideloadedHostVerified: false,
      localServiceVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      appSourceApproved: false,
      distributionVerified: false
    });
    assert.equal(manifestResult.outputPath, join(packageRoot, "manifest.xml"));
    assertPackageHashes(receipt.package.root, receipt.package.files, receipt.package.sha256);
    assert.equal(existsSync(receiptPath), true, `${adapter.name} receipt should be written`);
    assert.deepEqual(JSON.parse(readFileSync(receiptPath, "utf8")), receipt);
  }
} finally {
  rmSync(outputRoot, { recursive: true, force: true });
}

console.log("Office package output receipts verified");

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
