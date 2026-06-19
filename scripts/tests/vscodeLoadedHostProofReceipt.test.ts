import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import {
  hashSourceInputs,
  readSourceInputProofs,
  vsCodePackageSourceInputs
} from "../lib/source-input-proof.ts";
import { writeVsCodeLoadedHostProofReceipt } from "../write-vscode-loaded-host-proof-receipts.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-vscode-loaded-host-proof-"));
const adapterId = "dx.vscode.command-center";
const receiptRoot = join(workspaceRoot, ".dx", "receipts", "extensions", adapterId);

try {
  const packageOutput = writePackageOutputReceipt();
  const vscodeExecutablePath = writeWorkspaceFile("tools/Code.exe", "vscode executable\n");
  const workspacePath = dirname(writeWorkspaceFile("tmp/workspace/README.md", "# smoke workspace\n"));
  const proofFilePath = writeWorkspaceFile("proof/vscode-loaded-host.txt", "loaded VS Code proof\n");
  const proofPath = writeWorkspaceJson("proof/vscode-loaded-host.json", {
    vscodeExecutablePath,
    vscodeVersion: "1.101.0",
    extensionId: "dx-runtime.dx-vscode",
    packageOutputReceiptPath: packageOutput.receiptPath,
    workspacePath,
    proofFilePath,
    extensionDevelopmentHostVerified: true,
    commandIds: ["dx.openCommandCenter", "dx.showStatus"],
    storesProcessOutput: false
  });

  const receipt = writeVsCodeLoadedHostProofReceipt(workspaceRoot, {
    generatedAt: "2026-06-09T00:00:00.000Z",
    proofPath,
    verificationCommand: "npm run smoke:vscode-loaded-host:j1"
  });

  assert.equal(receipt.schema_version, "dx.extension.vscode_loaded_host_smoke.v1");
  assert.equal(receipt.adapterId, adapterId);
  assert.equal(receipt.extension_id, "dx-runtime.dx-vscode");
  assert.equal(receipt.command_count, 2);
  assert.deepEqual(receipt.commandIds, ["dx.openCommandCenter", "dx.showStatus"]);
  assert.deepEqual(receipt.packageOutput, {
    receiptPath: packageOutput.receiptPath,
    receiptSha256: sha256(readFileSync(packageOutput.receiptPath)),
    packageSha256: packageOutput.packageSha256,
    vsixSha256: packageOutput.vsixSha256
  });
  assert.equal(receipt.workspace_kind, "temporary");
  assert.equal(receipt.workspace_path, workspacePath.replaceAll("\\", "/"));
  assert.equal(receipt.loaded_host, "vscode");
  assert.equal(receipt.status, "passed");
  assert.equal(receipt.stores_process_output, false);
  assert.deepEqual(receipt.releaseClaims, {
    loadedExtensionHostVerified: true,
    packageOutputVerified: true,
    localServiceVerified: false,
    signingVerified: false,
    releaseChecksumVerified: false,
    marketplaceReviewVerified: false,
    distributionVerified: false
  });
  assert.deepEqual(receipt.host, {
    executablePath: vscodeExecutablePath,
    version: "1.101.0"
  });
  assert.deepEqual(receipt.manualProof, {
    proofFilePath,
    proofFileSha256: sha256(readFileSync(proofFilePath))
  });
  assert.deepEqual(
    JSON.parse(readFileSync(join(receiptRoot, "vscode-loaded-host-latest.json"), "utf8")),
    receipt
  );

  assert.throws(
    () =>
      writeVsCodeLoadedHostProofReceipt(workspaceRoot, {
        proofPath: "proof/vscode-loaded-host.json"
      }),
    /VS Code loaded-host proof JSON must be an absolute path/
  );

  const weakProofPath = writeWorkspaceJson("proof/weak-vscode-loaded-host.json", {
    vscodeExecutablePath,
    vscodeVersion: "1.101.0",
    extensionId: "dx-runtime.dx-vscode",
    packageOutputReceiptPath: packageOutput.receiptPath,
    workspacePath,
    proofFilePath,
    extensionDevelopmentHostVerified: false,
    commandIds: ["dx.openCommandCenter", "dx.showStatus"],
    storesProcessOutput: false
  });

  assert.throws(
    () =>
      writeVsCodeLoadedHostProofReceipt(workspaceRoot, {
        proofPath: weakProofPath
      }),
    /VS Code loaded-host proof must verify the Extension Development Host/
  );

  const rootPackage = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));

  assert.equal(
    rootPackage.scripts["test:vscode-loaded-host-proof-receipts"],
    "node --experimental-strip-types scripts/tests/vscodeLoadedHostProofReceipt.test.ts"
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("VS Code loaded-host proof receipt verified");

function writePackageOutputReceipt(): {
  packageSha256: string;
  receiptPath: string;
  vsixSha256: string;
} {
  const packageRoot = join(workspaceRoot, "hosts", "vscode", "dx-vscode");
  const packageJsonPath = writeWorkspaceFile(
    "hosts/vscode/dx-vscode/package.json",
    `${JSON.stringify(
      {
        name: "dx-vscode",
        publisher: "dx-runtime"
      },
      null,
      2
    )}\n`
  );
  writeVsCodeSourceInputs();
  const packageFile = fileProof(packageRoot, packageJsonPath, "package.json");
  const packageSha256 = hashPackageFiles([packageFile]);
  const sourceProof = readVsCodeSourceProof(packageRoot);
  const vsixPath = writeWorkspaceFile("hosts/vscode/dx-vscode/dx-vscode-0.1.0.vsix", "vsix bytes\n");
  const vsixBytes = readFileSync(vsixPath);
  const receiptPath = writeWorkspaceJson(`.dx/receipts/extensions/${adapterId}/package-output-latest.json`, {
    receipt: "dx.extension.vscode.package_output",
    adapterId,
    host: "vscode",
    package: {
      root: packageRoot,
      format: "vscode-vsix-package-layout",
      fileCount: 1,
      sha256: packageSha256,
      files: [packageFile]
    },
    inputs: vsCodePackageSourceInputs,
    sourceRoot: sourceProof.sourceRoot,
    sourceInputs: sourceProof.sourceInputs,
    sourceSha256: sourceProof.sourceSha256,
    packageManifest: {
      name: "dx-vscode",
      displayName: "DX Command Center",
      version: "0.1.0",
      publisher: "dx-runtime",
      main: "./dist/extension.js",
      commandCount: 2,
      activationEventCount: 2
    },
    vsix: {
      path: vsixPath,
      fileName: basename(vsixPath),
      bytes: vsixBytes.length,
      sha256: sha256(vsixBytes),
      zipHeaderVerified: true
    },
    releaseClaims: {
      loadedExtensionHostVerified: false,
      localServiceVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      marketplaceReviewVerified: false,
      distributionVerified: false
    }
  });

  return {
    packageSha256,
    receiptPath,
    vsixSha256: sha256(vsixBytes)
  };
}

function writeWorkspaceJson(relativePath: string, value: unknown): string {
  return writeWorkspaceFile(relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeWorkspaceFile(relativePath: string, source: string): string {
  const absolutePath = join(workspaceRoot, ...relativePath.split("/"));

  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);

  return absolutePath;
}

function writeVsCodeSourceInputs(): void {
  for (const relativePath of vsCodePackageSourceInputs) {
    if (relativePath === "package.json") {
      continue;
    }

    writeWorkspaceFile(`hosts/vscode/dx-vscode/${relativePath}`, `VS Code source for ${relativePath}\n`);
  }
}

function readVsCodeSourceProof(packageRoot: string): {
  sourceRoot: string;
  sourceInputs: ReturnType<typeof readSourceInputProofs>;
  sourceSha256: string;
} {
  const sourceInputs = readSourceInputProofs(packageRoot, vsCodePackageSourceInputs);

  return {
    sourceRoot: packageRoot,
    sourceInputs,
    sourceSha256: hashSourceInputs(sourceInputs)
  };
}

function fileProof(root: string, absolutePath: string, relativePath: string): {
  bytes: number;
  relativePath: string;
  sha256: string;
} {
  const bytes = readFileSync(absolutePath);

  assert.equal(absolutePath, join(root, ...relativePath.split("/")));

  return {
    bytes: bytes.length,
    relativePath,
    sha256: sha256(bytes)
  };
}

function hashPackageFiles(files: Array<{ relativePath: string; bytes: number; sha256: string }>): string {
  const hash = createHash("sha256");

  for (const file of files) {
    hash.update(file.relativePath);
    hash.update("\0");
    hash.update(file.sha256);
    hash.update("\0");
    hash.update(String(file.bytes));
    hash.update("\n");
  }

  return hash.digest("hex");
}

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}
