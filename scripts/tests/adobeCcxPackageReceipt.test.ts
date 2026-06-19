import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { buildAdobeUxpPackage } from "../build-adobe-uxp-package.ts";
import { writeAdobeCcxPackageReceipt } from "../write-adobe-ccx-package-receipts.ts";
import { writeAdobeUxpPackageOutputReceipt } from "../write-adobe-uxp-package-output-receipts.ts";
import { writeReleaseEvidenceGapReport } from "../write-release-evidence-gap-report.ts";

const root = process.cwd();
const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-adobe-ccx-package-"));
const adapters = [
  {
    adapterId: "dx.photoshop.command-center",
    host: "photoshop",
    folder: "dx-photoshop-uxp",
    manifestId: "dx.photoshop.command-center.development",
    hostApp: "PS"
  },
  {
    adapterId: "dx.premiere-pro.command-center",
    host: "premiere-pro",
    folder: "dx-premiere-pro-uxp",
    manifestId: "dx.premiere-pro.command-center.development",
    hostApp: "premierepro"
  },
  {
    adapterId: "dx.indesign.command-center",
    host: "indesign",
    folder: "dx-indesign-uxp",
    manifestId: "dx.indesign.command-center.development",
    hostApp: "ID"
  }
] as const;

try {
  writeAdobeReleaseGates();

  for (const adapter of adapters) {
    const adapterRoot = join(root, "hosts", "adobe", adapter.folder);
    const buildResult = await buildAdobeUxpPackage({
      adapterRoot,
      outputRoot: join(workspaceRoot, adapter.folder)
    });
    const packageOutputReceiptPath = joinReceiptPath(adapter.adapterId, "package-output-latest.json");
    const packageOutputReceipt = writeAdobeUxpPackageOutputReceipt({
      adapterId: adapter.adapterId,
      host: adapter.host,
      adapterRoot,
      packageRoot: buildResult.packageRoot,
      receiptPath: packageOutputReceiptPath,
      generatedAt: "2026-06-07T00:00:00.000Z",
      verificationCommand: "npm run build:adobe-uxp:j1"
    });
    const packageOutputReceiptSource = readFileSync(packageOutputReceiptPath, "utf8");
    const ccxArtifactPath = writeWorkspaceFile(
      `release/${adapter.folder}/dx-command-center.ccx`,
      `${adapter.adapterId} ccx package bytes\n`
    );
    const receipt = writeAdobeCcxPackageReceipt(workspaceRoot, {
      generatedAt: "2026-06-07T00:00:00.000Z",
      verificationCommand: "npm run package:adobe-ccx:j1",
      proof: {
        adapterId: adapter.adapterId,
        host: adapter.host,
        packageOutputReceiptPath,
        ccxArtifactPath,
        sourcePackageRoot: buildResult.packageRoot,
        packagingTool: "uxp-developer-tool",
        packagingToolVersion: "8.1.0"
      }
    });

    assert.equal(receipt.receipt, "dx.extension.adobe_uxp.ccx_package");
    assert.equal(receipt.adapterId, adapter.adapterId);
    assert.equal(receipt.host, adapter.host);
    assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
    assert.equal(receipt.verificationCommand, "npm run package:adobe-ccx:j1");
    assert.equal(receipt.receiptPath, joinReceiptPath(adapter.adapterId, "ccx-package-latest.json"));
    assert.deepEqual(receipt.packageOutput, {
      receiptPath: packageOutputReceiptPath,
      receiptSha256: sha256(readFileSync(packageOutputReceiptPath)),
      packageSha256: packageOutputReceipt.package.sha256,
      filesVerified: packageOutputReceipt.package.fileCount
    });
    assert.deepEqual(receipt.sourcePackage, {
      root: buildResult.packageRoot,
      manifestId: adapter.manifestId,
      manifestVersion: "0.1.0",
      manifestMain: "index.html",
      hostApp: adapter.hostApp
    });
    assert.deepEqual(receipt.ccxPackage, {
      artifactPath: ccxArtifactPath,
      fileName: "dx-command-center.ccx",
      format: "ccx",
      bytes: Buffer.byteLength(`${adapter.adapterId} ccx package bytes\n`),
      sha256: sha256(readFileSync(ccxArtifactPath)),
      packagingTool: "uxp-developer-tool",
      packagingToolVersion: "8.1.0"
    });
    assert.deepEqual(receipt.releaseClaims, {
      packageOutputVerified: true,
      ccxPackaged: true,
      loadedHostVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      distributionVerified: false
    });
    assert.equal(existsSync(receipt.receiptPath), true);
    assert.deepEqual(JSON.parse(readFileSync(receipt.receiptPath, "utf8")), receipt);
    assert.equal(ccxRequirement(adapter.adapterId).releaseValid, true);

    writeAbsoluteJsonFile(receipt.receiptPath, {
      ...receipt,
      sourcePackage: {
        ...receipt.sourcePackage,
        hostApp: "wrong-host"
      }
    });
    const wrongHostAppRequirement = ccxRequirement(adapter.adapterId);
    assert.equal(wrongHostAppRequirement.releaseValid, false);
    assert.match(
      wrongHostAppRequirement.weakness ?? "",
      /CCX package receipt is missing source package manifest proof/
    );

    writeAbsoluteJsonFile(receipt.receiptPath, {
      ...receipt,
      sourcePackage: {
        ...receipt.sourcePackage,
        manifestId: "wrong.manifest.id"
      }
    });
    const wrongManifestRequirement = ccxRequirement(adapter.adapterId);
    assert.equal(wrongManifestRequirement.releaseValid, false);
    assert.match(
      wrongManifestRequirement.weakness ?? "",
      /CCX package receipt is missing source package manifest proof/
    );

    writeAbsoluteJsonFile(receipt.receiptPath, {
      ...receipt,
      ccxPackage: {
        ...receipt.ccxPackage,
        fileName: "wrong-command-center.ccx"
      }
    });
    const wrongArtifactNameRequirement = ccxRequirement(adapter.adapterId);
    assert.equal(wrongArtifactNameRequirement.releaseValid, false);
    assert.match(
      wrongArtifactNameRequirement.weakness ?? "",
      /CCX package receipt is missing CCX artifact proof/
    );

    writeAbsoluteJsonFile(receipt.receiptPath, receipt);
    writeFileSync(ccxArtifactPath, `${adapter.adapterId} changed ccx package bytes\n`);
    const changedArtifactRequirement = ccxRequirement(adapter.adapterId);
    assert.equal(changedArtifactRequirement.releaseValid, false);
    assert.match(
      changedArtifactRequirement.weakness ?? "",
      /CCX package artifact file size changed|CCX package artifact file hash changed/
    );

    writeFileSync(ccxArtifactPath, `${adapter.adapterId} ccx package bytes\n`);
    writeAbsoluteJsonFile(receipt.receiptPath, receipt);

    writeFileSync(packageOutputReceiptPath, "{}\n");
    const changedPackageOutputRequirement = ccxRequirement(adapter.adapterId);
    assert.equal(changedPackageOutputRequirement.releaseValid, false);
    assert.match(
      changedPackageOutputRequirement.weakness ?? "",
      /CCX package linked package-output receipt hash changed/
    );

    writeFileSync(packageOutputReceiptPath, packageOutputReceiptSource);
    writeAbsoluteJsonFile(receipt.receiptPath, receipt);

    assert.throws(
      () =>
        writeAdobeCcxPackageReceipt(workspaceRoot, {
          proof: {
            adapterId: adapter.adapterId,
            host: adapter.host,
            packageOutputReceiptPath,
            ccxArtifactPath: writeWorkspaceFile(
              `release/${adapter.folder}/dx-command-center.zip`,
              "zip bytes\n"
            ),
            sourcePackageRoot: buildResult.packageRoot,
            packagingTool: "uxp-developer-tool",
            packagingToolVersion: "8.1.0"
          }
        }),
      /CCX artifact must use the .ccx extension/
    );

    assert.throws(
      () =>
        writeAdobeCcxPackageReceipt(workspaceRoot, {
          proof: {
            adapterId: adapter.adapterId,
            host: adapter.host,
            packageOutputReceiptPath,
            ccxArtifactPath,
            sourcePackageRoot: writeWorkspaceDirectory(`wrong-source-package/${adapter.folder}`),
            packagingTool: "uxp-developer-tool",
            packagingToolVersion: "8.1.0"
          }
        }),
      /source package root must match package-output receipt/
    );
  }
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("Adobe CCX package receipts verified");

function writeAdobeReleaseGates(): void {
  writeWorkspaceFile(
    "registry/official-extensions.toml",
    `
schema = "dx.extensions.registry"
manifest_version = 1

${adapters
  .map(
    (adapter) => `
[[extensions]]
id = "${adapter.adapterId}"
name = "${adapter.adapterId}"
path = "hosts/adobe/${adapter.folder}"
manifest = "hosts/adobe/${adapter.folder}/dx.extension.toml"
status = "experimental"
professional_targets = ["adobe.${adapter.host}.uxp"]
`
  )
  .join("\n")}
`
  );

  for (const adapter of adapters) {
    writeWorkspaceFile(
      `hosts/adobe/${adapter.folder}/dx.extension.toml`,
      `
[extension]
id = "${adapter.adapterId}"
`
    );
  }

  writeWorkspaceFile(
    "registry/release-evidence-gates.toml",
    `
schema = "dx.release_evidence_gates"
manifest_version = 1

${adapters
  .map(
    (adapter) => `
[[extensions]]
id = "${adapter.adapterId}"
stage = "not-release-ready"
required_evidence = ["host_execution", "package_output", "ccx_package", "signing", "checksum", "distribution_review"]
evidence_receipt_requirements = ["host_execution=.dx/receipts/extensions/${adapter.adapterId}/loaded-host-latest.json", "package_output=.dx/receipts/extensions/${adapter.adapterId}/package-output-latest.json", "ccx_package=.dx/receipts/extensions/${adapter.adapterId}/ccx-package-latest.json", "signing=.dx/receipts/extensions/${adapter.adapterId}/signing-latest.json", "checksum=.dx/receipts/extensions/${adapter.adapterId}/checksum-latest.json", "distribution_review=.dx/receipts/extensions/${adapter.adapterId}/creative-cloud-review-latest.json"]
evidence_receipts = [".dx/receipts/extensions/${adapter.adapterId}/loaded-host-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/package-output-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/ccx-package-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/signing-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/checksum-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/creative-cloud-review-latest.json"]
next_release_proof = "package CCX"
blocked_by = ["CCX package proof"]
`
  )
  .join("\n")}
`
  );
}

function joinReceiptPath(adapterId: string, receiptName: string): string {
  return join(workspaceRoot, ".dx", "receipts", "extensions", adapterId, receiptName);
}

function ccxRequirement(adapterId: string) {
  const report = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });
  const extension = report.extensions.find((entry) => entry.id === adapterId);
  assert.ok(extension, `missing release gap entry for ${adapterId}`);
  const requirement = extension.evidenceRequirements.find((entry) => entry.kind === "ccx_package");
  assert.ok(requirement, `missing CCX package requirement for ${adapterId}`);

  return requirement;
}

function writeAbsoluteJsonFile(absolutePath: string, value: unknown): void {
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeWorkspaceFile(relativePath: string, source: string): string {
  const absolutePath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);

  return absolutePath;
}

function writeWorkspaceDirectory(relativePath: string): string {
  const absolutePath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(absolutePath, { recursive: true });

  return absolutePath;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
