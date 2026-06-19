import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { writePackageOutputChecksumReceipts } from "../write-package-output-checksum-receipts.ts";

const receiptRoot = mkdtempSync(join(tmpdir(), "dx-package-output-checksum-"));

try {
  const alphaPackage = writePackageOutputReceipt("dx.alpha.command-center", "alpha", "package");
  const betaPackage = writePackageOutputReceipt("dx.beta.command-center", "beta", "bundle");
  const existingPublicChecksumPath = join(receiptRoot, betaPackage.adapterId, "checksum-latest.json");

  writeFileSync(existingPublicChecksumPath, `${JSON.stringify({ receipt: "existing.public.checksum" }, null, 2)}\n`);

  const receipts = writePackageOutputChecksumReceipts({
    receiptRoot,
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run test:package-output-checksum-receipts"
  });

  assert.equal(receipts.length, 2);
  assert.equal(receipts[0].receipt, "dx.extension.package_output.checksum");
  assert.equal(receipts[0].adapterId, alphaPackage.adapterId);
  assert.equal(receipts[0].host, alphaPackage.host);
  assert.equal(receipts[0].generatedAt, "2026-06-07T00:00:00.000Z");
  assert.equal(receipts[0].verificationCommand, "npm run test:package-output-checksum-receipts");
  assert.equal(
    receipts[0].receiptPath,
    join(receiptRoot, alphaPackage.adapterId, "package-output-checksum-latest.json")
  );
  assert.equal(receipts[0].packageOutput.receiptPath, alphaPackage.receiptPath);
  assert.equal(receipts[0].packageOutput.payloadKind, "package");
  assert.equal(receipts[0].packageOutput.root, alphaPackage.packageRoot);
  assert.equal(receipts[0].packageOutput.fileCount, 2);
  assert.equal(receipts[0].packageOutput.filesVerified, 2);
  assert.equal(receipts[0].packageOutput.sha256, alphaPackage.sha256);
  assert.deepEqual(receipts[0].checksum, {
    algorithm: "sha256",
    scope: "package-output",
    sha256: alphaPackage.sha256,
    fileCount: 2
  });
  assert.deepEqual(receipts[0].releaseClaims, {
    packageOutputVerified: true,
    packageOutputChecksumVerified: true,
    loadedHostVerified: false,
    signingVerified: false,
    distributionVerified: false,
    publicReleasePackageVerified: false
  });
  assert.deepEqual(JSON.parse(readFileSync(receipts[0].receiptPath, "utf8")), receipts[0]);
  assert.equal(
    receipts[1].receiptPath,
    join(receiptRoot, betaPackage.adapterId, "package-output-checksum-latest.json")
  );
  assert.deepEqual(JSON.parse(readFileSync(existingPublicChecksumPath, "utf8")), {
    receipt: "existing.public.checksum"
  });

  const overwritten = writePackageOutputChecksumReceipts({
    receiptRoot,
    targets: [betaPackage.adapterId],
    overwrite: true,
    generatedAt: "2026-06-07T00:00:00.000Z"
  });

  assert.equal(overwritten.length, 1);
  assert.equal(overwritten[0].adapterId, betaPackage.adapterId);
  assert.equal(overwritten[0].packageOutput.payloadKind, "bundle");
  assert.equal(overwritten[0].packageOutput.sha256, betaPackage.sha256);
  assert.deepEqual(JSON.parse(readFileSync(overwritten[0].receiptPath, "utf8")), overwritten[0]);
  assert.deepEqual(JSON.parse(readFileSync(existingPublicChecksumPath, "utf8")), {
    receipt: "existing.public.checksum"
  });

  const tamperedPackage = writePackageOutputReceipt("dx.gamma.command-center", "gamma", "package");
  writeFileSync(join(tamperedPackage.packageRoot, "manifest.txt"), "tampered\n");

  assert.throws(
    () =>
      writePackageOutputChecksumReceipts({
        receiptRoot,
        targets: [tamperedPackage.adapterId]
      }),
    /package output file hash changed for dx\.gamma\.command-center/
  );

  assert.throws(
    () =>
      writePackageOutputChecksumReceipts({
        receiptRoot,
        targets: ["../bad-target"]
      }),
    /package output checksum target must be a safe adapter id/
  );
} finally {
  rmSync(receiptRoot, { recursive: true, force: true });
}

console.log("Package output checksum receipts verified");

function writePackageOutputReceipt(
  adapterId: string,
  host: string,
  payloadKind: "package" | "bundle"
): {
  adapterId: string;
  host: string;
  packageRoot: string;
  receiptPath: string;
  sha256: string;
} {
  const packageRoot = join(receiptRoot, "packages", adapterId);
  writePackageFile(packageRoot, "entrypoint.txt", `${adapterId}\n`);
  writePackageFile(packageRoot, "manifest.txt", `${host}\n`);

  const files = ["entrypoint.txt", "manifest.txt"].map((relativePath) => {
    const bytes = readFileSync(join(packageRoot, relativePath));

    return {
      relativePath,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex")
    };
  });
  const sha256 = hashPackageFiles(files);
  const receiptPath = join(receiptRoot, adapterId, "package-output-latest.json");
  const receipt = {
    receipt: `fixture.${adapterId}.package_output`,
    adapterId,
    host,
    [payloadKind]: {
      root: packageRoot,
      fileCount: files.length,
      sha256,
      files
    },
    releaseClaims: {
      loadedHostVerified: false,
      signingVerified: false,
      distributionVerified: false
    }
  };

  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

  return {
    adapterId,
    host,
    packageRoot,
    receiptPath,
    sha256
  };
}

function writePackageFile(root: string, relativePath: string, source: string): void {
  const absolutePath = join(root, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);
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
