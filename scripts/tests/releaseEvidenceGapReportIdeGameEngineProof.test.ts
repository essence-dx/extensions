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

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-release-gaps-ide-game-"));
const adapters = [
  {
    adapterId: "dx.intellij-platform.command-center",
    host: "intellij-platform",
    hostApplication: "IntelliJ IDEA",
    hostToolId: "idea",
    manifestPath: "hosts/jetbrains/dx-intellij-platform/dx.extension.toml",
    loadedHostReceiptName: "sandbox-ide-latest.json",
    verificationMode: "sandbox-ide",
    requiredToolIds: ["idea", "gradle"],
    commandIds: [
      "dx.intellij-platform.show_status",
      "dx.intellij-platform.search_assets",
      "dx.intellij-platform.show_receipts"
    ],
    packageRoot: "hosts/jetbrains/dx-intellij-platform",
    packageReceipt: "dx.extension.intellij_platform.package_output",
    packageFormat: "intellij-platform-gradle-source-layout",
    packageSourceFile: "src/main/resources/META-INF/plugin.xml",
    archiveField: "gradlePluginPackage",
    archivePath: "artifacts/intellij/dx-intellij-platform-0.1.0.zip",
    archiveProof: { zipHeaderVerified: true },
    packageReleaseClaims: {
      sandboxIdeVerified: false,
      pluginVerifierVerified: false,
      gradlePluginPackageVerified: false,
      localServiceVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      marketplaceReviewVerified: false,
      distributionVerified: false
    },
    specialKind: "plugin_verifier",
    specialReceiptName: "plugin-verifier-latest.json",
    specialReceipt: {
      receipt: "dx.extension.ide_game_engine.plugin_verifier",
      proofKind: "plugin_verifier",
      pluginVerifier: {
        toolName: "JetBrains Plugin Verifier",
        toolVersion: "1.389",
        ideVersions: ["IC-2026.1"],
        compatible: true,
        problems: [],
        warnings: []
      },
      releaseClaims: {
        packageOutputVerified: true,
        pluginVerifierVerified: true,
        projectImportVerified: false,
        projectEnablementVerified: false
      }
    }
  },
  {
    adapterId: "dx.unity-editor.command-center",
    host: "unity-editor",
    hostApplication: "Unity Editor",
    hostToolId: "unity-editor",
    manifestPath: "hosts/unity/dx-unity-editor/dx.extension.toml",
    loadedHostReceiptName: "loaded-host-latest.json",
    verificationMode: "loaded-editor",
    requiredToolIds: ["unity-editor"],
    commandIds: [
      "dx.unity-editor.show_status",
      "dx.unity-editor.search_assets",
      "dx.unity-editor.show_receipts"
    ],
    packageRoot: "hosts/unity/dx-unity-editor",
    packageReceipt: "dx.extension.unity_editor.package_output",
    packageFormat: "unity-upm-source-layout",
    packageSourceFile: "package.json",
    archiveField: "upmTarball",
    archivePath: "artifacts/unity/dev.dx.unity-command-center-0.1.0.tgz",
    archiveProof: { gzipHeaderVerified: true },
    packageReleaseClaims: {
      loadedUnityEditorVerified: false,
      testProjectSmokeVerified: false,
      projectImportVerified: false,
      localServiceVerified: false,
      packageTarballVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      assetStoreReviewVerified: false,
      distributionVerified: false
    },
    specialKind: "project_import",
    specialReceiptName: "project-import-latest.json",
    specialReceipt: {
      receipt: "dx.extension.ide_game_engine.project_import",
      proofKind: "project_import",
      projectImport: {
        unityVersion: "2026.1.0f1",
        packageName: "dev.dx.unity-command-center",
        packageVersion: "0.1.0",
        testProjectKind: "empty-project",
        imported: true,
        compileStatus: "passed",
        editorTestsStatus: "passed",
        assetDatabaseRefreshed: true,
        mutatesProjectAssets: true
      },
      releaseClaims: {
        packageOutputVerified: true,
        pluginVerifierVerified: false,
        projectImportVerified: true,
        projectEnablementVerified: false
      }
    }
  },
  {
    adapterId: "dx.unreal-engine.command-center",
    host: "unreal-engine",
    hostApplication: "Unreal Editor",
    hostToolId: "unreal-editor",
    manifestPath: "hosts/unreal/dx-unreal-engine/dx.extension.toml",
    loadedHostReceiptName: "loaded-host-latest.json",
    verificationMode: "loaded-editor",
    requiredToolIds: ["unreal-editor"],
    commandIds: [
      "dx.unreal-engine.show_status",
      "dx.unreal-engine.search_assets",
      "dx.unreal-engine.show_receipts"
    ],
    packageRoot: "hosts/unreal/dx-unreal-engine",
    packageReceipt: "dx.extension.unreal_engine.package_output",
    packageFormat: "unreal-editor-source-plugin-layout",
    packageSourceFile: "DXUnrealCommandCenter.uplugin",
    archiveField: "packagedPlugin",
    archivePath: "artifacts/unreal/DXUnrealCommandCenter-0.1.0.zip",
    archiveProof: { zipHeaderVerified: true },
    packageReleaseClaims: {
      loadedUnrealEditorVerified: false,
      sampleProjectSmokeVerified: false,
      projectEnablementVerified: false,
      localServiceVerified: false,
      pluginPackageVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      fabMarketplaceReviewVerified: false,
      distributionVerified: false
    },
    specialKind: "project_enablement",
    specialReceiptName: "project-enablement-latest.json",
    specialReceipt: {
      receipt: "dx.extension.ide_game_engine.project_enablement",
      proofKind: "project_enablement",
      projectEnablement: {
        engineVersion: "5.6.0",
        pluginModuleName: "DXUnrealCommandCenterEditor",
        testProjectKind: "empty-sample-project",
        pluginEnabled: false,
        editorModuleLoaded: true,
        automationTestsStatus: "passed",
        mutatesProjectContent: false
      },
      releaseClaims: {
        packageOutputVerified: true,
        pluginVerifierVerified: false,
        projectImportVerified: false,
        projectEnablementVerified: true
      }
    }
  }
] as const;

try {
  writeGateFixtures();

  for (const adapter of adapters) {
    writePackageOutputReceipt(adapter);
    writeManualProof(adapter);
    writeLoadedHostReceipt(adapter);
    writeSpecialReceipt(adapter);
  }

  const report = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });

  const specialRequirements = new Map(
    report.extensions.map((extension) => [
      extension.id,
      extension.evidenceRequirements.find((requirement) =>
        ["plugin_verifier", "project_import", "project_enablement"].includes(requirement.kind)
      )
    ])
  );

  assert.equal(specialRequirements.get("dx.intellij-platform.command-center")?.releaseValid, true);
  assert.equal(specialRequirements.get("dx.unity-editor.command-center")?.releaseValid, false);
  assert.match(
    specialRequirements.get("dx.unity-editor.command-center")?.weakness ?? "",
    /mutates test project assets/
  );
  assert.equal(specialRequirements.get("dx.unreal-engine.command-center")?.releaseValid, false);
  assert.match(
    specialRequirements.get("dx.unreal-engine.command-center")?.weakness ?? "",
    /does not enable the Unreal plugin/
  );
  assert.deepEqual(JSON.parse(readFileSync(report.receiptPath, "utf8")), report);

  const intellijSpecialReceiptPath = specialReceiptPath(adapters[0]);
  const validIntellijSpecialReceiptSource = readFileSync(intellijSpecialReceiptPath, "utf8");
  const intellijSpecialReceiptWithoutLoadedHost = JSON.parse(validIntellijSpecialReceiptSource);

  delete intellijSpecialReceiptWithoutLoadedHost.loadedHostReceiptPath;
  delete intellijSpecialReceiptWithoutLoadedHost.loadedHostReceiptSha256;
  intellijSpecialReceiptWithoutLoadedHost.releaseClaims.loadedHostVerified = false;
  writeFileSync(intellijSpecialReceiptPath, `${JSON.stringify(intellijSpecialReceiptWithoutLoadedHost, null, 2)}\n`);

  const missingLoadedHostReport = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:30.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });
  const missingLoadedHostRequirement = specialRequirement(
    missingLoadedHostReport,
    adapters[0].adapterId
  );

  assert.equal(missingLoadedHostRequirement.releaseValid, false);
  assert.match(missingLoadedHostRequirement.weakness ?? "", /loaded-host proof|loaded-host receipt linkage/);
  writeFileSync(intellijSpecialReceiptPath, validIntellijSpecialReceiptSource);

  for (const adapter of adapters) {
    writeWorkspaceFile(
      `.dx/receipts/extensions/${adapter.adapterId}/package-output-latest.json`,
      "{}\n"
    );
    const stalePackageReport = writeReleaseEvidenceGapReport(workspaceRoot, {
      generatedAt: "2026-06-07T00:01:00.000Z",
      verificationCommand: "npm run report:release-evidence-gaps:j1"
    });
    const requirement = specialRequirement(stalePackageReport, adapter.adapterId);

    assert.equal(requirement.releaseValid, false);
    assert.match(requirement.weakness ?? "", /linked package-output receipt hash changed/);
    writePackageOutputReceipt(adapter);
  }

  for (const adapter of adapters) {
    writeWorkspaceFile(`proof/${adapter.specialKind}.txt`, "changed manual proof\n");
    const staleManualReport = writeReleaseEvidenceGapReport(workspaceRoot, {
      generatedAt: "2026-06-07T00:02:00.000Z",
      verificationCommand: "npm run report:release-evidence-gaps:j1"
    });
    const requirement = specialRequirement(staleManualReport, adapter.adapterId);

    assert.equal(requirement.releaseValid, false);
    assert.match(requirement.weakness ?? "", /manual proof file hash changed/);
    writeManualProof(adapter);
  }
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("IDE and game-engine release evidence gap classification verified");

function writeGateFixtures(): void {
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
path = "${dirname(adapter.manifestPath).split("\\").join("/")}"
manifest = "${adapter.manifestPath}"
status = "experimental"
professional_targets = ["${adapter.host}"]
`
  )
  .join("\n")}
`
  );

  for (const adapter of adapters) {
    writeWorkspaceFile(
      adapter.manifestPath,
      `
[extension]
id = "${adapter.adapterId}"
`
    );
    writeWorkspaceFile(`${adapter.packageRoot}/${adapter.packageSourceFile}`, `${adapter.adapterId} package source\n`);
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
required_evidence = ["host_execution", "package_output", "signing", "checksum", "distribution_review", "${adapter.specialKind}"]
evidence_receipt_requirements = ["host_execution=.dx/receipts/extensions/${adapter.adapterId}/loaded-host-latest.json", "package_output=.dx/receipts/extensions/${adapter.adapterId}/package-output-latest.json", "signing=.dx/receipts/extensions/${adapter.adapterId}/signing-latest.json", "checksum=.dx/receipts/extensions/${adapter.adapterId}/checksum-latest.json", "distribution_review=.dx/receipts/extensions/${adapter.adapterId}/distribution-latest.json", "${adapter.specialKind}=.dx/receipts/extensions/${adapter.adapterId}/${adapter.specialReceiptName}"]
evidence_receipts = [".dx/receipts/extensions/${adapter.adapterId}/loaded-host-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/package-output-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/signing-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/checksum-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/distribution-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/${adapter.specialReceiptName}"]
next_release_proof = "Run ${adapter.specialKind} proof"
blocked_by = ["host proof"]
`
  )
  .join("\n")}
`
  );
}

function writeSpecialReceipt(adapter: (typeof adapters)[number]): void {
  writeJsonFile(`.dx/receipts/extensions/${adapter.adapterId}/${adapter.specialReceiptName}`, {
    adapterId: adapter.adapterId,
    host: adapter.host,
    loadedHostReceiptPath: loadedHostLink(adapter).receiptPath,
    loadedHostReceiptSha256: loadedHostLink(adapter).receiptSha256,
    packageOutput: packageOutputLink(adapter),
    manualProof: manualProofLink(adapter),
    ...adapter.specialReceipt,
    releaseClaims: {
      ...adapter.specialReceipt.releaseClaims,
      loadedHostVerified: true
    }
  });
}

function specialReceiptPath(adapter: (typeof adapters)[number]): string {
  return absoluteWorkspacePath(`.dx/receipts/extensions/${adapter.adapterId}/${adapter.specialReceiptName}`);
}

function writePackageOutputReceipt(adapter: (typeof adapters)[number]): void {
  const sourceFileProof = readPackageFileProof(adapter.packageRoot, adapter.packageSourceFile);
  const archiveProof = writeArchiveProof(adapter);

  writeJsonFile(`.dx/receipts/extensions/${adapter.adapterId}/package-output-latest.json`, {
    receipt: adapter.packageReceipt,
    adapterId: adapter.adapterId,
    host: adapter.host,
    package: {
      root: absoluteWorkspacePath(adapter.packageRoot),
      format: adapter.packageFormat,
      fileCount: 1,
      sha256: hashPackageFiles([sourceFileProof]),
      files: [sourceFileProof]
    },
    ...archiveProof,
    releaseClaims: adapter.packageReleaseClaims
  });
}

function writeArchiveProof(adapter: (typeof adapters)[number]) {
  const artifactPath = absoluteWorkspacePath(adapter.archivePath);
  const entry = {
    relativePath: adapter.packageSourceFile,
    sourcePath: absoluteWorkspacePath(`${adapter.packageRoot}/${adapter.packageSourceFile}`)
  };
  const proof = "gzipHeaderVerified" in adapter.archiveProof
    ? writeGzipTarballArtifactProof(artifactPath, [entry])
    : writeZipArtifactProof(artifactPath, [entry]);

  return {
    [adapter.archiveField]: {
      ...proof,
      ...adapter.archiveProof
    }
  };
}

function writeManualProof(adapter: (typeof adapters)[number]): void {
  writeWorkspaceFile(`proof/${adapter.specialKind}.txt`, `${adapter.specialKind} manual proof\n`);
}

function packageOutputLink(adapter: (typeof adapters)[number]) {
  const receiptPath = absoluteWorkspacePath(`.dx/receipts/extensions/${adapter.adapterId}/package-output-latest.json`);
  const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));

  return {
    receiptPath,
    receiptSha256: sha256(readFileSync(receiptPath)),
    packageSha256: receipt.package.sha256,
    filesVerified: receipt.package.fileCount
  };
}

function manualProofLink(adapter: (typeof adapters)[number]) {
  const proofFilePath = absoluteWorkspacePath(`proof/${adapter.specialKind}.txt`);

  return {
    proofFilePath,
    proofFileSha256: sha256(readFileSync(proofFilePath))
  };
}

function loadedHostLink(adapter: (typeof adapters)[number]) {
  const receiptPath = absoluteWorkspacePath(
    `.dx/receipts/extensions/${adapter.adapterId}/${adapter.loadedHostReceiptName}`
  );

  return {
    receiptPath,
    receiptSha256: sha256(readFileSync(receiptPath))
  };
}

function specialRequirement(report: ReturnType<typeof writeReleaseEvidenceGapReport>, adapterId: string) {
  const extension = report.extensions.find((entry) => entry.id === adapterId);
  assert.ok(extension, `${adapterId} must appear in report`);

  const requirement = extension.evidenceRequirements.find((entry) =>
    ["plugin_verifier", "project_import", "project_enablement"].includes(entry.kind)
  );
  assert.ok(requirement, `${adapterId} must include special proof requirement`);

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

function absoluteWorkspacePath(relativePath: string): string {
  return join(workspaceRoot, ...relativePath.split("/"));
}

function writeLoadedHostReceipt(adapter: (typeof adapters)[number]): void {
  writeHostExecutable(adapter);
  writeHostDiscoveryReceipt(adapter);
  writeWorkspaceFile(
    `.dx/receipts/extensions/${adapter.adapterId}/${adapter.loadedHostReceiptName}`,
    `${JSON.stringify(validLoadedHostReceipt(adapter), null, 2)}\n`
  );
}

function validLoadedHostReceipt(adapter: (typeof adapters)[number]) {
  return {
    receipt: "dx.extension.ide_game_engine.loaded_host",
    adapterId: adapter.adapterId,
    host: adapter.host,
    hostApplication: {
      name: adapter.hostApplication,
      version: "2026.1.0",
      executablePath: hostExecutablePath(adapter),
      verificationMode: adapter.verificationMode,
      projectState: "loaded"
    },
    hostDiscovery: hostDiscoveryLink(adapter),
    packageOutput: packageOutputLink(adapter),
    loadedHost: {
      extensionInstalled: true,
      commandIdsVisible: adapter.commandIds,
      commandResults: adapter.commandIds.map(commandResultFor),
      localServiceRequestsBlocked: true
    },
    manualProof: loadedHostManualProofLink(adapter),
    releaseClaims: {
      loadedHostVerified: true
    }
  };
}

function writeHostExecutable(adapter: (typeof adapters)[number]): void {
  writeWorkspaceFile(`tools/${adapter.host}.exe`, `${adapter.hostApplication}\n`);
}

function hostExecutablePath(adapter: (typeof adapters)[number]): string {
  return absoluteWorkspacePath(`tools/${adapter.host}.exe`);
}

function writeHostDiscoveryReceipt(adapter: (typeof adapters)[number]): void {
  const tools = adapter.requiredToolIds.map((toolId) => ({
    id: toolId,
    label: `${adapter.hostApplication} ${toolId}`,
    required: true,
    found: true,
    path: requiredToolProofPath(adapter, toolId),
    candidatesChecked: 1
  }));

  writeJsonFile(`.dx/receipts/extensions/${adapter.adapterId}/host-discovery-latest.json`, {
    receipt: "dx.extension.platform_host_discovery",
    adapterId: adapter.adapterId,
    discoveryMode: "local-tooling",
    host: adapter.host,
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run preflight:platform-host-discovery:j1",
    receiptPath: absoluteWorkspacePath(`.dx/receipts/extensions/${adapter.adapterId}/host-discovery-latest.json`),
    status: "candidate-found",
    reason: "required_tools_found",
    candidateFound: true,
    missingRequiredTools: [],
    tools,
    preflightClaims: {
      hostExecuted: false,
      loadedHostVerified: false,
      releaseReady: false
    }
  });
}

function hostDiscoveryLink(adapter: (typeof adapters)[number]) {
  const receiptPath = absoluteWorkspacePath(`.dx/receipts/extensions/${adapter.adapterId}/host-discovery-latest.json`);

  return {
    receiptPath,
    receiptSha256: sha256(readFileSync(receiptPath)),
    toolId: adapter.hostToolId,
    toolPath: hostExecutablePath(adapter),
    executableSha256: sha256(readFileSync(hostExecutablePath(adapter))),
    requiredTools: adapter.requiredToolIds.map((toolId) => {
      const path = requiredToolProofPath(adapter, toolId);

      return {
        id: toolId,
        path,
        sha256: sha256(readFileSync(path))
      };
    })
  };
}

function loadedHostManualProofLink(adapter: (typeof adapters)[number]) {
  const proofFilePath = absoluteWorkspacePath(`proof/${adapter.host}-loaded-host.txt`);

  writeWorkspaceFile(`proof/${adapter.host}-loaded-host.txt`, `${adapter.hostApplication} loaded-host proof\n`);

  return {
    proofFilePath,
    proofFileSha256: sha256(readFileSync(proofFilePath))
  };
}

function requiredToolProofPath(adapter: (typeof adapters)[number], toolId: string): string {
  if (toolId === adapter.hostToolId) {
    return hostExecutablePath(adapter);
  }

  const relativePath = `tools/${adapter.host}-${toolId}.tool`;
  writeWorkspaceFile(relativePath, `${adapter.hostApplication} ${toolId}\n`);
  return absoluteWorkspacePath(relativePath);
}

function commandResultFor(commandId: string) {
  if (commandId.endsWith("show_receipts")) {
    return {
      commandId,
      operation: "receipt.showPath",
      transport: "host-ui",
      status: "visible"
    };
  }

  return {
    commandId,
    operation: commandId.endsWith("search_assets") ? "dx.assets.search" : "dx.status",
    transport: "local-service",
    status: "proof-blocked"
  };
}

function readPackageFileProof(packageRoot: string, relativePath: string) {
  const bytes = readFileSync(absoluteWorkspacePath(`${packageRoot}/${relativePath}`));

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
