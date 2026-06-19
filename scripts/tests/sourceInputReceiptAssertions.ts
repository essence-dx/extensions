import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { classifyPackageOutputWeakness } from "../lib/release-evidence-package-output-classifier.ts";
import { verifyPackageOutputReceipt } from "../lib/package-output-proof.ts";

interface SourceInputReceipt {
  adapterId: string;
  sourceRoot: string;
  sourceInputs: Array<{
    relativePath: string;
    bytes: number;
    sha256: string;
  }>;
  sourceSha256: string;
}

export function assertSourceInputReceipt(
  receipt: SourceInputReceipt,
  expectedSourceRoot: string,
  expectedRelativePaths: readonly string[],
  kind: "package_output" | "content_package" = "package_output"
): void {
  assert.equal(receipt.sourceRoot, expectedSourceRoot);
  assert.deepEqual(
    receipt.sourceInputs.map((input) => input.relativePath),
    [...expectedRelativePaths].sort((left, right) => left.localeCompare(right))
  );

  assertPackageHashes(receipt.sourceRoot, receipt.sourceInputs, receipt.sourceSha256);
  assert.equal(classifyPackageOutputWeakness(kind, receipt as Record<string, unknown>), undefined);
  assert.equal(verifyPackageOutputReceipt(receipt.adapterId, receipt).fileCount > 0, true);

  const staleReceipt = structuredClone(receipt);
  staleReceipt.sourceInputs[0]!.sha256 = "0".repeat(64);
  assert.match(
    classifyPackageOutputWeakness(kind, staleReceipt as Record<string, unknown>) ?? "",
    /source input hash changed/
  );
  assert.throws(
    () => verifyPackageOutputReceipt(staleReceipt.adapterId, staleReceipt),
    /source input hash changed/
  );

  const unsafeSourcePathReceipt = structuredClone(receipt);
  unsafeSourcePathReceipt.sourceInputs[0]!.relativePath = "C:/unsafe-source.ts";
  assert.match(
    classifyPackageOutputWeakness(kind, unsafeSourcePathReceipt as Record<string, unknown>) ?? "",
    /safe relative path/
  );
  assert.throws(
    () => verifyPackageOutputReceipt(unsafeSourcePathReceipt.adapterId, unsafeSourcePathReceipt),
    /safe relative path/
  );

  const unsafePackagePathReceipt = structuredClone(receipt) as SourceInputReceipt & {
    package?: { files?: Array<{ relativePath: string }> };
  };
  if (unsafePackagePathReceipt.package?.files?.[0]) {
    unsafePackagePathReceipt.package.files[0].relativePath = "C:/unsafe-output.js";
    assert.throws(
      () => verifyPackageOutputReceipt(unsafePackagePathReceipt.adapterId, unsafePackagePathReceipt),
      /safe relative path/
    );
  }
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
