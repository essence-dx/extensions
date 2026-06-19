import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { writeAffinityContentPackageReceipt } from "../write-affinity-content-package-receipt.ts";
import { assertSourceInputReceipt } from "./sourceInputReceiptAssertions.ts";

const root = process.cwd();
const adapterRoot = join(root, "hosts", "affinity", "dx-affinity-content");
const packageRoot = mkdtempSync(join(tmpdir(), "dx-affinity-content-package-"));
const receiptPath = join(packageRoot, "receipts", "content-package-latest.json");

try {
  writePackageFile(
    "affinity-content-manifest.json",
    JSON.stringify(
      {
        name: "DX Affinity Content Bridge",
        supportedHosts: ["Affinity Photo 2", "Affinity Designer 2", "Affinity Publisher 2"],
        supportedContentTypes: [
          { type: "assets", extensions: [".afassets"] },
          { type: "fonts", extensions: [".affont", ".otf", ".ttf"] },
          { type: "swatches", extensions: [".afpalette", ".ase"] }
        ],
        photoshopFilterCompatibility: {
          host: "Affinity Photo 2",
          compatiblePluginType: "64-bit Photoshop-compatible filter plugins",
          dxNativeFilterPlugin: "deferred"
        }
      },
      null,
      2
    )
  );
  writePackageFile("assets/dx-icons.afassets", "affinity asset package\n");
  writePackageFile("fonts/dx-fonts.affont", "affinity font package\n");
  writePackageFile("swatches/dx-colors.afpalette", "affinity swatch package\n");

  const receipt = writeAffinityContentPackageReceipt({
    adapterRoot,
    packageRoot,
    receiptPath,
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run package:affinity-content:j1"
  });

  assert.equal(receipt.receipt, "dx.extension.affinity_content.content_package");
  assert.equal(receipt.adapterId, "dx.affinity-content.bridge");
  assert.equal(receipt.host, "affinity");
  assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
  assert.equal(receipt.verificationCommand, "npm run package:affinity-content:j1");
  assert.equal(receipt.receiptPath, receiptPath);
  assert.equal(receipt.package.root, packageRoot);
  assert.equal(receipt.package.format, "affinity-content-package-layout");
  assert.equal(receipt.package.fileCount, 4);
  assert.deepEqual(
    receipt.contentArtifacts.map((artifact) => artifact.relativePath),
    ["assets/dx-icons.afassets", "fonts/dx-fonts.affont", "swatches/dx-colors.afpalette"]
  );
  assert.deepEqual(
    receipt.supportedHosts,
    ["Affinity Designer 2", "Affinity Photo 2", "Affinity Publisher 2"]
  );
  assert.deepEqual(receipt.contentTypes, ["assets", "fonts", "swatches"]);
  assertSourceInputReceipt(
    receipt,
    adapterRoot,
    ["affinity-content-manifest.json", "src/contentPlans.ts", "src/importGuide.ts"],
    "content_package"
  );
  assert.deepEqual(receipt.releaseClaims, {
    manualImportVerified: false,
    loadedAffinityAppVerified: false,
    nativeSdkPluginVerified: false,
    photoshopFilterPluginVerified: false,
    signingVerified: false,
    releaseChecksumVerified: false,
    distributionVerified: false
  });

  assertPackageHashes(receipt.package.files, receipt.package.sha256);
  assert.equal(existsSync(receiptPath), true);
  assert.deepEqual(JSON.parse(readFileSync(receiptPath, "utf8")), receipt);
} finally {
  rmSync(packageRoot, { recursive: true, force: true });
}

assertPackageWithoutContentArtifactsFails();
assertPackageRootEnvironmentOverrideIsUsed();
assertMissingPackageRootHasFriendlyError();

console.log("Affinity content package receipt verified");

function assertPackageWithoutContentArtifactsFails(): void {
  const emptyPackageRoot = mkdtempSync(join(tmpdir(), "dx-affinity-empty-package-"));

  try {
    writeFileInRoot(
      emptyPackageRoot,
      "affinity-content-manifest.json",
      JSON.stringify({ name: "DX Affinity Content Bridge", supportedHosts: [], supportedContentTypes: [] })
    );

    assert.throws(
      () =>
        writeAffinityContentPackageReceipt({
          packageRoot: emptyPackageRoot,
          receiptPath: join(emptyPackageRoot, "receipt.json")
        }),
      /must include at least one importable Affinity content artifact/
    );
  } finally {
    rmSync(emptyPackageRoot, { recursive: true, force: true });
  }
}

function assertPackageRootEnvironmentOverrideIsUsed(): void {
  const envPackageRoot = mkdtempSync(join(tmpdir(), "dx-affinity-env-package-"));
  const previousPackageRoot = process.env.DX_AFFINITY_CONTENT_PACKAGE_ROOT;

  try {
    writeFileInRoot(
      envPackageRoot,
      "affinity-content-manifest.json",
      JSON.stringify({ name: "DX Affinity Content Bridge", supportedHosts: ["Affinity Photo 2"] })
    );
    writeFileInRoot(envPackageRoot, "assets/dx-icons.afassets", "env package assets\n");
    process.env.DX_AFFINITY_CONTENT_PACKAGE_ROOT = envPackageRoot;

    const receipt = writeAffinityContentPackageReceipt({
      adapterRoot,
      receiptPath: join(envPackageRoot, "receipt.json"),
      generatedAt: "2026-06-07T00:00:00.000Z"
    });

    assert.equal(receipt.package.root, envPackageRoot);
    assert.deepEqual(
      receipt.contentArtifacts.map((artifact) => artifact.relativePath),
      ["assets/dx-icons.afassets"]
    );
  } finally {
    if (previousPackageRoot === undefined) {
      delete process.env.DX_AFFINITY_CONTENT_PACKAGE_ROOT;
    } else {
      process.env.DX_AFFINITY_CONTENT_PACKAGE_ROOT = previousPackageRoot;
    }

    rmSync(envPackageRoot, { recursive: true, force: true });
  }
}

function assertMissingPackageRootHasFriendlyError(): void {
  const missingPackageRoot = join(tmpdir(), "dx-affinity-missing-package-root");

  assert.throws(
    () =>
      writeAffinityContentPackageReceipt({
        packageRoot: missingPackageRoot,
        receiptPath: join(tmpdir(), "dx-affinity-missing-package-receipt.json")
      }),
    /content package root does not exist/
  );
}

function writePackageFile(relativePath: string, source: string): void {
  writeFileInRoot(packageRoot, relativePath, source);
}

function writeFileInRoot(root: string, relativePath: string, source: string): void {
  const absolutePath = join(root, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);
}

function assertPackageHashes(
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
