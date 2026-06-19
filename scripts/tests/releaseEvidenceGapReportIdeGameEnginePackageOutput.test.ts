import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  writeGzipTarballArtifactProof,
  writeZipArtifactProof
} from "../lib/package-artifact-proof.ts";
import { writeReleaseEvidenceGapReport } from "../write-release-evidence-gap-report.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-release-gaps-ide-game-package-"));
const adapters = [
  {
    adapterId: "dx.intellij-platform.command-center",
    host: "intellij-platform",
    packageRoot: "hosts/jetbrains/dx-intellij-platform",
    receipt: "dx.extension.intellij_platform.package_output",
    format: "intellij-platform-gradle-source-layout",
    sourceFile: "src/main/resources/META-INF/plugin.xml",
    archiveKind: "zip",
    archiveField: "gradlePluginPackage",
    archivePath: "artifacts/intellij/dx-intellij-platform-0.1.0.zip",
    archiveFileName: "dx-intellij-platform-0.1.0.zip",
    archiveBytes: Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4]),
    archiveProof: { zipHeaderVerified: true },
    weakness: /IntelliJ package-output receipt is missing Gradle plugin ZIP proof/,
    releaseClaims: {
      sandboxIdeVerified: false,
      pluginVerifierVerified: false,
      gradlePluginPackageVerified: false,
      localServiceVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      marketplaceReviewVerified: false,
      distributionVerified: false
    }
  },
  {
    adapterId: "dx.unity-editor.command-center",
    host: "unity-editor",
    packageRoot: "hosts/unity/dx-unity-editor",
    receipt: "dx.extension.unity_editor.package_output",
    format: "unity-upm-source-layout",
    sourceFile: "package.json",
    archiveKind: "gzip-tarball",
    archiveField: "upmTarball",
    archivePath: "artifacts/unity/dev.dx.unity-command-center-0.1.0.tgz",
    archiveFileName: "dev.dx.unity-command-center-0.1.0.tgz",
    archiveBytes: Uint8Array.from([0x1f, 0x8b, 0x08, 0x00, 1, 2, 3, 4]),
    archiveProof: { gzipHeaderVerified: true },
    weakness: /Unity package-output receipt is missing UPM tarball proof/,
    releaseClaims: {
      loadedUnityEditorVerified: false,
      testProjectSmokeVerified: false,
      projectImportVerified: false,
      localServiceVerified: false,
      packageTarballVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      assetStoreReviewVerified: false,
      distributionVerified: false
    }
  },
  {
    adapterId: "dx.unreal-engine.command-center",
    host: "unreal-engine",
    packageRoot: "hosts/unreal/dx-unreal-engine",
    receipt: "dx.extension.unreal_engine.package_output",
    format: "unreal-editor-source-plugin-layout",
    sourceFile: "DXUnrealCommandCenter.uplugin",
    archiveKind: "zip",
    archiveField: "packagedPlugin",
    archivePath: "artifacts/unreal/DXUnrealCommandCenter-0.1.0.zip",
    archiveFileName: "DXUnrealCommandCenter-0.1.0.zip",
    archiveBytes: Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 4, 3, 2, 1]),
    archiveProof: { zipHeaderVerified: true },
    weakness: /Unreal package-output receipt is missing packaged plugin ZIP proof/,
    releaseClaims: {
      loadedUnrealEditorVerified: false,
      sampleProjectSmokeVerified: false,
      projectEnablementVerified: false,
      localServiceVerified: false,
      pluginPackageVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      fabMarketplaceReviewVerified: false,
      distributionVerified: false
    }
  }
] as const;

try {
  writeWorkspaceFixtures();

  for (const adapter of adapters) {
    writePackageOutputReceipt(adapter, "source-layout");
  }

  const sourceLayoutReport = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-08T00:00:00.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });

  for (const adapter of adapters) {
    const requirement = packageRequirement(sourceLayoutReport, adapter.adapterId);

    assert.equal(requirement.releaseValid, false);
    assert.match(requirement.weakness ?? "", adapter.weakness);
  }

  for (const adapter of adapters) {
    writePackageOutputReceipt(adapter, "header-only-archive");
  }

  const headerOnlyArchiveReport = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-08T00:00:15.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });

  for (const adapter of adapters) {
    const requirement = packageRequirement(headerOnlyArchiveReport, adapter.adapterId);

    assert.equal(requirement.releaseValid, false);
    assert.match(requirement.weakness ?? "", /archive is not readable package content/);
  }

  for (const adapter of adapters) {
    writePackageOutputReceipt(adapter, "release-archive");
  }

  const archiveReport = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-08T00:00:30.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });

  for (const adapter of adapters) {
    assert.equal(packageRequirement(archiveReport, adapter.adapterId).releaseValid, true);
  }
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("IDE and game-engine package-output release evidence classification verified");

function writeWorkspaceFixtures(): void {
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
path = "${adapter.packageRoot}"
manifest = "${adapter.packageRoot}/dx.extension.toml"
status = "experimental"
professional_targets = ["${adapter.host}"]
`
  )
  .join("\n")}
`
  );

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
required_evidence = ["host_execution", "package_output", "signing", "checksum", "distribution_review"]
evidence_receipt_requirements = ["host_execution=.dx/receipts/extensions/${adapter.adapterId}/loaded-host-latest.json", "package_output=.dx/receipts/extensions/${adapter.adapterId}/package-output-latest.json", "signing=.dx/receipts/extensions/${adapter.adapterId}/signing-latest.json", "checksum=.dx/receipts/extensions/${adapter.adapterId}/checksum-latest.json", "distribution_review=.dx/receipts/extensions/${adapter.adapterId}/distribution-latest.json"]
evidence_receipts = [".dx/receipts/extensions/${adapter.adapterId}/loaded-host-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/package-output-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/signing-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/checksum-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/distribution-latest.json"]
next_release_proof = "Build the release package artifact."
blocked_by = ["release package artifact"]
`
  )
  .join("\n")}
`
  );

  for (const adapter of adapters) {
    writeWorkspaceFile(`${adapter.packageRoot}/dx.extension.toml`, `[extension]\nid = "${adapter.adapterId}"\n`);
    writeWorkspaceFile(`${adapter.packageRoot}/${adapter.sourceFile}`, `${adapter.adapterId} package source\n`);
  }
}

function writePackageOutputReceipt(
  adapter: (typeof adapters)[number],
  mode: "source-layout" | "header-only-archive" | "release-archive"
): void {
  const sourceFileProof = readPackageFileProof(adapter.packageRoot, adapter.sourceFile);
  const archiveProof = mode === "source-layout" ? {} : writeArchiveProof(adapter, mode);

  writeJsonFile(`.dx/receipts/extensions/${adapter.adapterId}/package-output-latest.json`, {
    receipt: adapter.receipt,
    adapterId: adapter.adapterId,
    host: adapter.host,
    package: {
      root: join(workspaceRoot, ...adapter.packageRoot.split("/")),
      format: adapter.format,
      fileCount: 1,
      sha256: hashPackageFiles([sourceFileProof]),
      files: [sourceFileProof]
    },
    ...archiveProof,
    releaseClaims: adapter.releaseClaims
  });
}

function writeArchiveProof(
  adapter: (typeof adapters)[number],
  mode: "header-only-archive" | "release-archive"
) {
  const artifactPath = join(workspaceRoot, ...adapter.archivePath.split("/"));
  let proof;

  if (mode === "release-archive") {
    const entry = {
      relativePath: adapter.sourceFile,
      sourcePath: join(workspaceRoot, ...adapter.packageRoot.split("/"), ...adapter.sourceFile.split("/"))
    };

    proof = adapter.archiveKind === "zip"
      ? writeZipArtifactProof(artifactPath, [entry])
      : writeGzipTarballArtifactProof(artifactPath, [entry]);
  } else {
    mkdirSync(dirname(artifactPath), { recursive: true });
    writeFileSync(artifactPath, adapter.archiveBytes);
    proof = {
      path: artifactPath,
      fileName: adapter.archiveFileName,
      bytes: adapter.archiveBytes.length,
      sha256: sha256(Buffer.from(adapter.archiveBytes))
    };
  }

  return {
    [adapter.archiveField]: {
      ...proof,
      ...adapter.archiveProof
    }
  };
}

function packageRequirement(report: ReturnType<typeof writeReleaseEvidenceGapReport>, adapterId: string) {
  const extension = report.extensions.find((entry) => entry.id === adapterId);
  assert.ok(extension, `${adapterId} gap entry must exist`);

  const requirement = extension.evidenceRequirements.find((entry) => entry.kind === "package_output");
  assert.ok(requirement, `${adapterId} package_output requirement must exist`);

  return requirement;
}

function writeJsonFile(relativePath: string, value: unknown): void {
  writeWorkspaceFile(relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeWorkspaceFile(relativePath: string, source: string): void {
  const absolutePath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);
}

function readPackageFileProof(packageRoot: string, relativePath: string) {
  const bytes = readFileSync(join(workspaceRoot, ...packageRoot.split("/"), ...relativePath.split("/")));

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
