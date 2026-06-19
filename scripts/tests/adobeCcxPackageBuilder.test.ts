import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { buildAdobeCcxPackageProofs } from "../build-adobe-ccx-package-proofs.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-adobe-ccx-package-proofs-"));
const adapters = [
  {
    adapterId: "dx.photoshop.command-center",
    host: "photoshop",
    manifestId: "dx.photoshop.command-center.development",
    hostApp: "PS"
  },
  {
    adapterId: "dx.premiere-pro.command-center",
    host: "premiere-pro",
    manifestId: "dx.premiere-pro.command-center.development",
    hostApp: "premierepro"
  },
  {
    adapterId: "dx.indesign.command-center",
    host: "indesign",
    manifestId: "dx.indesign.command-center.development",
    hostApp: "ID"
  }
] as const;

try {
  for (const adapter of adapters) {
    writePackageOutputFixture(adapter);
  }

  const result = buildAdobeCcxPackageProofs(workspaceRoot, {
    artifactRoot: ".tmp/release-packages/adobe-ccx",
    proofPath: ".tmp/proofs/adobe-ccx-package-proofs.json"
  });

  assert.equal(result.artifacts.length, adapters.length);
  assert.equal(result.proofs.length, adapters.length);
  assert.equal(result.proofPath, join(workspaceRoot, ".tmp", "proofs", "adobe-ccx-package-proofs.json"));

  const proofFile = JSON.parse(readFileSync(result.proofPath, "utf8"));
  assert.deepEqual(proofFile, result.proofs);

  for (const adapter of adapters) {
    const proof = result.proofs.find((candidate) => candidate.adapterId === adapter.adapterId);
    assert.ok(proof, `missing proof for ${adapter.adapterId}`);
    assert.equal(proof.host, adapter.host);
    assert.equal(proof.packagingTool, "dx-ccx-packager");
    assert.match(proof.packagingToolVersion, /^\d+\.\d+\.\d+$/);
    assert.equal(proof.packageOutputReceiptPath, packageOutputReceiptPath(adapter.adapterId));
    assert.equal(proof.sourcePackageRoot, packageRoot(adapter.adapterId));
    assert.equal(
      proof.ccxArtifactPath,
      join(workspaceRoot, ".tmp", "release-packages", "adobe-ccx", adapter.host, "dx-command-center.ccx")
    );
    assert.equal(existsSync(proof.ccxArtifactPath), true);

    const artifact = result.artifacts.find((candidate) => candidate.adapterId === adapter.adapterId);
    assert.ok(artifact, `missing artifact for ${adapter.adapterId}`);
    assert.equal(artifact.path, proof.ccxArtifactPath);
    assert.equal(artifact.entries, 4);
    assert.equal(artifact.bytes, readFileSync(proof.ccxArtifactPath).length);
    assert.match(artifact.sha256, /^[a-f0-9]{64}$/);
  }

  assert.throws(
    () => buildAdobeCcxPackageProofs(workspaceRoot, { adapterIds: ["dx.browser.command-center"] }),
    /Adobe CCX package adapter id is unsupported/
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("Adobe CCX package proof builder verified");

function writePackageOutputFixture(adapter: (typeof adapters)[number]): void {
  const root = packageRoot(adapter.adapterId);
  const files = [
    writePackageFile(root, "index.html", "<html><body>DX</body></html>\n"),
    writePackageFile(root, "index.js", "console.log('DX');\n"),
    writePackageFile(root, "index.js.map", "{}\n"),
    writePackageFile(
      root,
      "manifest.json",
      JSON.stringify({
        id: adapter.manifestId,
        version: "0.1.0",
        main: "index.html",
        host: {
          app: adapter.hostApp
        }
      }, null, 2)
    )
  ];

  writeJsonFile(packageOutputReceiptPath(adapter.adapterId), {
    receipt: "dx.extension.adobe_uxp.package_output",
    adapterId: adapter.adapterId,
    host: adapter.host,
    package: {
      root,
      fileCount: files.length,
      sha256: hashPackageFiles(files),
      files
    },
    manifest: {
      main: "index.html",
      requiredPermissionsEmpty: true
    },
    releaseClaims: {
      loadedHostVerified: false,
      developerToolVerified: false,
      ccxPackaged: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      distributionVerified: false
    }
  });
}

function writePackageFile(root: string, relativePath: string, source: string): {
  relativePath: string;
  bytes: number;
  sha256: string;
} {
  const absolutePath = join(root, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);

  return {
    relativePath,
    bytes: Buffer.byteLength(source),
    sha256: sha256(Buffer.from(source))
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

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function writeJsonFile(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function packageRoot(adapterId: string): string {
  return join(workspaceRoot, "package-output", adapterId);
}

function packageOutputReceiptPath(adapterId: string): string {
  return join(workspaceRoot, ".dx", "receipts", "extensions", adapterId, "package-output-latest.json");
}
