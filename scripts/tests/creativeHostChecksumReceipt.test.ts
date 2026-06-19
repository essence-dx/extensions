import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  type CreativeHostChecksumAdapterId,
  type CreativeHostChecksumHost,
  writeCreativeHostChecksumReceipts
} from "../write-creative-host-checksum-receipts.ts";
import { hashSourceInputs, readSourceInputProofs } from "../lib/source-input-proof.ts";

const receiptRoot = mkdtempSync(join(tmpdir(), "dx-creative-host-checksum-"));

try {
  const packageProofs = [
    writePackageOutputReceipt("dx.blender.command-center", "blender", "package"),
    writePackageOutputReceipt("dx.sketch.command-center", "sketch", "bundle"),
    writePackageOutputReceipt("dx.davinci-resolve.command-center", "davinci-resolve", "package")
  ];

  const receipts = writeCreativeHostChecksumReceipts({
    receiptRoot,
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run test:creative-host-checksum-receipts"
  });

  assert.equal(receipts.length, 3);

  for (const packageProof of packageProofs) {
    const receipt = receipts.find((entry) => entry.adapterId === packageProof.adapterId);

    assert.ok(receipt, `missing checksum receipt for ${packageProof.adapterId}`);
    assert.equal(receipt.receipt, "dx.extension.creative_host.package_output_checksum");
    assert.equal(receipt.host, packageProof.host);
    assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
    assert.equal(receipt.verificationCommand, "npm run test:creative-host-checksum-receipts");
    assert.equal(receipt.receiptPath, join(receiptRoot, packageProof.adapterId, "checksum-latest.json"));
    assert.equal(receipt.packageOutput.receiptPath, packageProof.receiptPath);
    assert.equal(receipt.packageOutput.payloadKind, packageProof.payloadKind);
    assert.equal(receipt.packageOutput.root, packageProof.packageRoot);
    assert.equal(receipt.packageOutput.fileCount, 2);
    assert.equal(receipt.packageOutput.filesVerified, 2);
    assert.equal(receipt.packageOutput.sha256, packageProof.sha256);
    assert.deepEqual(receipt.checksum, {
      algorithm: "sha256",
      scope: "package-output",
      sha256: packageProof.sha256,
      fileCount: 2
    });
    assert.deepEqual(receipt.releaseClaims, expectedReleaseClaimsFor(packageProof.adapterId));
    assert.equal(existsSync(receipt.receiptPath), true, "checksum receipt should be written");
    assert.deepEqual(JSON.parse(readFileSync(receipt.receiptPath, "utf8")), receipt);
  }

  writeFileSync(join(packageProofs[0].packageRoot, "manifest.txt"), "tampered\n");

  assert.throws(
    () =>
      writeCreativeHostChecksumReceipts({
        receiptRoot,
        targets: ["dx.blender.command-center"]
      }),
    /package output file hash changed for dx\.blender\.command-center/
  );
} finally {
  rmSync(receiptRoot, { recursive: true, force: true });
}

console.log("Creative host checksum receipts verified");

function writePackageOutputReceipt(
  adapterId: CreativeHostChecksumAdapterId,
  host: CreativeHostChecksumHost,
  payloadKind: "package" | "bundle"
): {
  adapterId: CreativeHostChecksumAdapterId;
  host: CreativeHostChecksumHost;
  payloadKind: typeof payloadKind;
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
  const sourceProof = writeSourceInputProof(adapterId);
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
    ...(sourceProof ?? {}),
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
    payloadKind,
    packageRoot,
    receiptPath,
    sha256
  };
}

function writeSourceInputProof(adapterId: string): {
  sourceRoot: string;
  sourceInputs: ReturnType<typeof readSourceInputProofs>;
  sourceSha256: string;
} | undefined {
  if (adapterId === "dx.blender.command-center") {
    const sourceRoot = join(receiptRoot, "source", adapterId);
    const paths = ["__init__.py", "blender_manifest.toml"];

    writePackageFile(sourceRoot, "__init__.py", "print('dx blender command center')\n");
    writePackageFile(sourceRoot, "blender_manifest.toml", "id = \"dx_blender_command_center\"\n");

    const sourceInputs = readSourceInputProofs(sourceRoot, paths);

    return {
      sourceRoot,
      sourceInputs,
      sourceSha256: hashSourceInputs(sourceInputs)
    };
  }

  if (adapterId === "dx.sketch.command-center") {
    const sourceRoot = join(receiptRoot, "source", adapterId);
    const paths = ["manifest.json", "src/commandPlans.ts", "src/index.ts", "src/messages.ts"];

    writePackageFile(sourceRoot, "manifest.json", "{\"name\":\"DX Sketch\"}\n");
    writePackageFile(sourceRoot, "src/commandPlans.ts", "export const commandPlans = [];\n");
    writePackageFile(sourceRoot, "src/index.ts", "export const sketchMain = true;\n");
    writePackageFile(sourceRoot, "src/messages.ts", "export const messages = {};\n");

    const sourceInputs = readSourceInputProofs(sourceRoot, paths);

    return {
      sourceRoot,
      sourceInputs,
      sourceSha256: hashSourceInputs(sourceInputs)
    };
  }

  return undefined;
}

function expectedReleaseClaimsFor(adapterId: string): Record<string, boolean> {
  const sharedClaims = {
    packageOutputVerified: true,
    packageOutputChecksumVerified: true,
    loadedHostVerified: false,
    signingVerified: false,
    distributionVerified: false,
    publicReleasePackageVerified: false
  };

  if (adapterId === "dx.blender.command-center") {
    return {
      ...sharedClaims,
      installedAddonVerified: false,
      packageArchiveVerified: false
    };
  }

  if (adapterId === "dx.sketch.command-center") {
    return {
      ...sharedClaims,
      sketchtoolVerified: false,
      localServiceVerified: false,
      notarizationVerified: false
    };
  }

  return {
    ...sharedClaims,
    workflowIntegrationVerified: false,
    localServiceVerified: false
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
