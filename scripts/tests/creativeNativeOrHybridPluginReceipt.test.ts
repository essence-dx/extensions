import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { classifySpecialProofWeakness } from "../lib/release-evidence-special-proof-classifier.ts";
import { buildAdobeUxpPackage } from "../build-adobe-uxp-package.ts";
import { writeAdobeUxpPackageOutputReceipt } from "../write-adobe-uxp-package-output-receipts.ts";
import { writeCreativeLoadedHostReceipt } from "../write-creative-loaded-host-receipts.ts";
import { writeCreativeNativeOrHybridPluginReceipt } from "../write-creative-native-or-hybrid-plugin-receipts.ts";
import {
  type CreativeNativePluginFixtureAdapter,
  creativeNativePluginAdapters,
  sha256,
  writeCreativeNativePluginReleaseGateFixtures,
  writeWorkspaceFile
} from "./creativeNativeOrHybridPluginFixtures.ts";

const repoRoot = process.cwd();
const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-creative-native-plugin-"));

try {
  writeCreativeNativePluginReleaseGateFixtures(workspaceRoot);

  for (const adapter of creativeNativePluginAdapters) {
    const packageOutputReceiptPath = await writeAdobePackageOutputReceipt(adapter);
    const loadedHostReceipt = writeLoadedHostReceipt(adapter, packageOutputReceiptPath);
    const nativePluginArtifactPath = writeWorkspaceFile(
      workspaceRoot,
      `native/${adapter.host}/${adapter.nativeArtifactName}`,
      `${adapter.adapterId} metadata bridge plugin\n`
    );
    const manualProofPath = writeWorkspaceFile(
      workspaceRoot,
      `proof/${adapter.host}-native-plugin.txt`,
      `${adapter.hostApplication} native plugin loaded from host extension manager.\n`
    );
    const receipt = writeCreativeNativeOrHybridPluginReceipt(workspaceRoot, {
      generatedAt: "2026-06-07T00:00:00.000Z",
      verificationCommand: "npm run smoke:creative-native-or-hybrid-plugin:j1",
      proof: {
        adapterId: adapter.adapterId,
        host: adapter.host,
        loadedHostReceiptPath: loadedHostReceipt.receiptPath,
        packageOutputReceiptPath,
        proofFilePath: manualProofPath,
        nativePluginArtifactPath,
        pluginKind: "host-native-plugin",
        sdkName: adapter.sdkName,
        sdkVersion: "2026.1",
        bridgeMode: "metadata-command-bridge",
        loadedByHost: true,
        commandIdsVerified: adapter.commandIds,
        metadataOnly: true,
        storesHostPayloads: false,
        mutatesHostProject: false,
        mutatesHostDocument: false
      }
    });

    assert.equal(receipt.receipt, "dx.extension.creative.native_or_hybrid_plugin");
    assert.equal(receipt.adapterId, adapter.adapterId);
    assert.equal(receipt.host, adapter.host);
    assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
    assert.equal(receipt.verificationCommand, "npm run smoke:creative-native-or-hybrid-plugin:j1");
    assert.equal(
      receipt.receiptPath,
      join(workspaceRoot, ".dx", "receipts", "extensions", adapter.adapterId, "native-plugin-latest.json")
    );
    assert.equal(receipt.loadedHostReceiptPath, loadedHostReceipt.receiptPath);
    assert.equal(receipt.loadedHostReceiptSha256, sha256(readFileSync(loadedHostReceipt.receiptPath)));
    assert.equal(receipt.packageOutput.receiptPath, packageOutputReceiptPath);
    assert.equal(receipt.packageOutput.receiptSha256, sha256(readFileSync(packageOutputReceiptPath)));
    assert.equal(receipt.nativePlugin.fileName, adapter.nativeArtifactName);
    assert.equal(receipt.nativePlugin.bytes, Buffer.byteLength(`${adapter.adapterId} metadata bridge plugin\n`));
    assert.equal(receipt.nativePlugin.sha256, sha256(readFileSync(nativePluginArtifactPath)));
    assert.equal(receipt.nativePlugin.sdkName, adapter.sdkName);
    assert.equal(receipt.nativePlugin.loadedByHost, true);
    assert.equal(receipt.nativePlugin.metadataOnly, true);
    assert.equal(receipt.nativePlugin.storesHostPayloads, false);
    assert.equal(receipt.nativePlugin.mutatesHostProject, false);
    assert.equal(receipt.nativePlugin.mutatesHostDocument, false);
    assert.deepEqual(receipt.nativePlugin.commandIdsVerified, [...adapter.commandIds].sort());
    assert.equal(receipt.manualProof.proofFilePath, manualProofPath);
    assert.equal(receipt.manualProof.proofFileSha256, sha256(readFileSync(manualProofPath)));
    assert.equal(receipt.releaseClaims.loadedHostVerified, true);
    assert.equal(receipt.releaseClaims.packageOutputVerified, true);
    assert.equal(receipt.releaseClaims.nativeOrHybridPluginVerified, true);
    assert.equal(receipt.releaseClaims.localServiceVerified, false);
    assert.equal(receipt.releaseClaims.distributionVerified, false);
    assert.equal(classifySpecialProofWeakness("native_or_hybrid_plugin", receipt), undefined);
    assert.match(
      classifySpecialProofWeakness("native_or_hybrid_plugin", {
        ...receipt,
        nativePlugin: {
          ...receipt.nativePlugin,
          sdkName: "Wrong SDK"
        }
      }) ?? "",
      /expected native plugin proof/
    );
    assert.match(
      classifySpecialProofWeakness("native_or_hybrid_plugin", {
        ...receipt,
        nativePlugin: {
          ...receipt.nativePlugin,
          commandIdsVerified: ["dx.fake.command"]
        }
      }) ?? "",
      /expected native plugin proof/
    );
    writeFileSync(nativePluginArtifactPath, `${adapter.adapterId} changed metadata bridge plugin\n`);
    assert.match(
      classifySpecialProofWeakness("native_or_hybrid_plugin", receipt) ?? "",
      /native-or-hybrid plugin native artifact file size changed|native-or-hybrid plugin native artifact file hash changed/
    );

    writeFileSync(nativePluginArtifactPath, `${adapter.adapterId} metadata bridge plugin\n`);
    writeFileSync(manualProofPath, `${adapter.hostApplication} changed native plugin proof.\n`);
    assert.match(
      classifySpecialProofWeakness("native_or_hybrid_plugin", receipt) ?? "",
      /native-or-hybrid plugin manual proof file hash changed/
    );

    writeFileSync(
      manualProofPath,
      `${adapter.hostApplication} native plugin loaded from host extension manager.\n`
    );
    const packageOutputReceiptSource = readFileSync(packageOutputReceiptPath, "utf8");
    writeFileSync(packageOutputReceiptPath, "{}\n");
    assert.match(
      classifySpecialProofWeakness("native_or_hybrid_plugin", receipt) ?? "",
      /native-or-hybrid plugin linked package-output receipt hash changed/
    );

    writeFileSync(packageOutputReceiptPath, packageOutputReceiptSource);
    const loadedHostReceiptSource = readFileSync(receipt.loadedHostReceiptPath, "utf8");
    writeFileSync(receipt.loadedHostReceiptPath, "{}\n");
    assert.match(
      classifySpecialProofWeakness("native_or_hybrid_plugin", receipt) ?? "",
      /native-or-hybrid plugin loaded-host receipt hash changed/
    );

    writeFileSync(receipt.loadedHostReceiptPath, loadedHostReceiptSource);
    const weakLoadedHostReceipt = JSON.parse(loadedHostReceiptSource);
    weakLoadedHostReceipt.loadedHost.commandIdsVisible = [adapter.commandIds[0]];
    const weakLoadedHostReceiptSource = `${JSON.stringify(weakLoadedHostReceipt, null, 2)}\n`;
    writeFileSync(receipt.loadedHostReceiptPath, weakLoadedHostReceiptSource);
    assert.match(
      classifySpecialProofWeakness("native_or_hybrid_plugin", {
        ...receipt,
        loadedHostReceiptSha256: sha256(weakLoadedHostReceiptSource)
      }) ?? "",
      /native-or-hybrid plugin linked loaded-host receipt is weak: creative loaded-host receipt is missing expected command IDs/
    );

    writeFileSync(receipt.loadedHostReceiptPath, loadedHostReceiptSource);
    assert.equal(existsSync(receipt.receiptPath), true);
    assert.deepEqual(JSON.parse(readFileSync(receipt.receiptPath, "utf8")), receipt);
  }

  const fixtureAdapter = creativeNativePluginAdapters[0];
  const packageOutputReceiptPath = await writeAdobePackageOutputReceipt(fixtureAdapter);
  const loadedHostReceipt = writeLoadedHostReceipt(fixtureAdapter, packageOutputReceiptPath);
  const nativePluginArtifactPath = writeWorkspaceFile(
    workspaceRoot,
    "native/fixture/DxPremiereCommandCenter.prm",
    "plugin\n"
  );
  const proofFilePath = writeWorkspaceFile(workspaceRoot, "proof/fixture-native-plugin.txt", "fixture proof\n");
  const fixture = nativePluginFixture(
    fixtureAdapter,
    loadedHostReceipt.receiptPath,
    packageOutputReceiptPath,
    proofFilePath,
    nativePluginArtifactPath
  );

  assert.throws(
    () =>
      writeCreativeNativeOrHybridPluginReceipt(workspaceRoot, {
        proof: {
          ...fixture,
          loadedByHost: false
        }
      }),
    /must verify the native or hybrid plugin is loaded by the host/
  );

  assert.throws(
    () =>
      writeCreativeNativeOrHybridPluginReceipt(workspaceRoot, {
        proof: {
          ...fixture,
          projectName: "Customer Sequence"
        }
      }),
    /privacy-sensitive creative native\/hybrid proof field/
  );

  assert.throws(
    () =>
      writeCreativeNativeOrHybridPluginReceipt(workspaceRoot, {
        proof: {
          ...fixture,
          commandIdsVerified: ["dx.premiere-pro.show_status"]
        }
      }),
    /must include verified command metadata/
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("Creative native/hybrid plugin receipts verified");

async function writeAdobePackageOutputReceipt(adapter: CreativeNativePluginFixtureAdapter): Promise<string> {
  const adapterRoot = join(repoRoot, "hosts", "adobe", adapter.folder);
  const buildResult = await buildAdobeUxpPackage({
    adapterRoot,
    outputRoot: join(workspaceRoot, "dist", adapter.host)
  });
  const receiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    adapter.adapterId,
    "package-output-latest.json"
  );

  writeAdobeUxpPackageOutputReceipt({
    adapterId: adapter.adapterId,
    host: adapter.host,
    adapterRoot,
    packageRoot: buildResult.packageRoot,
    receiptPath,
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run build:adobe-uxp:j1"
  });

  return receiptPath;
}

function writeLoadedHostReceipt(adapter: CreativeNativePluginFixtureAdapter, packageOutputReceiptPath: string) {
  return writeCreativeLoadedHostReceipt(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run smoke:creative-loaded-host:j1",
    proof: {
      target: adapter.host,
      hostApplication: adapter.hostApplication,
      hostVersion: "2026.1.0",
      hostExecutablePath: writeWorkspaceFile(workspaceRoot, `tools/${adapter.host}.exe`, `${adapter.hostApplication}\n`),
      packageOutputReceiptPath,
      proofFilePath: writeWorkspaceFile(workspaceRoot, `proof/${adapter.host}-loaded-host.txt`, "loaded host proof\n"),
      verificationMode: "uxp-developer-tool",
      loadedHostVerified: true,
      commandIdsVisible: adapter.commandIds,
      commandResults: adapter.commandIds.map((commandId) => ({
        commandId,
        status: commandId.endsWith("show_status") ? "visible" : "proof-blocked"
      })),
      localServiceRequestsBlocked: true,
      hostState: "loaded",
      uxpDeveloperToolPath: writeWorkspaceFile(workspaceRoot, "tools/uxp-developer-tool.exe", "UXP Developer Tool\n"),
      developerToolVerified: true,
      pluginLoaded: true,
      panelRendered: true,
      uxpManifestId: adapter.manifestId,
      entrypointsVisible: ["dxCommandCenterPanel", "dxShowReceipts", "dxShowStatus"]
    }
  });
}

function nativePluginFixture(
  adapter: CreativeNativePluginFixtureAdapter,
  loadedHostReceiptPath: string,
  packageOutputReceiptPath: string,
  proofFilePath: string,
  nativePluginArtifactPath: string
) {
  return {
    adapterId: adapter.adapterId,
    host: adapter.host,
    loadedHostReceiptPath,
    packageOutputReceiptPath,
    proofFilePath,
    nativePluginArtifactPath,
    pluginKind: "host-native-plugin",
    sdkName: adapter.sdkName,
    sdkVersion: "2026.1",
    bridgeMode: "metadata-command-bridge",
    loadedByHost: true,
    commandIdsVerified: adapter.commandIds,
    metadataOnly: true,
    storesHostPayloads: false,
    mutatesHostProject: false,
    mutatesHostDocument: false
  };
}
