import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { classifySpecialProofWeakness } from "../lib/release-evidence-special-proof-classifier.ts";
import { writeIdeGameEngineLoadedHostReceipt } from "../write-ide-game-engine-loaded-host-receipts.ts";
import { writeIdeGameEngineSpecialProofReceipt } from "../write-ide-game-engine-special-proof-receipts.ts";
import { writeIntellijPlatformPackageOutputReceipt } from "../write-intellij-platform-package-output-receipt.ts";
import { writeUnityEditorPackageOutputReceipt } from "../write-unity-editor-package-output-receipt.ts";
import { writeUnrealEnginePackageOutputReceipt } from "../write-unreal-engine-package-output-receipt.ts";

const repoRoot = process.cwd();
const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-ide-game-special-proof-"));
const adapters = {
  intellij: {
    adapterId: "dx.intellij-platform.command-center",
    adapterRoot: join(repoRoot, "hosts", "jetbrains", "dx-intellij-platform"),
    commandIds: [
      "dx.intellij-platform.show_status",
      "dx.intellij-platform.search_assets",
      "dx.intellij-platform.show_receipts"
    ],
    host: "intellij-platform",
    hostApplication: "IntelliJ IDEA",
    hostToolId: "idea",
    manifestPath: "hosts/jetbrains/dx-intellij-platform/dx.extension.toml",
    packageCommand: "npm run package:intellij-platform:j1",
    packageOutputPathOption: "gradlePluginPackagePath",
    packageOutputArtifactName: "dx-intellij-platform-0.1.0.zip",
    receiptName: "plugin-verifier-latest.json",
    loadedHostReceiptName: "sandbox-ide-latest.json",
    requiredToolIds: ["idea", "gradle"],
    specialKind: "plugin_verifier",
    target: "intellij-platform",
    verificationMode: "sandbox-ide",
    writePackageOutputReceipt: writeIntellijPlatformPackageOutputReceipt
  },
  unity: {
    adapterId: "dx.unity-editor.command-center",
    adapterRoot: join(repoRoot, "hosts", "unity", "dx-unity-editor"),
    commandIds: [
      "dx.unity-editor.show_status",
      "dx.unity-editor.search_assets",
      "dx.unity-editor.show_receipts"
    ],
    host: "unity-editor",
    hostApplication: "Unity Editor",
    hostToolId: "unity-editor",
    manifestPath: "hosts/unity/dx-unity-editor/dx.extension.toml",
    packageCommand: "npm run package:unity-editor:j1",
    packageOutputPathOption: "upmTarballPath",
    packageOutputArtifactName: "dev.dx.unity-command-center-0.1.0.tgz",
    receiptName: "project-import-latest.json",
    loadedHostReceiptName: "loaded-host-latest.json",
    requiredToolIds: ["unity-editor"],
    specialKind: "project_import",
    target: "unity-editor",
    verificationMode: "loaded-editor",
    writePackageOutputReceipt: writeUnityEditorPackageOutputReceipt
  },
  unreal: {
    adapterId: "dx.unreal-engine.command-center",
    adapterRoot: join(repoRoot, "hosts", "unreal", "dx-unreal-engine"),
    commandIds: [
      "dx.unreal-engine.show_status",
      "dx.unreal-engine.search_assets",
      "dx.unreal-engine.show_receipts"
    ],
    host: "unreal-engine",
    hostApplication: "Unreal Editor",
    hostToolId: "unreal-editor",
    manifestPath: "hosts/unreal/dx-unreal-engine/dx.extension.toml",
    packageCommand: "npm run package:unreal-engine:j1",
    packageOutputPathOption: "packagedPluginPath",
    packageOutputArtifactName: "DXUnrealCommandCenter-0.1.0.zip",
    receiptName: "project-enablement-latest.json",
    loadedHostReceiptName: "loaded-host-latest.json",
    requiredToolIds: ["unreal-editor"],
    specialKind: "project_enablement",
    target: "unreal-engine",
    verificationMode: "loaded-editor",
    writePackageOutputReceipt: writeUnrealEnginePackageOutputReceipt
  }
} as const;

try {
  writeGateFixtures();

  const intellijPackageOutputReceiptPath = writePackageOutputReceipt(adapters.intellij);
  const intellijLoadedHostReceipt = writeLoadedHostReceipt(adapters.intellij, intellijPackageOutputReceiptPath);
  const intellijProofPath = writeWorkspaceFile(
    "proof/intellij-plugin-verifier-report.txt",
    "JetBrains Plugin Verifier passed without compatibility problems.\n"
  );
  const intellijReceipt = writeIdeGameEngineSpecialProofReceipt(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run smoke:ide-game-engine-special-proof:j1",
    proof: {
      target: "intellij-platform",
      packageOutputReceiptPath: intellijPackageOutputReceiptPath,
      loadedHostReceiptPath: intellijLoadedHostReceipt.receiptPath,
      proofFilePath: intellijProofPath,
      pluginVerifier: {
        toolVersion: "1.389",
        ideVersions: ["IC-2026.1", "IU-2026.1"],
        compatible: true,
        problems: [],
        warnings: ["The sandbox metadata-only command cannot contact DX local service in this proof."]
      }
    }
  });

  assert.equal(intellijReceipt.receipt, "dx.extension.ide_game_engine.plugin_verifier");
  assert.equal(intellijReceipt.adapterId, adapters.intellij.adapterId);
  assert.equal(intellijReceipt.host, adapters.intellij.host);
  assert.equal(intellijReceipt.proofKind, adapters.intellij.specialKind);
  assert.equal(intellijReceipt.generatedAt, "2026-06-07T00:00:00.000Z");
  assert.equal(intellijReceipt.verificationCommand, "npm run smoke:ide-game-engine-special-proof:j1");
  assert.equal(
    intellijReceipt.receiptPath,
    join(workspaceRoot, ".dx", "receipts", "extensions", adapters.intellij.adapterId, adapters.intellij.receiptName)
  );
  assert.equal(intellijReceipt.packageOutput.receiptPath, intellijPackageOutputReceiptPath);
  assert.equal(intellijReceipt.packageOutput.receiptSha256, sha256(readFileSync(intellijPackageOutputReceiptPath)));
  assert.equal(intellijReceipt.packageOutput.packageSha256.length, 64);
  assert.equal(intellijReceipt.loadedHostReceiptPath, intellijLoadedHostReceipt.receiptPath);
  assert.equal(intellijReceipt.loadedHostReceiptSha256, sha256(readFileSync(intellijLoadedHostReceipt.receiptPath)));
  assert.equal(intellijReceipt.manualProof.proofFilePath, intellijProofPath);
  assert.equal(intellijReceipt.manualProof.proofFileSha256, sha256(readFileSync(intellijProofPath)));
  assert.equal(intellijReceipt.pluginVerifier.toolName, "JetBrains Plugin Verifier");
  assert.deepEqual(intellijReceipt.pluginVerifier.ideVersions, ["IC-2026.1", "IU-2026.1"]);
  assert.deepEqual(intellijReceipt.pluginVerifier.problems, []);
  assert.equal(intellijReceipt.pluginVerifier.compatible, true);
  assert.equal(intellijReceipt.releaseClaims.packageOutputVerified, true);
  assert.equal(intellijReceipt.releaseClaims.loadedHostVerified, true);
  assert.equal(intellijReceipt.releaseClaims.pluginVerifierVerified, true);
  assert.equal(intellijReceipt.releaseClaims.projectImportVerified, false);
  assert.equal(intellijReceipt.releaseClaims.projectEnablementVerified, false);
  assert.equal(existsSync(intellijReceipt.receiptPath), true);
  assert.deepEqual(JSON.parse(readFileSync(intellijReceipt.receiptPath, "utf8")), intellijReceipt);
  assert.equal(classifySpecialProofWeakness(adapters.intellij.specialKind, intellijReceipt), undefined);
  assert.match(
    classifySpecialProofWeakness(adapters.intellij.specialKind, {
      ...intellijReceipt,
      pluginVerifier: {
        ...intellijReceipt.pluginVerifier,
        problems: ["Plugin cannot be loaded in target IDE."]
      }
    }) ?? "",
    /Plugin Verifier receipt contains compatibility problems/
  );

  const unityPackageOutputReceiptPath = writePackageOutputReceipt(adapters.unity);
  const unityLoadedHostReceipt = writeLoadedHostReceipt(adapters.unity, unityPackageOutputReceiptPath);
  const unityProofPath = writeWorkspaceFile(
    "proof/unity-project-import-report.txt",
    "Unity imported the package into an empty test project and compiled editor assemblies.\n"
  );
  const unityReceipt = writeIdeGameEngineSpecialProofReceipt(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run smoke:ide-game-engine-special-proof:j1",
    proof: {
      target: "unity-editor",
      packageOutputReceiptPath: unityPackageOutputReceiptPath,
      loadedHostReceiptPath: unityLoadedHostReceipt.receiptPath,
      proofFilePath: unityProofPath,
      projectImport: {
        unityVersion: "2026.1.0f1",
        packageName: "dev.dx.unity-command-center",
        packageVersion: "0.1.0",
        testProjectKind: "empty-project",
        imported: true,
        compileStatus: "passed",
        editorTestsStatus: "passed",
        assetDatabaseRefreshed: true,
        mutatesProjectAssets: false
      }
    }
  });

  assert.equal(unityReceipt.receipt, "dx.extension.ide_game_engine.project_import");
  assert.equal(unityReceipt.adapterId, adapters.unity.adapterId);
  assert.equal(unityReceipt.host, adapters.unity.host);
  assert.equal(unityReceipt.proofKind, adapters.unity.specialKind);
  assert.equal(unityReceipt.projectImport.compileStatus, "passed");
  assert.equal(unityReceipt.projectImport.editorTestsStatus, "passed");
  assert.equal(unityReceipt.projectImport.mutatesProjectAssets, false);
  assert.equal(unityReceipt.releaseClaims.packageOutputVerified, true);
  assert.equal(unityReceipt.releaseClaims.loadedHostVerified, true);
  assert.equal(unityReceipt.releaseClaims.pluginVerifierVerified, false);
  assert.equal(unityReceipt.releaseClaims.projectImportVerified, true);
  assert.equal(unityReceipt.releaseClaims.projectEnablementVerified, false);
  assert.deepEqual(JSON.parse(readFileSync(unityReceipt.receiptPath, "utf8")), unityReceipt);
  assert.equal(classifySpecialProofWeakness(adapters.unity.specialKind, unityReceipt), undefined);
  assert.match(
    classifySpecialProofWeakness(adapters.unity.specialKind, {
      ...unityReceipt,
      projectImport: {
        ...unityReceipt.projectImport,
        imported: false
      }
    }) ?? "",
    /project import receipt is missing Unity import pass proof/
  );

  const unrealPackageOutputReceiptPath = writePackageOutputReceipt(adapters.unreal);
  const unrealLoadedHostReceipt = writeLoadedHostReceipt(adapters.unreal, unrealPackageOutputReceiptPath);
  const unrealProofPath = writeWorkspaceFile(
    "proof/unreal-project-enablement-report.txt",
    "Unreal sample project enabled the editor plugin and loaded the module.\n"
  );
  const unrealReceipt = writeIdeGameEngineSpecialProofReceipt(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run smoke:ide-game-engine-special-proof:j1",
    proof: {
      target: "unreal-engine",
      packageOutputReceiptPath: unrealPackageOutputReceiptPath,
      loadedHostReceiptPath: unrealLoadedHostReceipt.receiptPath,
      proofFilePath: unrealProofPath,
      projectEnablement: {
        engineVersion: "5.6.0",
        pluginModuleName: "DXUnrealCommandCenterEditor",
        testProjectKind: "empty-sample-project",
        pluginEnabled: true,
        editorModuleLoaded: true,
        automationTestsStatus: "passed",
        mutatesProjectContent: false
      }
    }
  });

  assert.equal(unrealReceipt.receipt, "dx.extension.ide_game_engine.project_enablement");
  assert.equal(unrealReceipt.adapterId, adapters.unreal.adapterId);
  assert.equal(unrealReceipt.host, adapters.unreal.host);
  assert.equal(unrealReceipt.proofKind, adapters.unreal.specialKind);
  assert.equal(unrealReceipt.projectEnablement.pluginEnabled, true);
  assert.equal(unrealReceipt.projectEnablement.editorModuleLoaded, true);
  assert.equal(unrealReceipt.projectEnablement.mutatesProjectContent, false);
  assert.equal(unrealReceipt.releaseClaims.packageOutputVerified, true);
  assert.equal(unrealReceipt.releaseClaims.loadedHostVerified, true);
  assert.equal(unrealReceipt.releaseClaims.pluginVerifierVerified, false);
  assert.equal(unrealReceipt.releaseClaims.projectImportVerified, false);
  assert.equal(unrealReceipt.releaseClaims.projectEnablementVerified, true);
  assert.deepEqual(JSON.parse(readFileSync(unrealReceipt.receiptPath, "utf8")), unrealReceipt);
  assert.equal(classifySpecialProofWeakness(adapters.unreal.specialKind, unrealReceipt), undefined);
  assert.match(
    classifySpecialProofWeakness(adapters.unreal.specialKind, {
      ...unrealReceipt,
      projectEnablement: {
        ...unrealReceipt.projectEnablement,
        pluginEnabled: false
      }
    }) ?? "",
    /project enablement receipt does not enable the Unreal plugin/
  );

  assert.throws(
    () =>
      writeIdeGameEngineSpecialProofReceipt(workspaceRoot, {
        proof: {
          target: "intellij-platform",
          packageOutputReceiptPath: intellijPackageOutputReceiptPath,
          loadedHostReceiptPath: intellijLoadedHostReceipt.receiptPath,
          proofFilePath: intellijProofPath,
          pluginVerifier: {
            toolVersion: "1.389",
            ideVersions: ["IC-2026.1"],
            compatible: true,
            problems: ["Plugin cannot be loaded in target IDE."],
            warnings: []
          }
        }
      }),
    /must have zero Plugin Verifier problems/
  );

  assert.throws(
    () =>
      writeIdeGameEngineSpecialProofReceipt(workspaceRoot, {
        proof: {
          target: "unity-editor",
          packageOutputReceiptPath: unityPackageOutputReceiptPath,
          loadedHostReceiptPath: unityLoadedHostReceipt.receiptPath,
          proofFilePath: unityProofPath,
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
          }
        }
      }),
    /must not mutate test project assets/
  );

  assert.throws(
    () =>
      writeIdeGameEngineSpecialProofReceipt(workspaceRoot, {
        proof: {
          target: "unreal-engine",
          packageOutputReceiptPath: unrealPackageOutputReceiptPath,
          loadedHostReceiptPath: unrealLoadedHostReceipt.receiptPath,
          proofFilePath: unrealProofPath,
          projectEnablement: {
            engineVersion: "5.6.0",
            pluginModuleName: "DXUnrealCommandCenterEditor",
            testProjectKind: "empty-sample-project",
            pluginEnabled: false,
            editorModuleLoaded: true,
            automationTestsStatus: "passed",
            mutatesProjectContent: false
          }
        }
      }),
    /must enable the Unreal plugin/
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("IDE and game-engine special proof receipts verified");

function writeGateFixtures(): void {
  writeWorkspaceFile(
    "registry/official-extensions.toml",
    `
schema = "dx.extensions.registry"
manifest_version = 1

[[extensions]]
id = "dx.intellij-platform.command-center"
name = "dx.intellij-platform.command-center"
path = "hosts/jetbrains/dx-intellij-platform"
manifest = "${adapters.intellij.manifestPath}"
status = "experimental"
professional_targets = ["intellij-platform"]

[[extensions]]
id = "dx.unity-editor.command-center"
name = "dx.unity-editor.command-center"
path = "hosts/unity/dx-unity-editor"
manifest = "${adapters.unity.manifestPath}"
status = "experimental"
professional_targets = ["unity-editor"]

[[extensions]]
id = "dx.unreal-engine.command-center"
name = "dx.unreal-engine.command-center"
path = "hosts/unreal/dx-unreal-engine"
manifest = "${adapters.unreal.manifestPath}"
status = "experimental"
professional_targets = ["unreal-engine"]
`
  );

  for (const adapter of Object.values(adapters)) {
    writeWorkspaceFile(
      adapter.manifestPath,
      `
[extension]
id = "${adapter.adapterId}"

[[capabilities]]
id = "local_service.connect"
`
    );
  }

  writeWorkspaceFile(
    "registry/release-evidence-gates.toml",
    `
schema = "dx.release_evidence_gates"
manifest_version = 1

${Object.values(adapters)
  .map(
    (adapter) => `
[[extensions]]
id = "${adapter.adapterId}"
stage = "not-release-ready"
required_evidence = ["host_execution", "package_output", "signing", "checksum", "distribution_review", "${adapter.specialKind}", "local_service"]
evidence_receipt_requirements = ["host_execution=.dx/receipts/extensions/${adapter.adapterId}/loaded-host-latest.json", "package_output=.dx/receipts/extensions/${adapter.adapterId}/package-output-latest.json", "${adapter.specialKind}=.dx/receipts/extensions/${adapter.adapterId}/${adapter.receiptName}", "local_service=.dx/receipts/extensions/${adapter.adapterId}/local-service-latest.json", "signing=.dx/receipts/extensions/${adapter.adapterId}/signing-latest.json", "checksum=.dx/receipts/extensions/${adapter.adapterId}/checksum-latest.json", "distribution_review=.dx/receipts/extensions/${adapter.adapterId}/distribution-latest.json"]
evidence_receipts = [".dx/receipts/extensions/${adapter.adapterId}/loaded-host-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/package-output-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/${adapter.receiptName}", ".dx/receipts/extensions/${adapter.adapterId}/local-service-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/signing-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/checksum-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/distribution-latest.json"]
next_release_proof = "Run ${adapter.specialKind} proof"
blocked_by = ["host proof"]
`
  )
  .join("\n")}
`
  );
}

function writePackageOutputReceipt(adapter: (typeof adapters)[keyof typeof adapters]): string {
  const receiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    adapter.adapterId,
    "package-output-latest.json"
  );

  adapter.writePackageOutputReceipt({
    adapterRoot: adapter.adapterRoot,
    packageRoot: adapter.adapterRoot,
    receiptPath,
    [adapter.packageOutputPathOption]: join(
      workspaceRoot,
      "artifacts",
      adapter.host,
      adapter.packageOutputArtifactName
    ),
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: adapter.packageCommand
  });

  return receiptPath;
}

function writeLoadedHostReceipt(
  adapter: (typeof adapters)[keyof typeof adapters],
  packageOutputReceiptPath: string
) {
  const proofFilePath = writeWorkspaceFile(
    `proof/${adapter.target}-loaded-host-report.txt`,
    `${adapter.hostApplication} loaded-host command proof.\n`
  );
  const hostExecutablePath = writeWorkspaceFile(`tools/${adapter.target}.exe`, `${adapter.hostApplication}\n`);

  writeHostDiscoveryReceipt(adapter, hostExecutablePath);

  return writeIdeGameEngineLoadedHostReceipt(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run smoke:ide-game-engine-loaded-host:j1",
    proof: {
      target: adapter.target,
      hostApplication: adapter.hostApplication,
      hostVersion: "2026.1.0",
      hostExecutablePath,
      packageOutputReceiptPath,
      proofFilePath,
      verificationMode: adapter.verificationMode,
      loadedHostVerified: true,
      extensionInstalled: true,
      commandIdsVisible: adapter.commandIds,
      commandResults: adapter.commandIds.map(commandResultFor),
      localServiceRequestsBlocked: true,
      projectState: "loaded"
    }
  });
}

function writeHostDiscoveryReceipt(
  adapter: (typeof adapters)[keyof typeof adapters],
  hostExecutablePath: string
): void {
  const receiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    adapter.adapterId,
    "host-discovery-latest.json"
  );
  const tools = adapter.requiredToolIds.map((toolId) => ({
    id: toolId,
    label: `${adapter.hostApplication} ${toolId}`,
    required: true,
    found: true,
    path: toolId === adapter.hostToolId ? hostExecutablePath : requiredToolPath(adapter, toolId),
    candidatesChecked: 1
  }));

  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(
    receiptPath,
    `${JSON.stringify(
      {
        receipt: "dx.extension.platform_host_discovery",
        adapterId: adapter.adapterId,
        discoveryMode: "local-tooling",
        host: adapter.host,
        generatedAt: "2026-06-07T00:00:00.000Z",
        verificationCommand: "npm run preflight:platform-host-discovery:j1",
        receiptPath,
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
      },
      null,
      2
    )}\n`
  );
}

function writeWorkspaceFile(relativePath: string, source: string): string {
  const absolutePath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);
  return absolutePath;
}

function requiredToolPath(adapter: (typeof adapters)[keyof typeof adapters], toolId: string): string {
  return writeWorkspaceFile(`tools/${adapter.target}-${toolId}.tool`, `${adapter.hostApplication} ${toolId}\n`);
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

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
