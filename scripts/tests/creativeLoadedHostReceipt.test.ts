import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { buildAdobeUxpPackage } from "../build-adobe-uxp-package.ts";
import { classifyCreativeLoadedHostWeakness } from "../lib/release-evidence-loaded-application-host-classifier.ts";
import { classifySpecialProofWeakness } from "../lib/release-evidence-special-proof-classifier.ts";
import { writeAdobeUxpPackageOutputReceipt } from "../write-adobe-uxp-package-output-receipts.ts";
import { writeCreativeLoadedHostReceipt } from "../write-creative-loaded-host-receipts.ts";
import { writeDavinciResolvePackageOutputReceipt } from "../write-davinci-resolve-package-output-receipt.ts";

const repoRoot = process.cwd();
const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-creative-loaded-host-"));
const adobeAdapters = [
  {
    adapterId: "dx.photoshop.command-center",
    commandIds: [
      "dx.photoshop.show_status",
      "dx.photoshop.search_assets",
      "dx.photoshop.copy_receipts_path"
    ],
    folder: "dx-photoshop-uxp",
    hostApplication: "Photoshop",
    entrypointIds: ["dxCommandCenterPanel", "dxShowReceipts", "dxShowStatus"],
    manifestId: "dx.photoshop.command-center.development",
    target: "photoshop"
  },
  {
    adapterId: "dx.premiere-pro.command-center",
    commandIds: [
      "dx.premiere-pro.show_status",
      "dx.premiere-pro.search_media_assets",
      "dx.premiere-pro.show_receipts"
    ],
    folder: "dx-premiere-pro-uxp",
    hostApplication: "Premiere Pro",
    entrypointIds: ["dxCommandCenterPanel", "dxShowReceipts", "dxShowStatus"],
    manifestId: "dx.premiere-pro.command-center.development",
    target: "premiere-pro"
  },
  {
    adapterId: "dx.indesign.command-center",
    commandIds: [
      "dx.indesign.show_status",
      "dx.indesign.search_assets",
      "dx.indesign.show_receipts"
    ],
    folder: "dx-indesign-uxp",
    hostApplication: "InDesign",
    entrypointIds: ["dxCommandCenterPanel", "dxShowReceipts", "dxShowStatus"],
    manifestId: "dx.indesign.command-center.development",
    target: "indesign"
  }
] as const;
const resolveAdapter = {
  adapterId: "dx.davinci-resolve.command-center",
  commandIds: [
    "dx.davinci-resolve.show_status",
    "dx.davinci-resolve.inspect_project",
    "dx.davinci-resolve.show_receipts"
  ],
  hostApplication: "DaVinci Resolve",
  target: "davinci-resolve"
} as const;

try {
  for (const adapter of adobeAdapters) {
    const packageOutputReceiptPath = await writeAdobePackageOutputReceipt(adapter);
    const proofFilePath = writeWorkspaceFile(
      `proof/${adapter.target}-loaded-host.txt`,
      `${adapter.hostApplication} metadata-only UXP panel proof.\n`
    );
    const hostExecutablePath = writeWorkspaceFile(`tools/${adapter.target}.exe`, `${adapter.hostApplication}\n`);
    const uxpDeveloperToolPath = writeWorkspaceFile("tools/uxp-developer-tool.exe", "UXP Developer Tool\n");
    const receipt = writeCreativeLoadedHostReceipt(workspaceRoot, {
      generatedAt: "2026-06-07T00:00:00.000Z",
      verificationCommand: "npm run smoke:creative-loaded-host:j1",
      proof: {
        target: adapter.target,
        hostApplication: adapter.hostApplication,
        hostVersion: "2026.1.0",
        hostExecutablePath,
        packageOutputReceiptPath,
        proofFilePath,
        verificationMode: "uxp-developer-tool",
        loadedHostVerified: true,
        commandIdsVisible: adapter.commandIds,
        commandResults: adapter.commandIds.map((commandId) => ({
          commandId,
          status: commandId.endsWith("show_status") ? "visible" : "proof-blocked"
        })),
        localServiceRequestsBlocked: true,
        hostState: "loaded",
        uxpDeveloperToolPath,
        developerToolVerified: true,
        pluginLoaded: true,
        panelRendered: true,
        uxpManifestId: adapter.manifestId,
        entrypointsVisible: adapter.entrypointIds
      }
    });

    assert.equal(receipt.receipt, "dx.extension.creative.loaded_host");
    assert.equal(receipt.adapterId, adapter.adapterId);
    assert.equal(receipt.host, adapter.target);
    assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
    assert.equal(receipt.verificationCommand, "npm run smoke:creative-loaded-host:j1");
    assert.equal(
      receipt.receiptPath,
      join(workspaceRoot, ".dx", "receipts", "extensions", adapter.adapterId, "loaded-host-latest.json")
    );
    assert.equal(receipt.hostApplication.name, adapter.hostApplication);
    assert.equal(receipt.hostApplication.version, "2026.1.0");
    assert.equal(receipt.hostApplication.executablePath, hostExecutablePath);
    assert.equal(receipt.hostApplication.executableSha256, sha256(readFileSync(hostExecutablePath)));
    assert.equal(receipt.hostApplication.verificationMode, "uxp-developer-tool");
    assert.equal(receipt.packageOutput.receiptPath, packageOutputReceiptPath);
    assert.equal(receipt.packageOutput.receiptSha256, sha256(readFileSync(packageOutputReceiptPath)));
    assert.equal(receipt.loadedHost.localServiceRequestsBlocked, true);
    assert.deepEqual(receipt.loadedHost.commandIdsVisible, [...adapter.commandIds].sort());
    assert.deepEqual(receipt.adobeUxp, {
      uxpDeveloperToolPath,
      developerToolVerified: true,
      pluginLoaded: true,
      panelRendered: true,
      uxpManifestId: adapter.manifestId,
      entrypointsVisible: adapter.entrypointIds
    });
    assert.equal(receipt.manualProof.proofFilePath, proofFilePath);
    assert.equal(receipt.manualProof.proofFileSha256, sha256(readFileSync(proofFilePath)));
    assert.equal(receipt.releaseClaims.loadedHostVerified, true);
    assert.equal(receipt.releaseClaims.localServiceVerified, false);
    assert.equal(receipt.releaseClaims.ccxPackaged, false);
    assert.equal(receipt.releaseClaims.signingVerified, false);
    assert.equal(receipt.releaseClaims.distributionVerified, false);
    assert.equal(existsSync(receipt.receiptPath), true);
    assert.deepEqual(JSON.parse(readFileSync(receipt.receiptPath, "utf8")), receipt);
    assert.equal(classifyCreativeLoadedHostWeakness(receipt), undefined);

    writeFileSync(hostExecutablePath, `${adapter.hostApplication} executable changed.\n`);
    assert.match(
      classifyCreativeLoadedHostWeakness(receipt) ?? "",
      /creative loaded-host host executable hash changed/
    );
    writeFileSync(hostExecutablePath, `${adapter.hostApplication}\n`);
  }

  const resolvePackageOutputReceiptPath = writeResolvePackageOutputReceipt();
  const resolveProofFilePath = writeWorkspaceFile("proof/davinci-resolve-loaded-host.txt", "Resolve proof\n");
  const resolveHostExecutablePath = writeWorkspaceFile("tools/resolve.exe", "DaVinci Resolve\n");
  const resolveReceipt = writeCreativeLoadedHostReceipt(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run smoke:creative-loaded-host:j1",
    proof: {
      target: "davinci-resolve",
      hostApplication: "DaVinci Resolve",
      hostVersion: "20.0.0",
      hostExecutablePath: resolveHostExecutablePath,
      packageOutputReceiptPath: resolvePackageOutputReceiptPath,
      proofFilePath: resolveProofFilePath,
      verificationMode: "resolve-scripting",
      loadedHostVerified: true,
      commandIdsVisible: resolveAdapter.commandIds,
      commandResults: resolveAdapter.commandIds.map((commandId) => ({
        commandId,
        status: commandId.endsWith("inspect_project") ? "visible" : "proof-blocked"
      })),
      localServiceRequestsBlocked: true,
      hostState: "loaded",
      loadedResolveVerified: true,
      scriptLanguage: "python",
      scriptLoadedInResolve: true,
      mutatesResolveProject: false,
      readOnlyProjectMetadataVerified: true,
      workflowIntegrationVerified: true
    }
  });

  assert.equal(resolveReceipt.receipt, "dx.extension.creative.loaded_host");
  assert.equal(resolveReceipt.adapterId, resolveAdapter.adapterId);
  assert.equal(resolveReceipt.host, "davinci-resolve");
  assert.equal(resolveReceipt.hostApplication.verificationMode, "resolve-scripting");
  assert.equal(resolveReceipt.hostApplication.executableSha256, sha256(readFileSync(resolveHostExecutablePath)));
  assert.equal(resolveReceipt.packageOutput.receiptPath, resolvePackageOutputReceiptPath);
  assert.equal(resolveReceipt.davinciResolve?.scriptLanguage, "python");
  assert.equal(resolveReceipt.davinciResolve?.scriptLoadedInResolve, true);
  assert.equal(resolveReceipt.davinciResolve?.mutatesResolveProject, false);
  assert.equal(resolveReceipt.releaseClaims.loadedHostVerified, true);
  assert.equal(resolveReceipt.releaseClaims.workflowIntegrationVerified, false);

  const workflowReceiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    resolveAdapter.adapterId,
    "workflow-integration-latest.json"
  );
  const workflowReceipt = JSON.parse(readFileSync(workflowReceiptPath, "utf8"));

  assert.equal(workflowReceipt.receipt, "dx.extension.davinci_resolve.workflow_integration");
  assert.equal(workflowReceipt.adapterId, resolveAdapter.adapterId);
  assert.equal(workflowReceipt.loadedHostReceiptPath, resolveReceipt.receiptPath);
  assert.equal(workflowReceipt.releaseClaims.workflowIntegrationVerified, true);
  assert.equal(workflowReceipt.releaseClaims.readOnlyProjectMetadataVerified, true);
  assert.equal(workflowReceipt.releaseClaims.distributionVerified, false);
  assert.equal(classifySpecialProofWeakness("workflow_integration", workflowReceipt), undefined);

  writeFileSync(resolveProofFilePath, "DaVinci Resolve workflow manual proof changed after capture.\n");
  assert.match(
    classifySpecialProofWeakness("workflow_integration", workflowReceipt) ?? "",
    /workflow integration manual proof file hash changed/
  );

  writeFileSync(resolveProofFilePath, "Resolve proof\n");
  const resolvePackageOutputReceiptSource = readFileSync(resolvePackageOutputReceiptPath, "utf8");
  writeFileSync(resolvePackageOutputReceiptPath, "{}\n");
  assert.match(
    classifySpecialProofWeakness("workflow_integration", workflowReceipt) ?? "",
    /workflow integration linked package-output receipt hash changed/
  );

  writeFileSync(resolvePackageOutputReceiptPath, resolvePackageOutputReceiptSource);
  const resolveLoadedHostReceiptSource = readFileSync(resolveReceipt.receiptPath, "utf8");
  writeFileSync(resolveReceipt.receiptPath, "{}\n");
  assert.match(
    classifySpecialProofWeakness("workflow_integration", workflowReceipt) ?? "",
    /workflow integration loaded-host receipt hash changed/
  );

  writeFileSync(resolveReceipt.receiptPath, resolveLoadedHostReceiptSource);
  const weakResolveLoadedHostReceipt = JSON.parse(resolveLoadedHostReceiptSource);
  weakResolveLoadedHostReceipt.davinciResolve.readOnlyProjectMetadataVerified = false;
  const weakResolveLoadedHostReceiptSource = `${JSON.stringify(weakResolveLoadedHostReceipt, null, 2)}\n`;
  writeFileSync(resolveReceipt.receiptPath, weakResolveLoadedHostReceiptSource);
  assert.match(
    classifySpecialProofWeakness("workflow_integration", {
      ...workflowReceipt,
      loadedHostReceiptSha256: sha256(Buffer.from(weakResolveLoadedHostReceiptSource))
    }) ?? "",
    /workflow integration linked loaded-host receipt is weak: DaVinci Resolve loaded-host receipt verifies workflow integration without read-only metadata proof/
  );

  writeFileSync(resolveReceipt.receiptPath, resolveLoadedHostReceiptSource);

  const fixture = await adobeLoadedHostFixture("photoshop");

  assert.throws(
    () =>
      writeCreativeLoadedHostReceipt(workspaceRoot, {
        proof: {
          ...fixture,
          loadedHostVerified: false
        }
      }),
    /must verify a real creative host/
  );

  assert.throws(
    () =>
      writeCreativeLoadedHostReceipt(workspaceRoot, {
        proof: {
          ...fixture,
          documentName: "Customer Layout"
        }
      }),
    /privacy-sensitive creative loaded-host proof field/
  );

  assert.throws(
    () =>
      writeCreativeLoadedHostReceipt(workspaceRoot, {
        proof: {
          ...fixture,
          commandIdsVisible: ["dx.photoshop.show_status"]
        }
      }),
    /must include visible command metadata/
  );

  assert.throws(
    () =>
      writeCreativeLoadedHostReceipt(workspaceRoot, {
        proof: {
          ...fixture,
          hostState: "unavailable"
        }
      }),
    /must verify a loaded creative host state/
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("Creative loaded-host receipts verified");

async function adobeLoadedHostFixture(target: "photoshop") {
  const adapter = adobeAdapters.find((candidate) => candidate.target === target);

  assert.ok(adapter);

  const packageOutputReceiptPath = await writeAdobePackageOutputReceipt(adapter);
  const proofFilePath = writeWorkspaceFile(`proof/${target}-fixture.txt`, "fixture proof\n");
  const hostExecutablePath = writeWorkspaceFile(`tools/${target}-fixture.exe`, "host executable\n");
  const uxpDeveloperToolPath = writeWorkspaceFile("tools/uxp-developer-tool-fixture.exe", "UXP Developer Tool\n");

  return {
    target: adapter.target,
    hostApplication: adapter.hostApplication,
    hostVersion: "2026.1.0",
    hostExecutablePath,
    packageOutputReceiptPath,
    proofFilePath,
    verificationMode: "uxp-developer-tool",
    loadedHostVerified: true,
    commandIdsVisible: adapter.commandIds,
    commandResults: adapter.commandIds.map((commandId) => ({
      commandId,
      status: commandId.endsWith("show_status") ? "visible" : "proof-blocked"
    })),
    localServiceRequestsBlocked: true,
    hostState: "loaded",
    uxpDeveloperToolPath,
    developerToolVerified: true,
    pluginLoaded: true,
    panelRendered: true,
    uxpManifestId: adapter.manifestId,
    entrypointsVisible: adapter.entrypointIds
  };
}

async function writeAdobePackageOutputReceipt(adapter: (typeof adobeAdapters)[number]): Promise<string> {
  const adapterRoot = join(repoRoot, "hosts", "adobe", adapter.folder);
  const buildResult = await buildAdobeUxpPackage({
    adapterRoot,
    outputRoot: join(workspaceRoot, "dist", adapter.target)
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
    host: adapter.target,
    adapterRoot,
    packageRoot: buildResult.packageRoot,
    receiptPath,
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run build:adobe-uxp:j1"
  });

  return receiptPath;
}

function writeResolvePackageOutputReceipt(): string {
  const adapterRoot = join(repoRoot, "hosts", "blackmagic", "dx-davinci-resolve");
  const receiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    resolveAdapter.adapterId,
    "package-output-latest.json"
  );

  writeDavinciResolvePackageOutputReceipt({
    adapterRoot,
    packageRoot: adapterRoot,
    receiptPath,
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run package:davinci-resolve:j1"
  });

  return receiptPath;
}

function writeWorkspaceFile(relativePath: string, source: string): string {
  const absolutePath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);
  return absolutePath;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
