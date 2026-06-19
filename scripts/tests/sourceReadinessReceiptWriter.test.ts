import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  validateSourceReadinessReceiptFiles,
  writeSourceReadinessReceipts
} from "../write-source-readiness-receipts.ts";
import {
  hashSourceInputs,
  readSourceInputProofs,
  vsCodePackageSourceInputs
} from "../lib/source-input-proof.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-source-readiness-receipts-"));
const generatedAt = "2026-06-07T00:00:00.000Z";

try {
  writeValidWorkspace(workspaceRoot);
  writePackageOutputReceipt("dx.vscode.command-center", "vscode");
  writeChecksumReceipt("dx.vscode.command-center", "vscode");

  const result = writeSourceReadinessReceipts(workspaceRoot, {
    generatedAt,
    verificationCommand: "npm run test:j1"
  });

  assert.deepEqual(
    result.written.map((receipt) => receipt.id),
    ["dx.vscode.command-center", "dx.browser.command-center"]
  );

  const vscodeReceipt = readReceipt(
    workspaceRoot,
    ".dx/receipts/extensions/dx.vscode.command-center/readiness-latest.json"
  );
  assert.equal(vscodeReceipt.schema, "dx.extension_readiness.receipt");
  assert.equal(vscodeReceipt.manifest_version, 1);
  assert.equal(vscodeReceipt.extension_id, "dx.vscode.command-center");
  assert.equal(vscodeReceipt.readiness_stage, "source-level");
  assert.equal(vscodeReceipt.release_ready, false);
  assert.equal(vscodeReceipt.loaded_host_verified, false);
  assert.equal(vscodeReceipt.package_verified, true);
  assert.equal(vscodeReceipt.signing_verified, false);
  assert.equal(vscodeReceipt.checksum_verified, true);
  assert.equal(vscodeReceipt.distribution_verified, false);
  assert.equal(vscodeReceipt.source_guard, "test:vscode-package-verifier");
  assert.equal(vscodeReceipt.verification_command, "npm run test:j1");
  assert.equal(vscodeReceipt.generated_at, generatedAt);
  assert.deepEqual(vscodeReceipt.blocked_by, [
    "loaded-host receipt",
    "signing receipt",
    "distribution review proof"
  ]);

  const browserReceipt = readReceipt(
    workspaceRoot,
    ".dx/receipts/extensions/dx.browser.command-center/readiness-latest.json"
  );
  assert.equal(browserReceipt.package_verified, false);
  assert.equal(browserReceipt.checksum_verified, false);
  assert.deepEqual(browserReceipt.blocked_by, [
    "loaded-host receipt",
    "package proof",
    "checksum receipt",
    "signing receipt",
    "distribution review proof"
  ]);

  assert.deepEqual(
    validateSourceReadinessReceiptFiles(workspaceRoot),
    [],
    "fresh source-readiness receipts should validate"
  );

  writeReceipt(
    workspaceRoot,
    ".dx/receipts/extensions/dx.vscode.command-center/readiness-latest.json",
    {
      ...vscodeReceipt,
      release_ready: true
    }
  );
  assertMessages(validateSourceReadinessReceiptFiles(workspaceRoot), [
    "source readiness receipt for dx.vscode.command-center must not claim release readiness"
  ]);

  writeSourceReadinessReceipts(workspaceRoot, {
    generatedAt,
    verificationCommand: "npm run test:j1"
  });
  writeReceipt(
    workspaceRoot,
    ".dx/receipts/extensions/dx.browser.command-center/readiness-latest.json",
    {
      ...readReceipt(
        workspaceRoot,
        ".dx/receipts/extensions/dx.browser.command-center/readiness-latest.json"
      ),
      blocked_by: []
    }
  );
  assertMessages(validateSourceReadinessReceiptFiles(workspaceRoot), [
    "source readiness receipt blocked_by for dx.browser.command-center must include at least one deferred proof"
  ]);
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("source readiness receipt writer verified");

function assertMessages(actualMessages: string[], expectedMessages: string[]): void {
  for (const message of expectedMessages) {
    assert.ok(
      actualMessages.includes(message),
      `expected validation message: ${message}\nactual: ${actualMessages.join("\n")}`
    );
  }
}

function writeValidWorkspace(root: string): void {
  writeWorkspaceFile(
    root,
    "registry/official-extensions.toml",
    [
      'schema = "dx.extensions.registry"',
      "manifest_version = 1",
      "",
      formatRegistryEntry("dx.vscode.command-center", "hosts/vscode/dx-vscode"),
      formatRegistryEntry("dx.browser.command-center", "hosts/browser/dx-browser")
    ].join("\n")
  );

  writeWorkspaceFile(
    root,
    "registry/extension-readiness.toml",
    [
      'schema = "dx.extension_readiness"',
      "manifest_version = 1",
      "",
      formatReadinessEntry("dx.vscode.command-center", "hosts/vscode/dx-vscode", "test:vscode-package-verifier"),
      formatReadinessEntry("dx.browser.command-center", "hosts/browser/dx-browser", "check:browser")
    ].join("\n")
  );
  writeWorkspaceFile(
    root,
    "registry/release-evidence-gates.toml",
    [
      'schema = "dx.release_evidence_gates"',
      "manifest_version = 1",
      "",
      formatReleaseGateEntry("dx.vscode.command-center"),
      formatReleaseGateEntry("dx.browser.command-center")
    ].join("\n")
  );
  writeWorkspaceFile(root, "hosts/vscode/dx-vscode/dx.extension.toml", "[extension]\nid = \"dx.vscode.command-center\"\n");
  writeWorkspaceFile(root, "hosts/browser/dx-browser/dx.extension.toml", "[extension]\nid = \"dx.browser.command-center\"\n");
  for (const relativePath of vsCodePackageSourceInputs) {
    writeWorkspaceFile(root, `hosts/vscode/dx-vscode/${relativePath}`, `source for ${relativePath}\n`);
  }
}

function formatRegistryEntry(id: string, path: string): string {
  return [
    "[[extensions]]",
    `id = "${id}"`,
    `name = "${id}"`,
    `path = "${path}"`,
    `manifest = "${path}/dx.extension.toml"`,
    'status = "experimental"',
    'professional_targets = ["fixture.host"]',
    ""
  ].join("\n");
}

function formatReadinessEntry(id: string, path: string, sourceGuard: string): string {
  return [
    "[[extensions]]",
    `id = "${id}"`,
    'stage = "source-level"',
    `manifest = "${path}/dx.extension.toml"`,
    `source_guard = "${sourceGuard}"`,
    `latest_readiness_receipt = ".dx/receipts/extensions/${id}/readiness-latest.json"`,
    'next_proof = "capture loaded-host receipt"',
    'blocked_by = ["loaded-host receipt", "package proof", "checksum receipt", "signing receipt", "distribution review proof"]',
    ""
  ].join("\n");
}

function formatReleaseGateEntry(id: string): string {
  return [
    "[[extensions]]",
    `id = "${id}"`,
    'stage = "not-release-ready"',
    'required_evidence = ["host_execution", "package_output", "signing", "checksum", "distribution_review"]',
    `evidence_receipt_requirements = ["host_execution=.dx/receipts/extensions/${id}/loaded-host-latest.json", "package_output=.dx/receipts/extensions/${id}/package-output-latest.json", "signing=.dx/receipts/extensions/${id}/signing-latest.json", "checksum=.dx/receipts/extensions/${id}/checksum-latest.json", "distribution_review=.dx/receipts/extensions/${id}/distribution-latest.json"]`,
    `evidence_receipts = [".dx/receipts/extensions/${id}/loaded-host-latest.json", ".dx/receipts/extensions/${id}/package-output-latest.json", ".dx/receipts/extensions/${id}/signing-latest.json", ".dx/receipts/extensions/${id}/checksum-latest.json", ".dx/receipts/extensions/${id}/distribution-latest.json"]`,
    'next_release_proof = "capture live host, signing, checksum, and distribution evidence"',
    'blocked_by = ["loaded-host receipt", "signing receipt", "distribution review"]',
    ""
  ].join("\n");
}

function writePackageOutputReceipt(adapterId: string, host: string): void {
  const packageRoot = join(workspaceRoot, "packages", adapterId);
  const sourceRoot = join(workspaceRoot, "hosts", "vscode", "dx-vscode");
  const sourceInputs =
    adapterId === "dx.vscode.command-center"
      ? readSourceInputProofs(sourceRoot, vsCodePackageSourceInputs)
      : undefined;
  writeWorkspaceFile(workspaceRoot, `packages/${adapterId}/entrypoint.txt`, `${adapterId}\n`);
  const file = readPackageFileProof(packageRoot, "entrypoint.txt");

  writeReceipt(workspaceRoot, `.dx/receipts/extensions/${adapterId}/package-output-latest.json`, {
    receipt: "dx.extension.blender.package_output",
    adapterId,
    host,
    package: {
      root: packageRoot,
      fileCount: 1,
      sha256: hashPackageFiles([file]),
      files: [file]
    },
    ...(sourceInputs
      ? {
          inputs: vsCodePackageSourceInputs,
          sourceRoot,
          sourceInputs,
          sourceSha256: hashSourceInputs(sourceInputs)
        }
      : {}),
    releaseClaims: {
      loadedHostVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      distributionVerified: false
    }
  });
}

function writeChecksumReceipt(adapterId: string, host: string): void {
  const packageReceiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    adapterId,
    "package-output-latest.json"
  );
  const releaseArtifactPath = writeWorkspaceFile(
    workspaceRoot,
    `release/${adapterId}.zip`,
    "public release artifact\n"
  );
  const releaseArtifactBytes = readFileSync(releaseArtifactPath);
  const packageOutputReceipt = JSON.parse(readFileSync(packageReceiptPath, "utf8"));

  writeReceipt(workspaceRoot, `.dx/receipts/extensions/${adapterId}/checksum-latest.json`, {
    receipt: "dx.extension.release_package.checksum",
    adapterId,
    host,
    packageOutput: {
      receiptPath: packageReceiptPath,
      receiptSha256: sha256(readFileSync(packageReceiptPath)),
      packageOutputSha256: packageOutputReceipt.package.sha256,
      fileCount: packageOutputReceipt.package.fileCount,
      filesVerified: packageOutputReceipt.package.fileCount
    },
    releaseArtifact: {
      path: releaseArtifactPath,
      kind: "zip",
      bytes: releaseArtifactBytes.length,
      sha256: sha256(releaseArtifactBytes),
      createdFromPackageOutput: true
    },
    checksum: {
      algorithm: "sha256",
      scope: "public-release-package",
      sha256: sha256(releaseArtifactBytes),
      bytes: releaseArtifactBytes.length
    },
    releaseClaims: {
      packageOutputVerified: true,
      publicReleasePackageVerified: true,
      releaseChecksumVerified: true,
      loadedHostVerified: false,
      signingVerified: false,
      distributionVerified: false
    }
  });
}

function readReceipt(root: string, relativePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(root, relativePath), "utf8"));
}

function writeReceipt(root: string, relativePath: string, receipt: Record<string, unknown>): void {
  writeWorkspaceFile(root, relativePath, `${JSON.stringify(receipt, null, 2)}\n`);
}

function writeWorkspaceFile(root: string, relativePath: string, source: string): string {
  const absolutePath = join(root, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);
  assert.equal(existsSync(absolutePath), true);

  return absolutePath;
}

function readPackageFileProof(packageRoot: string, relativePath: string) {
  const bytes = readFileSync(join(packageRoot, ...relativePath.split("/")));

  return {
    relativePath,
    bytes: bytes.length,
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
