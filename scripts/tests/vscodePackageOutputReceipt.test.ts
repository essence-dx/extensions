import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { writeZipArtifactProof } from "../lib/package-artifact-proof.ts";
import { assertSourceInputReceipt } from "./sourceInputReceiptAssertions.ts";
import { writeVsCodePackageOutputReceipt } from "../write-vscode-package-output-receipt.ts";

const root = process.cwd();
const sourceAdapterRoot = join(root, "hosts", "vscode", "dx-vscode");
const vsCodeSourceInputs = [
  ".vscodeignore",
  "README.md",
  "package.json",
  "src/commands/commandCenter.ts",
  "src/commands/commandCenterDispatch.ts",
  "src/commands/commandIds.ts",
  "src/commands/listForgePackages.ts",
  "src/commands/openReceipts.ts",
  "src/commands/receiptActions.ts",
  "src/commands/registerCommands.ts",
  "src/commands/runDoctor.ts",
  "src/commands/runHostUiCommand.ts",
  "src/commands/runTrustedCommand.ts",
  "src/commands/searchIcons.ts",
  "src/commands/showBuildGraph.ts",
  "src/commands/showCheckEditorState.ts",
  "src/commands/showLatestCheckReceipt.ts",
  "src/commands/showStatus.ts",
  "src/dx/cli.ts",
  "src/dx/commandPlan.ts",
  "src/dx/configuration.ts",
  "src/dx/iconSearch.ts",
  "src/extension.ts"
];
const packageRoot = mkdtempSync(join(tmpdir(), "dx-vscode-package-output-"));
const receiptPath = join(packageRoot, "receipts", "package-output-latest.json");
const vsixPath = join(packageRoot, "dx-vscode-0.1.0.vsix");

try {
  copyWorkspaceFile("package.json");
  copyWorkspaceFile("README.md");
  copyWorkspaceFile(".vscodeignore");
  writePackageFile("dist/extension.js", "module.exports = { activate() {}, deactivate() {} };\n");
  writeZipArtifactProof(vsixPath, [
    {
      relativePath: "extension/package.json",
      sourcePath: join(packageRoot, "package.json")
    },
    {
      relativePath: "extension/readme.md",
      sourcePath: join(packageRoot, "README.md")
    },
    {
      relativePath: "extension/dist/extension.js",
      sourcePath: join(packageRoot, "dist", "extension.js")
    }
  ]);

  const receipt = writeVsCodePackageOutputReceipt({
    adapterRoot: sourceAdapterRoot,
    packageRoot,
    vsixPath,
    receiptPath,
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run package:vscode:j1"
  });

  assert.equal(receipt.receipt, "dx.extension.vscode.package_output");
  assert.equal(receipt.adapterId, "dx.vscode.command-center");
  assert.equal(receipt.host, "vscode");
  assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
  assert.equal(receipt.verificationCommand, "npm run package:vscode:j1");
  assert.equal(receipt.receiptPath, receiptPath);
  assert.equal(receipt.package.root, packageRoot);
  assert.equal(receipt.package.format, "vscode-vsix-package-layout");
  assert.deepEqual(receipt.inputs, vsCodeSourceInputs);
  assertSourceInputReceipt(receipt, sourceAdapterRoot, vsCodeSourceInputs);
  assert.equal(receipt.package.fileCount, 3);
  assert.deepEqual(
    receipt.package.files.map((file) => file.relativePath),
    ["dist/extension.js", "package.json", "readme.md"]
  );
  assert.deepEqual(receipt.packageManifest, {
    name: "dx-vscode",
    displayName: "DX Command Center",
    version: "0.1.0",
    publisher: "dx-runtime",
    main: "./dist/extension.js",
    commandCount: 10,
    activationEventCount: 10
  });
  assert.equal(receipt.vsix.path, vsixPath);
  assert.equal(receipt.vsix.fileName, "dx-vscode-0.1.0.vsix");
  assert.equal(receipt.vsix.zipHeaderVerified, true);
  assert.deepEqual(receipt.releaseClaims, {
    loadedExtensionHostVerified: false,
    localServiceVerified: false,
    signingVerified: false,
    releaseChecksumVerified: false,
    marketplaceReviewVerified: false,
    distributionVerified: false
  });

  assertPackageHashes(receipt.package.root, receipt.package.files, receipt.package.sha256);
  assert.equal(receipt.vsix.sha256, createHash("sha256").update(readFileSync(vsixPath)).digest("hex"));
  assert.equal(existsSync(receiptPath), true, "VS Code package receipt should be written");
  assert.deepEqual(JSON.parse(readFileSync(receiptPath, "utf8")), receipt);
} finally {
  rmSync(packageRoot, { recursive: true, force: true });
}

console.log("VS Code package output receipt verified");

function copyWorkspaceFile(relativePath: string): void {
  const targetPath = join(packageRoot, relativePath);
  mkdirSync(dirname(targetPath), { recursive: true });
  copyFileSync(join(sourceAdapterRoot, relativePath), targetPath);
}

function writePackageFile(relativePath: string, source: string): void {
  const targetPath = join(packageRoot, relativePath);
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, source);
}

function assertPackageHashes(
  packageRootPath: string,
  files: Array<{ relativePath: string; bytes: number; sha256: string }>,
  actualPackageHash: string
): void {
  const packageHash = createHash("sha256");

  for (const file of files) {
    const bytes = readFileSync(join(packageRootPath, file.relativePath));

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
