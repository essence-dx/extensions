import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { deflateRawSync } from "node:zlib";

import {
  hashSourceInputs,
  readSourceInputProofs,
  vsCodePackageSourceInputs
} from "../lib/source-input-proof.ts";
import { writeReleaseEvidenceGapReport } from "../write-release-evidence-gap-report.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-release-gaps-core-evidence-"));
const adapterId = "dx.vscode.command-center";
const hostReceiptPath = `.dx/receipts/extensions/${adapterId}/vscode-loaded-host-latest.json`;
const packageReceiptPath = `.dx/receipts/extensions/${adapterId}/package-output-latest.json`;
const packageReceiptAbsolutePath = join(workspaceRoot, ...packageReceiptPath.split("/"));
const packageRoot = join(workspaceRoot, "hosts", "vscode", "dx-vscode");
const vsixPath = join(packageRoot, "dx-vscode-0.1.0.vsix");
const extensionId = "dx-runtime.dx-vscode";

try {
  writeWorkspaceFile(
    "registry/official-extensions.toml",
    `
schema = "dx.extensions.registry"
manifest_version = 1

[[extensions]]
id = "${adapterId}"
name = "${adapterId}"
path = "hosts/vscode/dx-vscode"
manifest = "hosts/vscode/dx-vscode/dx.extension.toml"
status = "experimental"
professional_targets = ["vscode"]
`
  );
  writeWorkspaceFile(
    "hosts/vscode/dx-vscode/dx.extension.toml",
    `
[extension]
id = "${adapterId}"
`
  );
  writeWorkspaceFile(
    "hosts/vscode/dx-vscode/package.json",
    `${JSON.stringify({ name: "dx-vscode", publisher: "dx-runtime" }, null, 2)}\n`
  );
  writeVsCodeSourceInputs();
  writeWorkspaceFile(
    "registry/release-evidence-gates.toml",
    `
schema = "dx.release_evidence_gates"
manifest_version = 1

[[extensions]]
id = "${adapterId}"
stage = "not-release-ready"
required_evidence = ["host_execution", "package_output", "signing", "checksum", "distribution_review"]
evidence_receipt_requirements = ["host_execution=${hostReceiptPath}", "package_output=${packageReceiptPath}", "signing=.dx/receipts/extensions/${adapterId}/signing-latest.json", "checksum=.dx/receipts/extensions/${adapterId}/checksum-latest.json", "distribution_review=.dx/receipts/extensions/${adapterId}/marketplace-review-latest.json"]
evidence_receipts = ["${hostReceiptPath}", "${packageReceiptPath}", ".dx/receipts/extensions/${adapterId}/signing-latest.json", ".dx/receipts/extensions/${adapterId}/checksum-latest.json", ".dx/receipts/extensions/${adapterId}/marketplace-review-latest.json"]
next_release_proof = "Run VS Code loaded-host smoke"
blocked_by = ["signing", "marketplace review"]
`
  );
  const packageFile = readPackageFileProof("package.json");
  writeWorkspaceFile("hosts/vscode/dx-vscode/extension.vsixmanifest", "<PackageManifest />\n");
  writeWorkspaceFile("hosts/vscode/dx-vscode/[Content_Types].xml", "<Types />\n");
  const vsixProof = writeDeflatedZipArtifactProof(vsixPath, [
    {
      relativePath: "extension.vsixmanifest",
      sourcePath: join(packageRoot, "extension.vsixmanifest")
    },
    {
      relativePath: "[Content_Types].xml",
      sourcePath: join(packageRoot, "[Content_Types].xml")
    },
    {
      relativePath: "extension/package.json",
      sourcePath: join(packageRoot, "package.json")
    }
  ]);
  const vsixBytes = readFileSync(vsixPath);
  const packageSha256 = hashPackageFiles([packageFile]);
  const sourceProof = readVsCodeSourceProof();
  writeJsonFile(packageReceiptPath, {
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
    packageManifest: packageManifestProof(),
    vsix: vsixProof,
    releaseClaims: {
      loadedExtensionHostVerified: false,
      localServiceVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      marketplaceReviewVerified: false,
      distributionVerified: false
    }
  });
  writeJsonFile(hostReceiptPath, {
    schema_version: "dx.extension.vscode_loaded_host_smoke.v1",
    adapterId,
    extension_id: extensionId,
    command_count: 2,
    commandIds: ["dx.showStatus", "dx.openCommandCenter"],
    packageOutput: {
      receiptPath: packageReceiptAbsolutePath,
      receiptSha256: sha256(readFileSync(packageReceiptAbsolutePath)),
      packageSha256,
      vsixSha256: createHash("sha256").update(vsixBytes).digest("hex")
    },
    workspace_kind: "temporary",
    workspace_path: join(workspaceRoot, "tmp", "workspace").split("\\").join("/"),
    loaded_host: "vscode",
    status: "passed",
    stores_process_output: false,
    releaseClaims: {
      loadedExtensionHostVerified: true,
      packageOutputVerified: true,
      localServiceVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      marketplaceReviewVerified: false,
      distributionVerified: false
    }
  });

  const report = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });
  const extension = report.extensions.find((entry) => entry.id === adapterId);
  const requirements = new Map(
    extension?.evidenceRequirements.map((requirement) => [requirement.kind, requirement])
  );

  assert.equal(requirements.get("package_output")?.releaseValid, true);
  assert.equal(requirements.get("host_execution")?.releaseValid, true);
  assert.deepEqual(extension?.existingEvidence, ["host_execution", "package_output"]);
  assert.deepEqual(extension?.missingEvidence, ["checksum", "distribution_review", "signing"]);

  writeJsonFile(packageReceiptPath, {
    receipt: "dx.extension.vscode.package_output",
    adapterId: "dx.other.command-center",
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
    packageManifest: packageManifestProof(),
    vsix: vsixProof,
    releaseClaims: {
      loadedExtensionHostVerified: false,
      localServiceVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      marketplaceReviewVerified: false,
      distributionVerified: false
    }
  });
  const wrongAdapterReport = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:15.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });
  const wrongAdapterExtension = wrongAdapterReport.extensions.find((entry) => entry.id === adapterId);
  const wrongAdapterRequirements = new Map(
    wrongAdapterExtension?.evidenceRequirements.map((requirement) => [requirement.kind, requirement])
  );

  assert.equal(wrongAdapterRequirements.get("package_output")?.releaseValid, false);
  assert.match(
    wrongAdapterRequirements.get("package_output")?.weakness ?? "",
    /receipt adapter id dx\.other\.command-center does not match expected adapter id dx\.vscode\.command-center/
  );

  writeJsonFile(packageReceiptPath, {
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
    packageManifest: packageManifestProof(),
    releaseClaims: {
      loadedExtensionHostVerified: false,
      localServiceVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      marketplaceReviewVerified: false,
      distributionVerified: false
    }
  });
  const missingVsixReport = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:30.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });
  const missingVsixExtension = missingVsixReport.extensions.find((entry) => entry.id === adapterId);
  const missingVsixRequirements = new Map(
    missingVsixExtension?.evidenceRequirements.map((requirement) => [requirement.kind, requirement])
  );

  assert.equal(missingVsixRequirements.get("package_output")?.releaseValid, false);
  assert.match(
    missingVsixRequirements.get("package_output")?.weakness ?? "",
    /VS Code package-output receipt is missing VSIX package proof/
  );

  writeJsonFile(hostReceiptPath, {
    schema_version: "dx.extension.vscode_loaded_host_smoke.v1",
    adapterId,
    extension_id: "dx.dx-command-center",
    command_count: 2,
    workspace_kind: "temporary",
    workspace_path: join(workspaceRoot, "tmp", "workspace").split("\\").join("/"),
    loaded_host: "vscode",
    status: "passed",
    stores_process_output: false
  });
  const weakHostReport = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:45.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });
  const weakHostExtension = weakHostReport.extensions.find((entry) => entry.id === adapterId);
  const weakHostRequirements = new Map(
    weakHostExtension?.evidenceRequirements.map((requirement) => [requirement.kind, requirement])
  );

  assert.equal(weakHostRequirements.get("host_execution")?.releaseValid, false);
  assert.match(
    weakHostRequirements.get("host_execution")?.weakness ?? "",
    /VS Code loaded-host smoke receipt is missing package-output linkage/
  );

  writeJsonFile(packageReceiptPath, {
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
    packageManifest: packageManifestProof(),
    vsix: vsixProof,
    releaseClaims: {
      loadedExtensionHostVerified: false,
      localServiceVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      marketplaceReviewVerified: false,
      distributionVerified: false
    }
  });
  writeJsonFile(hostReceiptPath, {
    schema_version: "dx.extension.vscode_loaded_host_smoke.v1",
    adapterId,
    extension_id: extensionId,
    command_count: 2,
    commandIds: ["dx.showStatus", "dx.openCommandCenter"],
    packageOutput: {
      receiptPath: packageReceiptAbsolutePath,
      receiptSha256: sha256(readFileSync(packageReceiptAbsolutePath)),
      packageSha256,
      vsixSha256: createHash("sha256").update(vsixBytes).digest("hex")
    },
    workspace_kind: "temporary",
    workspace_path: join(workspaceRoot, "tmp", "workspace").split("\\").join("/"),
    loaded_host: "vscode",
    status: "passed",
    stores_process_output: false,
    releaseClaims: {
      loadedExtensionHostVerified: true,
      packageOutputVerified: true,
      localServiceVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      marketplaceReviewVerified: false,
      distributionVerified: false
    }
  });
  writeWorkspaceFile(
    "hosts/vscode/dx-vscode/package.json",
    `${JSON.stringify({ name: "dx-vscode", changed: true }, null, 2)}\n`
  );
  const staleReport = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-07T00:01:00.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });
  const staleExtension = staleReport.extensions.find((entry) => entry.id === adapterId);
  const staleRequirements = new Map(
    staleExtension?.evidenceRequirements.map((requirement) => [requirement.kind, requirement])
  );

  assert.equal(staleRequirements.get("package_output")?.releaseValid, false);
  assert.equal(staleRequirements.get("host_execution")?.releaseValid, false);
  assert.match(
    staleRequirements.get("package_output")?.weakness ?? "",
    /VS Code package-output source input size changed: package\.json/
  );
  assert.match(
    staleRequirements.get("host_execution")?.weakness ?? "",
    /VS Code loaded-host linked package-output receipt is weak: VS Code package-output source input size changed: package\.json/
  );
  assert.deepEqual(staleRequirements.get("package_output")?.remediation, {
    command: "npm run package:vscode:j1",
    proofSource: "workspace_artifact",
    requiresRealHost: false
  });
  assert.deepEqual(staleRequirements.get("host_execution")?.remediation, {
    command: "npm run smoke:vscode-loaded-host:j1",
    proofSource: "host_application",
    requiresRealHost: true
  });
  assert.deepEqual(staleExtension?.existingEvidence, []);
  assert.deepEqual(staleExtension?.weakEvidence, ["host_execution", "package_output"]);
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("core release evidence classification verified");

function writeJsonFile(relativePath: string, value: unknown): void {
  writeWorkspaceFile(relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeWorkspaceFile(relativePath: string, source: string): void {
  const absolutePath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);
}

function writeVsCodeSourceInputs(): void {
  for (const relativePath of vsCodePackageSourceInputs) {
    if (relativePath === "package.json") {
      continue;
    }

    writeWorkspaceFile(`hosts/vscode/dx-vscode/${relativePath}`, `VS Code source for ${relativePath}\n`);
  }
}

function readVsCodeSourceProof(): {
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

function readPackageFileProof(relativePath: string) {
  const bytes = readFileSync(join(packageRoot, ...relativePath.split("/")));

  return {
    relativePath,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex")
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

function packageManifestProof(): Record<string, unknown> {
  return {
    name: "dx-vscode",
    displayName: "DX Command Center",
    version: "0.1.0",
    publisher: "dx-runtime",
    main: "./dist/extension.js",
    commandCount: 2,
    activationEventCount: 2
  };
}

function writeDeflatedZipArtifactProof(
  outputPath: string,
  entries: Array<{ relativePath: string; sourcePath: string }>
): Record<string, unknown> {
  const fileParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const source = readFileSync(entry.sourcePath);
    const compressed = deflateRawSync(source);
    const name = Buffer.from(entry.relativePath, "utf8");
    const crc = crc32(source);
    const localHeader = Buffer.alloc(30);

    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(source.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    fileParts.push(localHeader, name, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(source.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);
    offset += localHeader.length + name.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(entries.length, 8);
  endOfCentralDirectory.writeUInt16LE(entries.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(offset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  const artifact = Buffer.concat([...fileParts, centralDirectory, endOfCentralDirectory]);
  writeFileSync(outputPath, artifact);

  return {
    path: outputPath,
    fileName: basename(outputPath),
    bytes: artifact.length,
    sha256: createHash("sha256").update(artifact).digest("hex"),
    zipHeaderVerified: true
  };
}

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc ^= byte;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}
