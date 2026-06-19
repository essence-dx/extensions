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

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-release-gaps-ide-loaded-host-"));
const adapters = [
  {
    adapterId: "dx.intellij-platform.command-center",
    host: "intellij-platform",
    hostApplication: "IntelliJ IDEA",
    manifestPath: "hosts/jetbrains/dx-intellij-platform/dx.extension.toml",
    receiptName: "sandbox-ide-latest.json",
    verificationMode: "sandbox-ide",
    hostToolId: "idea",
    requiredToolIds: ["idea", "gradle"],
    packageOutput: {
      receipt: "dx.extension.intellij_platform.package_output",
      format: "intellij-platform-gradle-source-layout",
      sourceFile: "src/main/resources/META-INF/plugin.xml",
      artifactField: "gradlePluginPackage",
      artifactPath: "artifacts/intellij/dx-intellij-platform-0.1.0.zip",
      artifactProof: { zipHeaderVerified: true },
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
    commandIds: [
      "dx.intellij-platform.show_status",
      "dx.intellij-platform.search_assets",
      "dx.intellij-platform.show_receipts"
    ]
  },
  {
    adapterId: "dx.visual-studio.command-center",
    host: "visual-studio",
    hostApplication: "Visual Studio",
    manifestPath: "hosts/visual-studio/dx-visual-studio/dx.extension.toml",
    receiptName: "experimental-instance-latest.json",
    verificationMode: "experimental-instance",
    hostToolId: "devenv",
    requiredToolIds: ["devenv", "msbuild", "dotnet", "vssdk-targets"],
    packageOutput: {
      receipt: "dx.extension.visual_studio.package_output",
      format: "visual-studio-vsix-source-layout",
      sourceFile: "source.extension.vsixmanifest",
      artifactField: "vsix",
      artifactPath: "artifacts/visual-studio/dx-visual-studio-0.1.0.vsix",
      artifactProof: { zipHeaderVerified: true },
      releaseClaims: {
        loadedExperimentalInstanceVerified: false,
        vsixPackageVerified: false,
        localServiceVerified: false,
        signingVerified: false,
        releaseChecksumVerified: false,
        marketplaceReviewVerified: false,
        distributionVerified: false
      }
    },
    commandIds: [
      "dx.visual-studio.show_status",
      "dx.visual-studio.search_assets",
      "dx.visual-studio.show_receipts"
    ]
  },
  {
    adapterId: "dx.unity-editor.command-center",
    host: "unity-editor",
    hostApplication: "Unity Editor",
    manifestPath: "hosts/unity/dx-unity-editor/dx.extension.toml",
    receiptName: "loaded-host-latest.json",
    verificationMode: "loaded-editor",
    hostToolId: "unity-editor",
    requiredToolIds: ["unity-editor"],
    packageOutput: {
      receipt: "dx.extension.unity_editor.package_output",
      format: "unity-upm-source-layout",
      sourceFile: "package.json",
      artifactField: "upmTarball",
      artifactPath: "artifacts/unity/dev.dx.unity-command-center-0.1.0.tgz",
      artifactProof: { gzipHeaderVerified: true },
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
    commandIds: [
      "dx.unity-editor.show_status",
      "dx.unity-editor.search_assets",
      "dx.unity-editor.show_receipts"
    ]
  },
  {
    adapterId: "dx.unreal-engine.command-center",
    host: "unreal-engine",
    hostApplication: "Unreal Editor",
    manifestPath: "hosts/unreal/dx-unreal-engine/dx.extension.toml",
    receiptName: "loaded-host-latest.json",
    verificationMode: "loaded-editor",
    hostToolId: "unreal-editor",
    requiredToolIds: ["unreal-editor"],
    packageOutput: {
      receipt: "dx.extension.unreal_engine.package_output",
      format: "unreal-editor-source-plugin-layout",
      sourceFile: "DXUnrealCommandCenter.uplugin",
      artifactField: "packagedPlugin",
      artifactPath: "artifacts/unreal/DXUnrealCommandCenter-0.1.0.zip",
      artifactProof: { zipHeaderVerified: true },
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
    },
    commandIds: [
      "dx.unreal-engine.show_status",
      "dx.unreal-engine.search_assets",
      "dx.unreal-engine.show_receipts"
    ]
  }
] as const;

try {
  writeWorkspaceFixtures();

  for (const adapter of adapters) {
    writePackageOutputReceipt(adapter);
    writeManualProofFile(adapter);
    writeHostExecutable(adapter);
    writeHostDiscoveryReceipt(adapter);
  }

  for (const adapter of adapters) {
    writeWorkspaceFile(
      `.dx/receipts/extensions/${adapter.adapterId}/${adapter.receiptName}`,
      JSON.stringify(fakeLoadedHostReceipt(adapter), null, 2)
    );
  }

  const weakReport = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });

  for (const adapter of adapters) {
    const requirement = hostExecutionRequirement(weakReport, adapter.adapterId);
    assert.equal(requirement.releaseValid, false, `${adapter.adapterId} fake loaded-host receipt must be weak`);
    assert.match(requirement.weakness ?? "", /expected command IDs|verification mode|command result (statuses|semantics)/);
  }

  for (const adapter of adapters) {
    writeWorkspaceFile(
      `.dx/receipts/extensions/${adapter.adapterId}/${adapter.receiptName}`,
      JSON.stringify(validLoadedHostReceipt(adapter), null, 2)
    );
  }

  const validReport = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });

  for (const adapter of adapters) {
    const requirement = hostExecutionRequirement(validReport, adapter.adapterId);
    assert.equal(requirement.releaseValid, true, `${adapter.adapterId} valid loaded-host receipt must stay valid`);
  }

  writeWorkspaceFile(
    `.dx/receipts/extensions/${adapters[2].adapterId}/${adapters[2].receiptName}`,
    JSON.stringify(
      {
        ...validLoadedHostReceipt(adapters[2]),
        loadedHost: {
          ...validLoadedHostReceipt(adapters[2]).loadedHost,
          commandResults: adapters[2].commandIds.map((commandId) =>
            commandId.endsWith("show_status")
              ? {
                  commandId,
                  operation: "receipt.showPath",
                  transport: "host-ui",
                  status: "visible"
                }
              : commandResultFor(commandId)
          )
        }
      },
      null,
      2
    )
  );
  const wrongCommandSemanticsReport = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:10.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });
  const wrongCommandSemanticsRequirement = hostExecutionRequirement(
    wrongCommandSemanticsReport,
    adapters[2].adapterId
  );

  assert.equal(wrongCommandSemanticsRequirement.releaseValid, false);
  assert.match(
    wrongCommandSemanticsRequirement.weakness ?? "",
    /IDE\/game-engine loaded-host receipt has unsupported command result semantics/
  );

  writeWorkspaceFile(
    `.dx/receipts/extensions/${adapters[2].adapterId}/${adapters[2].receiptName}`,
    JSON.stringify(validLoadedHostReceipt(adapters[2]), null, 2)
  );

  rmSync(hostExecutablePath(adapters[1]), { force: true });
  const missingHostExecutableReport = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:15.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });
  const missingHostExecutableRequirement = hostExecutionRequirement(
    missingHostExecutableReport,
    adapters[1].adapterId
  );

  assert.equal(missingHostExecutableRequirement.releaseValid, false);
  assert.match(
    missingHostExecutableRequirement.weakness ?? "",
    /IDE\/game-engine loaded-host host executable does not exist/
  );

  writeHostExecutable(adapters[1]);

  writeWorkspaceFile(
    `.dx/receipts/extensions/${adapters[2].adapterId}/${adapters[2].receiptName}`,
    JSON.stringify(loadedHostReceiptWithoutHostDiscovery(adapters[2]), null, 2)
  );
  const missingHostDiscoveryReport = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:30.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });
  const missingHostDiscoveryRequirement = hostExecutionRequirement(
    missingHostDiscoveryReport,
    adapters[2].adapterId
  );

  assert.equal(missingHostDiscoveryRequirement.releaseValid, false);
  assert.match(
    missingHostDiscoveryRequirement.weakness ?? "",
    /IDE\/game-engine loaded-host receipt is missing host-discovery linkage/
  );

  writeWorkspaceFile(
    `.dx/receipts/extensions/${adapters[2].adapterId}/${adapters[2].receiptName}`,
    JSON.stringify(validLoadedHostReceipt(adapters[2]), null, 2)
  );
  writeHostDiscoveryReceipt(adapters[3], "G:/fake/wrong-unreal-host.exe");
  writeWorkspaceFile(
    `.dx/receipts/extensions/${adapters[3].adapterId}/${adapters[3].receiptName}`,
    JSON.stringify(validLoadedHostReceipt(adapters[3]), null, 2)
  );
  const mismatchedHostDiscoveryReport = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:45.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });
  const mismatchedHostDiscoveryRequirement = hostExecutionRequirement(
    mismatchedHostDiscoveryReport,
    adapters[3].adapterId
  );

  assert.equal(mismatchedHostDiscoveryRequirement.releaseValid, false);
  assert.match(
    mismatchedHostDiscoveryRequirement.weakness ?? "",
    /IDE\/game-engine loaded-host host-discovery receipt does not match the host executable/
  );

  writeHostDiscoveryReceipt(adapters[3]);

  writeHostDiscoveryReceipt(adapters[1], hostExecutablePath(adapters[1]), {
    omitRequiredToolIds: ["vssdk-targets"]
  });
  writeWorkspaceFile(
    `.dx/receipts/extensions/${adapters[1].adapterId}/${adapters[1].receiptName}`,
    JSON.stringify(validLoadedHostReceipt(adapters[1]), null, 2)
  );
  const missingRequiredDiscoveryToolReport = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:50.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });
  const missingRequiredDiscoveryToolRequirement = hostExecutionRequirement(
    missingRequiredDiscoveryToolReport,
    adapters[1].adapterId
  );

  assert.equal(missingRequiredDiscoveryToolRequirement.releaseValid, false);
  assert.match(
    missingRequiredDiscoveryToolRequirement.weakness ?? "",
    /missing required host-discovery tool: vssdk-targets/
  );

  writeHostDiscoveryReceipt(adapters[1]);

  writeHostDiscoveryReceipt(adapters[1], hostExecutablePath(adapters[1]), {
    missingRequiredTools: ["vssdk-targets"]
  });
  writeWorkspaceFile(
    `.dx/receipts/extensions/${adapters[1].adapterId}/${adapters[1].receiptName}`,
    JSON.stringify(validLoadedHostReceipt(adapters[1]), null, 2)
  );
  const contradictoryMissingToolReport = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:52.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });
  const contradictoryMissingToolRequirement = hostExecutionRequirement(
    contradictoryMissingToolReport,
    adapters[1].adapterId
  );

  assert.equal(contradictoryMissingToolRequirement.releaseValid, false);
  assert.match(
    contradictoryMissingToolRequirement.weakness ?? "",
    /host-discovery receipt contradicts missing required tools: vssdk-targets/
  );

  writeHostDiscoveryReceipt(adapters[1]);

  writeWorkspaceFile(
    `.dx/receipts/extensions/${adapters[0].adapterId}/${adapters[0].receiptName}`,
    JSON.stringify(
      {
        ...validLoadedHostReceipt(adapters[0]),
        hostApplication: {
          ...validLoadedHostReceipt(adapters[0]).hostApplication,
          projectState: "empty"
        }
      },
      null,
      2
    )
  );
  const emptyProjectStateReport = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:55.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });
  const emptyProjectStateRequirement = hostExecutionRequirement(
    emptyProjectStateReport,
    adapters[0].adapterId
  );

  assert.equal(emptyProjectStateRequirement.releaseValid, false);
  assert.match(
    emptyProjectStateRequirement.weakness ?? "",
    /IDE\/game-engine loaded-host receipt must verify a loaded project state/
  );

  writeWorkspaceFile(
    `.dx/receipts/extensions/${adapters[0].adapterId}/${adapters[0].receiptName}`,
    JSON.stringify(validLoadedHostReceipt(adapters[0]), null, 2)
  );

  writeWorkspaceFile(`proof/${adapters[0].host}.txt`, "changed manual proof\n");
  const staleManualProofReport = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-07T00:01:00.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });
  const staleManualProofRequirement = hostExecutionRequirement(staleManualProofReport, adapters[0].adapterId);

  assert.equal(staleManualProofRequirement.releaseValid, false);
  assert.match(
    staleManualProofRequirement.weakness ?? "",
    /IDE\/game-engine loaded-host manual proof file hash changed/
  );

  writeManualProofFile(adapters[0]);
  writeWorkspaceFile(
    `.dx/receipts/extensions/${adapters[1].adapterId}/package-output-latest.json`,
    "{}\n"
  );
  const stalePackageOutputReport = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-07T00:02:00.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });
  const stalePackageOutputRequirement = hostExecutionRequirement(
    stalePackageOutputReport,
    adapters[1].adapterId
  );

  assert.equal(stalePackageOutputRequirement.releaseValid, false);
  assert.match(
    stalePackageOutputRequirement.weakness ?? "",
    /IDE\/game-engine loaded-host linked package-output receipt hash changed/
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("IDE/game-engine loaded-host release evidence classification verified");

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
path = "${dirname(adapter.manifestPath).split("\\").join("/")}"
manifest = "${adapter.manifestPath}"
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
evidence_receipt_requirements = ["host_execution=.dx/receipts/extensions/${adapter.adapterId}/${adapter.receiptName}", "package_output=.dx/receipts/extensions/${adapter.adapterId}/package-output-latest.json", "signing=.dx/receipts/extensions/${adapter.adapterId}/signing-latest.json", "checksum=.dx/receipts/extensions/${adapter.adapterId}/checksum-latest.json", "distribution_review=.dx/receipts/extensions/${adapter.adapterId}/distribution-latest.json"]
evidence_receipts = [".dx/receipts/extensions/${adapter.adapterId}/${adapter.receiptName}", ".dx/receipts/extensions/${adapter.adapterId}/package-output-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/signing-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/checksum-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/distribution-latest.json"]
next_release_proof = "Run loaded host smoke"
blocked_by = ["host proof"]
`
  )
  .join("\n")}
`
  );

  for (const adapter of adapters) {
    writeWorkspaceFile(adapter.manifestPath, `[extension]\nid = "${adapter.adapterId}"\n`);
    writeWorkspaceFile(
      `${dirname(adapter.manifestPath).split("\\").join("/")}/${adapter.packageOutput.sourceFile}`,
      `${adapter.adapterId} package source\n`
    );
  }
}

function fakeLoadedHostReceipt(adapter: (typeof adapters)[number]) {
  return {
    receipt: "dx.extension.ide_game_engine.loaded_host",
    adapterId: adapter.adapterId,
    host: adapter.host,
    hostApplication: {
      name: "Wrong Host",
      version: "2026.1.0",
      executablePath: "G:/fake/host.exe",
      verificationMode: "wrong-mode",
      projectState: "loaded"
    },
    packageOutput: packageOutputLink(adapter),
    loadedHost: {
      extensionInstalled: true,
      commandIdsVisible: ["dx.fake.command"],
      commandResults: [
        {
          commandId: "dx.fake.command",
          operation: "dx.status",
          transport: "local-service",
          status: "clicked"
        }
      ],
      localServiceRequestsBlocked: true
    },
    manualProof: manualProofLink(adapter),
    releaseClaims: {
      loadedHostVerified: true
    }
  };
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
    manualProof: manualProofLink(adapter),
    releaseClaims: {
      loadedHostVerified: true
    }
  };
}

function loadedHostReceiptWithoutHostDiscovery(adapter: (typeof adapters)[number]) {
  const receipt = validLoadedHostReceipt(adapter);
  delete (receipt as Partial<typeof receipt>).hostDiscovery;
  return receipt;
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

function packageOutputLink(adapter: (typeof adapters)[number]) {
  const receiptPath = absoluteWorkspacePath(`.dx/receipts/extensions/${adapter.adapterId}/package-output-latest.json`);
  const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));

  return {
    receiptPath,
    receiptSha256: sha256(readFileSync(receiptPath)),
    packageSha256: receipt.package.sha256
  };
}

function manualProofLink(adapter: (typeof adapters)[number]) {
  const proofFilePath = absoluteWorkspacePath(`proof/${adapter.host}.txt`);

  return {
    proofFilePath,
    proofFileSha256: sha256(readFileSync(proofFilePath))
  };
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
      const path = toolId === adapter.hostToolId ? hostExecutablePath(adapter) : requiredToolPath(adapter, toolId);

      return {
        id: toolId,
        path,
        sha256: sha256(readFileSync(path))
      };
    })
  };
}

function hostExecutionRequirement(report: ReturnType<typeof writeReleaseEvidenceGapReport>, adapterId: string) {
  const extension = report.extensions.find((entry) => entry.id === adapterId);
  assert.ok(extension, `${adapterId} must appear in report`);

  const requirement = extension.evidenceRequirements.find((entry) => entry.kind === "host_execution");
  assert.ok(requirement, `${adapterId} must include host_execution requirement`);

  return requirement;
}

function writeWorkspaceFile(relativePath: string, source: string): void {
  const absolutePath = absoluteWorkspacePath(relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);
}

function absoluteWorkspacePath(relativePath: string): string {
  return join(workspaceRoot, ...relativePath.split("/"));
}

function writePackageOutputReceipt(adapter: (typeof adapters)[number]): void {
  const packageRoot = dirname(adapter.manifestPath).split("\\").join("/");
  const packageFile = readPackageFileProof(packageRoot, adapter.packageOutput.sourceFile);
  const artifact = writeArtifactProof(adapter);

  writeJsonFile(`.dx/receipts/extensions/${adapter.adapterId}/package-output-latest.json`, {
    receipt: adapter.packageOutput.receipt,
    adapterId: adapter.adapterId,
    host: adapter.host,
    package: {
      root: absoluteWorkspacePath(packageRoot),
      format: adapter.packageOutput.format,
      fileCount: 1,
      sha256: hashPackageFiles([packageFile]),
      files: [packageFile]
    },
    [adapter.packageOutput.artifactField]: artifact,
    releaseClaims: adapter.packageOutput.releaseClaims
  });
}

function writeHostDiscoveryReceipt(
  adapter: (typeof adapters)[number],
  hostExecutablePath = hostExecutablePathFor(adapter),
  options: { missingRequiredTools?: string[]; omitRequiredToolIds?: string[] } = {}
): void {
  const omittedRequiredToolIds = new Set(options.omitRequiredToolIds ?? []);
  const tools = adapter.requiredToolIds
    .filter((toolId) => !omittedRequiredToolIds.has(toolId))
    .map((toolId) => ({
      id: toolId,
      label: `${adapter.hostApplication} ${toolId}`,
      required: true,
      found: true,
      path: toolId === adapter.hostToolId ? hostExecutablePath : requiredToolPath(adapter, toolId),
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
    missingRequiredTools: options.missingRequiredTools ?? [],
    tools,
    preflightClaims: {
      hostExecuted: false,
      loadedHostVerified: false,
      releaseReady: false
    }
  });
}

function writeHostExecutable(adapter: (typeof adapters)[number], source = `${adapter.hostApplication} executable\n`): void {
  writeWorkspaceFile(`tools/${adapter.host}.exe`, source);
}

function hostExecutablePath(adapter: (typeof adapters)[number]): string {
  return hostExecutablePathFor(adapter);
}

function hostExecutablePathFor(adapter: (typeof adapters)[number]): string {
  return absoluteWorkspacePath(`tools/${adapter.host}.exe`);
}

function requiredToolPath(adapter: (typeof adapters)[number], toolId: string): string {
  const relativePath = `tools/${adapter.host}-${toolId}.tool`;

  writeWorkspaceFile(relativePath, `${adapter.hostApplication} ${toolId}\n`);
  return absoluteWorkspacePath(relativePath);
}

function writeJsonFile(relativePath: string, value: unknown): void {
  writeWorkspaceFile(relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeArtifactProof(adapter: (typeof adapters)[number]) {
  const absolutePath = absoluteWorkspacePath(adapter.packageOutput.artifactPath);
  const packageRoot = dirname(adapter.manifestPath).split("\\").join("/");
  const entry = {
    relativePath: adapter.packageOutput.sourceFile,
    sourcePath: absoluteWorkspacePath(`${packageRoot}/${adapter.packageOutput.sourceFile}`)
  };

  return "gzipHeaderVerified" in adapter.packageOutput.artifactProof
    ? writeGzipTarballArtifactProof(absolutePath, [entry])
    : writeZipArtifactProof(absolutePath, [entry]);
}

function writeManualProofFile(adapter: (typeof adapters)[number]): void {
  writeWorkspaceFile(`proof/${adapter.host}.txt`, `${adapter.hostApplication} loaded-host proof\n`);
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
