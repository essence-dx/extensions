import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { buildAdobeUxpPackage } from "../build-adobe-uxp-package.ts";
import { classifySpecialProofWeakness } from "../lib/release-evidence-special-proof-classifier.ts";
import { writeAdobeCcxPackageReceipt } from "../write-adobe-ccx-package-receipts.ts";
import { writeAdobeUxpPackageOutputReceipt } from "../write-adobe-uxp-package-output-receipts.ts";
import { writeAdobeUxpPluginIdReceipt } from "../write-adobe-uxp-plugin-id-receipt.ts";
import { writeCreativeLoadedHostReceipt } from "../write-creative-loaded-host-receipts.ts";

const repoRoot = process.cwd();
const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-adobe-uxp-plugin-id-"));
const adapters = [
  {
    adapterId: "dx.photoshop.command-center",
    commandIds: [
      "dx.photoshop.show_status",
      "dx.photoshop.search_assets",
      "dx.photoshop.copy_receipts_path"
    ],
    entrypointIds: ["dxCommandCenterPanel", "dxShowReceipts", "dxShowStatus"],
    folder: "dx-photoshop-uxp",
    host: "photoshop",
    hostApp: "PS",
    hostApplication: "Photoshop",
    manifestId: "dx.photoshop.command-center.development"
  },
  {
    adapterId: "dx.premiere-pro.command-center",
    commandIds: [
      "dx.premiere-pro.show_status",
      "dx.premiere-pro.search_media_assets",
      "dx.premiere-pro.show_receipts"
    ],
    entrypointIds: ["dxCommandCenterPanel", "dxShowReceipts", "dxShowStatus"],
    folder: "dx-premiere-pro-uxp",
    host: "premiere-pro",
    hostApp: "premierepro",
    hostApplication: "Premiere Pro",
    manifestId: "dx.premiere-pro.command-center.development"
  },
  {
    adapterId: "dx.indesign.command-center",
    commandIds: [
      "dx.indesign.show_status",
      "dx.indesign.search_assets",
      "dx.indesign.show_receipts"
    ],
    entrypointIds: ["dxCommandCenterPanel", "dxShowReceipts", "dxShowStatus"],
    folder: "dx-indesign-uxp",
    host: "indesign",
    hostApp: "ID",
    hostApplication: "InDesign",
    manifestId: "dx.indesign.command-center.development"
  }
] as const;

try {
  writeReleaseGates();

  for (const adapter of adapters) {
    const packageOutputReceiptPath = await writeAdobePackageOutputReceipt(adapter);
    const loadedHostReceiptPath = writeLoadedHostReceipt(adapter, packageOutputReceiptPath);
    const proofFilePath = writeWorkspaceFile(
      `proof/${adapter.host}-developer-console-plugin-id.txt`,
      `${adapter.manifestId} visible in Adobe Developer Console plugin settings.\n`
    );
    const receipt = writeAdobeUxpPluginIdReceipt(workspaceRoot, {
      generatedAt: "2026-06-07T00:00:00.000Z",
      verificationCommand: "npm run smoke:adobe-uxp-plugin-id:j1",
      proof: {
        adapterId: adapter.adapterId,
        host: adapter.host,
        loadedHostReceiptPath,
        proofFilePath,
        developerConsolePluginId: adapter.manifestId,
        developerConsolePluginIdVerified: true,
        developerConsoleProjectVerified: true,
        marketplaceListingState: "draft"
      }
    });

    assert.equal(receipt.receipt, "dx.extension.adobe_uxp.plugin_id");
    assert.equal(receipt.adapterId, adapter.adapterId);
    assert.equal(receipt.host, adapter.host);
    assert.equal(receipt.receiptPath, joinReceiptPath(adapter.adapterId, "plugin-id-latest.json"));
    assert.equal(receipt.loadedHost.receiptPath, loadedHostReceiptPath);
    assert.equal(receipt.loadedHost.receiptSha256, sha256(readFileSync(loadedHostReceiptPath)));
    assert.equal(receipt.packageOutput.receiptPath, packageOutputReceiptPath);
    assert.equal(receipt.adobeDeveloperConsole.pluginId, adapter.manifestId);
    assert.equal(receipt.adobeDeveloperConsole.pluginIdSha256, sha256(Buffer.from(adapter.manifestId)));
    assert.equal(receipt.adobeDeveloperConsole.projectVerified, true);
    assert.equal(receipt.adobeDeveloperConsole.marketplaceListingState, "draft");
    assert.equal(receipt.manualProof.proofFilePath, proofFilePath);
    assert.equal(receipt.manualProof.proofFileSha256, sha256(readFileSync(proofFilePath)));
    assert.equal(receipt.releaseClaims.loadedHostVerified, true);
    assert.equal(receipt.releaseClaims.pluginIdVerified, true);
    assert.equal(receipt.releaseClaims.distributionVerified, false);
    assert.equal(existsSync(receipt.receiptPath), true);
    assert.deepEqual(JSON.parse(readFileSync(receipt.receiptPath, "utf8")), receipt);
    assert.equal(classifySpecialProofWeakness("plugin_id", receipt), undefined);

    const loadedHostSource = readFileSync(loadedHostReceiptPath, "utf8");
    writeFileSync(loadedHostReceiptPath, "{}\n");
    assert.match(
      classifySpecialProofWeakness("plugin_id", receipt) ?? "",
      /Adobe UXP plugin-id loaded-host receipt hash changed/
    );
    writeFileSync(loadedHostReceiptPath, loadedHostSource);
  }

  const fixture = await adobePluginIdFixture(adapters[0]);

  assert.throws(
    () =>
      writeAdobeUxpPluginIdReceipt(workspaceRoot, {
        proof: {
          ...fixture,
          developerConsolePluginId: "wrong.plugin.id"
        }
      }),
    /must match the loaded Adobe UXP manifest id/
  );

  assert.throws(
    () =>
      writeAdobeUxpPluginIdReceipt(workspaceRoot, {
        proof: {
          ...fixture,
          accountEmail: "designer@example.com"
        }
      }),
    /privacy-sensitive Adobe UXP plugin-id proof field/
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("Adobe UXP plugin-id receipts verified");

async function adobePluginIdFixture(adapter: (typeof adapters)[number]) {
  const packageOutputReceiptPath = await writeAdobePackageOutputReceipt(adapter);
  const loadedHostReceiptPath = writeLoadedHostReceipt(adapter, packageOutputReceiptPath);
  const proofFilePath = writeWorkspaceFile(`proof/${adapter.host}-fixture-plugin-id.txt`, "plugin id proof\n");

  return {
    adapterId: adapter.adapterId,
    host: adapter.host,
    loadedHostReceiptPath,
    proofFilePath,
    developerConsolePluginId: adapter.manifestId,
    developerConsolePluginIdVerified: true,
    developerConsoleProjectVerified: true,
    marketplaceListingState: "draft" as const
  };
}

async function writeAdobePackageOutputReceipt(adapter: (typeof adapters)[number]): Promise<string> {
  const adapterRoot = join(repoRoot, "hosts", "adobe", adapter.folder);
  const buildResult = await buildAdobeUxpPackage({
    adapterRoot,
    outputRoot: join(workspaceRoot, "dist", adapter.host)
  });
  const receiptPath = joinReceiptPath(adapter.adapterId, "package-output-latest.json");

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

function writeLoadedHostReceipt(
  adapter: (typeof adapters)[number],
  packageOutputReceiptPath: string
): string {
  const proofFilePath = writeWorkspaceFile(`proof/${adapter.host}-loaded-host.txt`, "loaded host proof\n");
  const hostExecutablePath = writeWorkspaceFile(`tools/${adapter.host}.exe`, `${adapter.hostApplication}\n`);
  const uxpDeveloperToolPath = writeWorkspaceFile("tools/uxp-developer-tool.exe", "UXP Developer Tool\n");
  const receipt = writeCreativeLoadedHostReceipt(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run smoke:creative-loaded-host:j1",
    proof: {
      target: adapter.host,
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

  writeAdobeCcxPackageReceipt(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run package:adobe-ccx:j1",
    proof: {
      adapterId: adapter.adapterId,
      host: adapter.host,
      packageOutputReceiptPath,
      sourcePackageRoot: JSON.parse(readFileSync(packageOutputReceiptPath, "utf8")).package.root,
      ccxArtifactPath: writeWorkspaceFile(
        `release/${adapter.host}/dx-command-center.ccx`,
        `${adapter.adapterId} CCX bytes\n`
      ),
      packagingTool: "uxp-developer-tool",
      packagingToolVersion: "2026.1.0"
    }
  });

  return receipt.receiptPath;
}

function writeReleaseGates(): void {
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
required_evidence = ["host_execution", "package_output", "ccx_package", "plugin_id", "signing", "checksum", "distribution_review"]
evidence_receipt_requirements = ["host_execution=.dx/receipts/extensions/${adapter.adapterId}/loaded-host-latest.json", "package_output=.dx/receipts/extensions/${adapter.adapterId}/package-output-latest.json", "ccx_package=.dx/receipts/extensions/${adapter.adapterId}/ccx-package-latest.json", "plugin_id=.dx/receipts/extensions/${adapter.adapterId}/plugin-id-latest.json", "signing=.dx/receipts/extensions/${adapter.adapterId}/signing-latest.json", "checksum=.dx/receipts/extensions/${adapter.adapterId}/checksum-latest.json", "distribution_review=.dx/receipts/extensions/${adapter.adapterId}/creative-cloud-review-latest.json"]
evidence_receipts = [".dx/receipts/extensions/${adapter.adapterId}/loaded-host-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/package-output-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/ccx-package-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/plugin-id-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/signing-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/checksum-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/creative-cloud-review-latest.json"]
next_release_proof = "Capture Adobe Developer Console plugin ID"
blocked_by = ["Adobe Developer Console plugin ID proof"]
`
  )
  .join("\n")}
`
  );

  for (const adapter of adapters) {
    writeWorkspaceFile(`hosts/adobe/${adapter.folder}/dx.extension.toml`, `[extension]\nid = "${adapter.adapterId}"\n`);
  }
}

function writeWorkspaceFile(relativePath: string, source: string): string {
  const absolutePath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);
  return absolutePath;
}

function joinReceiptPath(adapterId: string, receiptName: string): string {
  return join(workspaceRoot, ".dx", "receipts", "extensions", adapterId, receiptName);
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
