import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { writeIdeGameEngineLoadedHostReceipt } from "../write-ide-game-engine-loaded-host-receipts.ts";
import { writeIntellijPlatformPackageOutputReceipt } from "../write-intellij-platform-package-output-receipt.ts";
import { writeUnityEditorPackageOutputReceipt } from "../write-unity-editor-package-output-receipt.ts";
import { writeUnrealEnginePackageOutputReceipt } from "../write-unreal-engine-package-output-receipt.ts";
import { writeVisualStudioPackageOutputReceipt } from "../write-visual-studio-package-output-receipt.ts";

const repoRoot = process.cwd();
const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-ide-game-loaded-host-"));
const adapters = [
  {
    adapterId: "dx.intellij-platform.command-center",
    adapterRoot: join(repoRoot, "hosts", "jetbrains", "dx-intellij-platform"),
    commandIds: [
      "dx.intellij-platform.show_status",
      "dx.intellij-platform.search_assets",
      "dx.intellij-platform.show_receipts"
    ],
    host: "intellij-platform",
    hostApplication: "IntelliJ IDEA",
    packageCommand: "npm run package:intellij-platform:j1",
    packageOutputPathOption: "gradlePluginPackagePath",
    packageOutputArtifactName: "dx-intellij-platform-0.1.0.zip",
    receiptName: "sandbox-ide-latest.json",
    target: "intellij-platform",
    hostToolId: "idea",
    requiredToolIds: ["idea", "gradle"],
    verificationMode: "sandbox-ide",
    writePackageOutputReceipt: writeIntellijPlatformPackageOutputReceipt
  },
  {
    adapterId: "dx.visual-studio.command-center",
    adapterRoot: join(repoRoot, "hosts", "visual-studio", "dx-visual-studio"),
    commandIds: [
      "dx.visual-studio.show_status",
      "dx.visual-studio.search_assets",
      "dx.visual-studio.show_receipts"
    ],
    host: "visual-studio",
    hostApplication: "Visual Studio",
    packageCommand: "npm run package:visual-studio:j1",
    packageOutputPathOption: "vsixPath",
    packageOutputArtifactName: "dx-visual-studio-0.1.0.vsix",
    receiptName: "experimental-instance-latest.json",
    target: "visual-studio",
    hostToolId: "devenv",
    requiredToolIds: ["devenv", "msbuild", "dotnet", "vssdk-targets"],
    verificationMode: "experimental-instance",
    writePackageOutputReceipt: writeVisualStudioPackageOutputReceipt
  },
  {
    adapterId: "dx.unity-editor.command-center",
    adapterRoot: join(repoRoot, "hosts", "unity", "dx-unity-editor"),
    commandIds: [
      "dx.unity-editor.show_status",
      "dx.unity-editor.search_assets",
      "dx.unity-editor.show_receipts"
    ],
    host: "unity-editor",
    hostApplication: "Unity Editor",
    packageCommand: "npm run package:unity-editor:j1",
    packageOutputPathOption: "upmTarballPath",
    packageOutputArtifactName: "dev.dx.unity-command-center-0.1.0.tgz",
    receiptName: "loaded-host-latest.json",
    target: "unity-editor",
    hostToolId: "unity-editor",
    requiredToolIds: ["unity-editor"],
    verificationMode: "loaded-editor",
    writePackageOutputReceipt: writeUnityEditorPackageOutputReceipt
  },
  {
    adapterId: "dx.unreal-engine.command-center",
    adapterRoot: join(repoRoot, "hosts", "unreal", "dx-unreal-engine"),
    commandIds: [
      "dx.unreal-engine.show_status",
      "dx.unreal-engine.search_assets",
      "dx.unreal-engine.show_receipts"
    ],
    host: "unreal-engine",
    hostApplication: "Unreal Editor",
    packageCommand: "npm run package:unreal-engine:j1",
    packageOutputPathOption: "packagedPluginPath",
    packageOutputArtifactName: "DXUnrealCommandCenter-0.1.0.zip",
    receiptName: "loaded-host-latest.json",
    target: "unreal-engine",
    hostToolId: "unreal-editor",
    requiredToolIds: ["unreal-editor"],
    verificationMode: "loaded-editor",
    writePackageOutputReceipt: writeUnrealEnginePackageOutputReceipt
  }
] as const;

try {
  for (const adapter of adapters) {
    const packageOutputReceiptPath = writePackageOutputReceipt(adapter);
    const proofFilePath = writeWorkspaceFile(
      `proof/${adapter.target}-loaded-host.txt`,
      `${adapter.hostApplication} command-center metadata-only loaded-host smoke.\n`
    );
    const hostExecutablePath = writeWorkspaceFile(`tools/${adapter.target}.exe`, `${adapter.hostApplication}\n`);
    const hostDiscoveryReceiptPath = writeHostDiscoveryReceipt(adapter, hostExecutablePath);
    const receipt = writeIdeGameEngineLoadedHostReceipt(workspaceRoot, {
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

    assert.equal(receipt.receipt, "dx.extension.ide_game_engine.loaded_host");
    assert.equal(receipt.adapterId, adapter.adapterId);
    assert.equal(receipt.host, adapter.host);
    assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
    assert.equal(receipt.verificationCommand, "npm run smoke:ide-game-engine-loaded-host:j1");
    assert.equal(
      receipt.receiptPath,
      join(workspaceRoot, ".dx", "receipts", "extensions", adapter.adapterId, adapter.receiptName)
    );
    assert.equal(receipt.hostApplication.name, adapter.hostApplication);
    assert.equal(receipt.hostApplication.version, "2026.1.0");
    assert.equal(receipt.hostApplication.executablePath, hostExecutablePath);
    assert.equal(receipt.hostApplication.verificationMode, adapter.verificationMode);
    assert.equal(receipt.hostDiscovery.receiptPath, hostDiscoveryReceiptPath);
    assert.equal(receipt.hostDiscovery.receiptSha256, sha256(readFileSync(hostDiscoveryReceiptPath)));
    assert.equal(receipt.hostDiscovery.toolId, adapter.hostToolId);
    assert.equal(receipt.hostDiscovery.toolPath, hostExecutablePath);
    assert.equal(receipt.hostDiscovery.executableSha256, sha256(readFileSync(hostExecutablePath)));
    assert.deepEqual(
      receipt.hostDiscovery.requiredTools?.map((tool) => tool.id) ?? [],
      adapter.requiredToolIds
    );
    assert.equal(receipt.packageOutput.receiptPath, packageOutputReceiptPath);
    assert.equal(receipt.packageOutput.receiptSha256, sha256(readFileSync(packageOutputReceiptPath)));
    assert.equal(receipt.loadedHost.extensionInstalled, true);
    assert.deepEqual(receipt.loadedHost.commandIdsVisible, [...adapter.commandIds].sort());
    assert.equal(receipt.loadedHost.commandResults.length, 3);
    const statusCommandId = adapter.commandIds.find((commandId) => commandId.endsWith("show_status"));
    assert.ok(statusCommandId);
    assert.deepEqual(
      receipt.loadedHost.commandResults.find((result) => result.commandId.endsWith("show_status")),
      {
        commandId: statusCommandId,
        operation: "dx.status",
        transport: "local-service",
        status: "proof-blocked"
      }
    );
    assert.equal(receipt.loadedHost.localServiceRequestsBlocked, true);
    assert.equal(receipt.manualProof.proofFilePath, proofFilePath);
    assert.equal(receipt.manualProof.proofFileSha256, sha256(readFileSync(proofFilePath)));
    assert.equal(receipt.releaseClaims.loadedHostVerified, true);
    assert.equal(receipt.releaseClaims.localServiceVerified, false);
    assert.equal(receipt.releaseClaims.signingVerified, false);
    assert.equal(receipt.releaseClaims.distributionVerified, false);
    assert.equal(existsSync(receipt.receiptPath), true);
    assert.deepEqual(JSON.parse(readFileSync(receipt.receiptPath, "utf8")), receipt);
  }

  const fixture = loadedHostFixture("unity-editor");

  assert.throws(
    () =>
      writeIdeGameEngineLoadedHostReceipt(workspaceRoot, {
        proof: {
          ...fixture,
          loadedHostVerified: false
        }
      }),
    /must verify a real loaded host/
  );

  assert.throws(
    () =>
      writeIdeGameEngineLoadedHostReceipt(workspaceRoot, {
        proof: {
          ...fixture,
          projectName: "Customer Game"
        }
      }),
    /privacy-sensitive IDE\/game-engine loaded-host proof field/
  );

  assert.throws(
    () =>
      writeIdeGameEngineLoadedHostReceipt(workspaceRoot, {
        proof: {
          ...fixture,
          commandIdsVisible: ["dx.unity-editor.show_status"]
        }
      }),
    /must include visible command metadata/
  );

  assert.throws(
    () =>
      writeIdeGameEngineLoadedHostReceipt(workspaceRoot, {
        proof: {
          ...fixture,
          commandResults: fixture.commandResults.map((result) =>
            result.commandId.endsWith("show_status")
              ? { ...result, operation: "receipt.showPath", transport: "host-ui" }
              : result
          )
        }
      }),
    /must map command result dx\.unity-editor\.show_status/
  );

  assert.throws(
    () =>
      writeIdeGameEngineLoadedHostReceipt(workspaceRoot, {
        proof: {
          ...fixture,
          projectState: "empty"
        }
      }),
    /must verify a loaded project state/
  );

  writeHostDiscoveryReceipt(adapters[2], writeWorkspaceFile("tools/other-unity.exe", "wrong host\n"));
  assert.throws(
    () =>
      writeIdeGameEngineLoadedHostReceipt(workspaceRoot, {
        proof: fixture
      }),
    /host-discovery/
  );

  const visualStudioFixture = loadedHostFixture("visual-studio");
  writeHostDiscoveryReceipt(adapters[1], visualStudioFixture.hostExecutablePath, {
    omitRequiredToolIds: ["msbuild"]
  });
  assert.throws(
    () =>
      writeIdeGameEngineLoadedHostReceipt(workspaceRoot, {
        proof: visualStudioFixture
      }),
    /missing required host-discovery tool: msbuild/
  );

  writeHostDiscoveryReceipt(adapters[1], visualStudioFixture.hostExecutablePath, {
    missingRequiredTools: ["vssdk-targets"]
  });
  assert.throws(
    () =>
      writeIdeGameEngineLoadedHostReceipt(workspaceRoot, {
        proof: visualStudioFixture
      }),
    /host-discovery receipt contradicts missing required tools/
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("IDE and game-engine loaded-host receipts verified");

function loadedHostFixture(target: (typeof adapters)[number]["target"]) {
  const adapter = adapters.find((candidate) => candidate.target === target);

  assert.ok(adapter);

  const packageOutputReceiptPath = writePackageOutputReceipt(adapter);
  const proofFilePath = writeWorkspaceFile(`proof/${target}-fixture.txt`, "fixture proof\n");
  const hostExecutablePath = writeWorkspaceFile(`tools/${target}-fixture.exe`, "host executable\n");
  writeHostDiscoveryReceipt(adapter, hostExecutablePath);

  return {
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
  };
}

function writePackageOutputReceipt(adapter: (typeof adapters)[number]): string {
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
      adapter.target,
      adapter.packageOutputArtifactName
    ),
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: adapter.packageCommand
  });

  return receiptPath;
}

function writeHostDiscoveryReceipt(
  adapter: (typeof adapters)[number],
  hostExecutablePath: string,
  options: { missingRequiredTools?: string[]; omitRequiredToolIds?: string[] } = {}
): string {
  const receiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    adapter.adapterId,
    "host-discovery-latest.json"
  );

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
        missingRequiredTools: options.missingRequiredTools ?? [],
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

  return receiptPath;
}

function writeWorkspaceFile(relativePath: string, source: string): string {
  const absolutePath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);
  return absolutePath;
}

function requiredToolPath(adapter: (typeof adapters)[number], toolId: string): string {
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
