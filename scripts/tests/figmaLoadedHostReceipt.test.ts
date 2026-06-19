import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { buildFigmaPlugin } from "../build-figma-plugin.ts";
import {
  classifyFigmaLoadedHostWeakness
} from "../lib/release-evidence-loaded-application-host-classifier.ts";
import { classifySpecialProofWeakness } from "../lib/release-evidence-special-proof-classifier.ts";
import { writeFigmaCanvaPackageOutputReceipt } from "../write-figma-canva-package-output-receipts.ts";
import { writeFigmaLoadedHostReceipts } from "../write-figma-loaded-host-receipts.ts";

const repoRoot = process.cwd();
const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-figma-loaded-host-"));
const adapterRoot = join(repoRoot, "hosts", "figma", "dx-figma");
const commandIds = [
  "dx.figma.show_status",
  "dx.figma.search_assets",
  "dx.figma.copy_receipts_path"
] as const;
const menuCommands = ["show-status", "search-assets", "copy-receipts-path"] as const;

try {
  const packageOutputReceiptPath = await writePackageOutputReceipt();
  const proofFilePath = writeWorkspaceFile("proof/figma-loaded-host.txt", "Figma metadata-only loaded-host proof.\n");
  const hostExecutablePath = writeWorkspaceFile("host/Figma.exe", "Figma desktop executable fixture\n");
  const receipts = writeFigmaLoadedHostReceipts(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run smoke:figma-loaded-host:j1",
    proof: {
      hostApplication: "Figma",
      hostVersion: "126.0.0",
      hostExecutablePath,
      packageOutputReceiptPath,
      proofFilePath,
      verificationMode: "figma-desktop-plugin",
      loadedHostVerified: true,
      pluginIdVerified: true,
      manifestPluginId: "dx-figma-command-center-development",
      pluginUiRendered: true,
      menuCommandsVisible: [...menuCommands],
      commandIdsVisible: [...commandIds],
      commandResults: commandIds.map((commandId) => ({
        commandId,
        status: commandId.endsWith("copy_receipts_path") ? "visible" : "proof-blocked"
      })),
      localServiceRequestsBlocked: true,
      fileState: "test-file",
      networkAccessRestricted: true,
      mutatesFigmaFile: false,
      storesFigmaPayloads: false
    }
  });

  assert.equal(receipts.loadedHost.receipt, "dx.extension.figma.loaded_host");
  assert.equal(receipts.loadedHost.adapterId, "dx.figma.command-center");
  assert.equal(receipts.loadedHost.generatedAt, "2026-06-07T00:00:00.000Z");
  assert.equal(receipts.loadedHost.receiptPath, joinReceiptPath("loaded-host-latest.json"));
  assert.equal(receipts.loadedHost.hostApplication.name, "Figma");
  assert.equal(receipts.loadedHost.hostApplication.version, "126.0.0");
  assert.equal(receipts.loadedHost.hostApplication.executablePath, hostExecutablePath);
  assert.equal(receipts.loadedHost.hostApplication.executableSha256, sha256(readFileSync(hostExecutablePath)));
  assert.equal(receipts.loadedHost.hostApplication.fileState, "test-file");
  assert.equal(receipts.loadedHost.packageOutput.receiptPath, packageOutputReceiptPath);
  assert.equal(receipts.loadedHost.packageOutput.receiptSha256, sha256(readFileSync(packageOutputReceiptPath)));
  assert.deepEqual(receipts.loadedHost.loadedHost.commandIdsVisible, [...commandIds].sort());
  assert.deepEqual(receipts.loadedHost.loadedHost.menuCommandsVisible, [...menuCommands].sort());
  assert.equal(receipts.loadedHost.loadedHost.localServiceRequestsBlocked, true);
  assert.equal(receipts.loadedHost.loadedHost.networkAccessRestricted, true);
  assert.equal(receipts.loadedHost.loadedHost.mutatesFigmaFile, false);
  assert.equal(receipts.loadedHost.loadedHost.storesFigmaPayloads, false);
  assert.equal(receipts.loadedHost.releaseClaims.loadedHostVerified, true);
  assert.equal(receipts.loadedHost.releaseClaims.pluginIdVerified, false);
  assert.equal(receipts.loadedHost.releaseClaims.localServiceVerified, false);
  assert.equal(receipts.loadedHost.releaseClaims.distributionVerified, false);
  assert.equal(existsSync(receipts.loadedHost.receiptPath), true);

  assert.equal(receipts.pluginId.receipt, "dx.extension.figma.plugin_id");
  assert.equal(receipts.pluginId.adapterId, "dx.figma.command-center");
  assert.equal(receipts.pluginId.receiptPath, joinReceiptPath("plugin-id-latest.json"));
  assert.equal(receipts.pluginId.loadedHostReceiptPath, receipts.loadedHost.receiptPath);
  assert.equal(receipts.pluginId.loadedHostReceiptSha256, sha256(readFileSync(receipts.loadedHost.receiptPath)));
  assert.equal(receipts.pluginId.plugin.manifestPluginId, "dx-figma-command-center-development");
  assert.equal(receipts.pluginId.plugin.pluginIdVerified, true);
  assert.equal(receipts.pluginId.releaseClaims.pluginIdVerified, true);
  assert.equal(receipts.pluginId.releaseClaims.communityReviewVerified, false);
  assert.equal(receipts.pluginId.releaseClaims.distributionVerified, false);
  assert.equal(existsSync(receipts.pluginId.receiptPath), true);

  assert.deepEqual(JSON.parse(readFileSync(receipts.loadedHost.receiptPath, "utf8")), receipts.loadedHost);
  assert.deepEqual(JSON.parse(readFileSync(receipts.pluginId.receiptPath, "utf8")), receipts.pluginId);
  assert.equal(classifyFigmaLoadedHostWeakness(receipts.loadedHost), undefined);
  assert.equal(classifySpecialProofWeakness("plugin_id", receipts.pluginId), undefined);

  const hostApplicationWithoutExecutable = {
    ...(receipts.loadedHost.hostApplication as Record<string, unknown>)
  };
  delete hostApplicationWithoutExecutable.executablePath;
  delete hostApplicationWithoutExecutable.executableSha256;
  assert.match(
    classifyFigmaLoadedHostWeakness({
      ...receipts.loadedHost,
      hostApplication: hostApplicationWithoutExecutable
    }) ?? "",
    /Figma loaded-host receipt is missing host executable linkage/
  );

  assert.match(
    classifyFigmaLoadedHostWeakness({
      ...receipts.loadedHost,
      hostApplication: {
        ...receipts.loadedHost.hostApplication,
        executableSha256: "0".repeat(64)
      }
    }) ?? "",
    /Figma loaded-host host executable hash changed/
  );

  assert.match(
    classifyFigmaLoadedHostWeakness({
      ...receipts.loadedHost,
      loadedHost: {
        ...receipts.loadedHost.loadedHost,
        commandIdsVisible: ["dx.figma.show_status", "dx.figma.search_assets"],
        commandResults: commandIds
          .filter((commandId) => commandId !== "dx.figma.copy_receipts_path")
          .map((commandId) => ({
            commandId,
            status: "proof-blocked"
          }))
      }
    }) ?? "",
    /Figma loaded-host receipt is missing expected command IDs/
  );

  assert.match(
    classifyFigmaLoadedHostWeakness({
      ...receipts.loadedHost,
      loadedHost: {
        ...receipts.loadedHost.loadedHost,
        menuCommandsVisible: ["show-status", "search-assets"]
      }
    }) ?? "",
    /Figma loaded-host receipt is missing expected menu commands/
  );

  assert.match(
    classifyFigmaLoadedHostWeakness({
      ...receipts.loadedHost,
      hostApplication: {
        ...receipts.loadedHost.hostApplication,
        fileState: "empty"
      }
    }) ?? "",
    /Figma loaded-host receipt must verify a loaded test file/
  );

  writeFileSync(proofFilePath, "Figma loaded-host proof changed after capture.\n");
  assert.match(
    classifyFigmaLoadedHostWeakness(receipts.loadedHost) ?? "",
    /Figma loaded-host manual proof file hash changed/
  );

  writeFileSync(proofFilePath, "Figma metadata-only loaded-host proof.\n");
  const packageOutputReceiptSource = readFileSync(packageOutputReceiptPath, "utf8");
  writeFileSync(packageOutputReceiptPath, "{}\n");
  assert.match(
    classifyFigmaLoadedHostWeakness(receipts.loadedHost) ?? "",
    /Figma loaded-host linked package-output receipt hash changed/
  );

  writeFileSync(packageOutputReceiptPath, packageOutputReceiptSource);
  const loadedHostReceiptSource = readFileSync(receipts.loadedHost.receiptPath, "utf8");
  writeFileSync(receipts.loadedHost.receiptPath, "{}\n");
  assert.match(
    classifySpecialProofWeakness("plugin_id", receipts.pluginId) ?? "",
    /Figma plugin-id loaded-host receipt hash changed/
  );

  writeFileSync(receipts.loadedHost.receiptPath, loadedHostReceiptSource);
  const weakLoadedHostReceipt = JSON.parse(loadedHostReceiptSource);
  weakLoadedHostReceipt.loadedHost.commandIdsVisible = ["dx.figma.show_status", "dx.figma.search_assets"];
  const weakLoadedHostReceiptSource = `${JSON.stringify(weakLoadedHostReceipt, null, 2)}\n`;
  writeFileSync(receipts.loadedHost.receiptPath, weakLoadedHostReceiptSource);
  assert.match(
    classifySpecialProofWeakness("plugin_id", {
      ...receipts.pluginId,
      loadedHostReceiptSha256: sha256(Buffer.from(weakLoadedHostReceiptSource))
    }) ?? "",
    /Figma plugin-id linked loaded-host receipt is weak: Figma loaded-host receipt is missing expected command IDs/
  );

  writeFileSync(receipts.loadedHost.receiptPath, loadedHostReceiptSource);

  const fixture = figmaLoadedHostFixture(packageOutputReceiptPath, proofFilePath);

  assert.throws(
    () =>
      writeFigmaLoadedHostReceipts(workspaceRoot, {
        proof: {
          ...fixture,
          loadedHostVerified: false
        }
      }),
    /must verify a real loaded Figma host/
  );

  assert.throws(
    () =>
      writeFigmaLoadedHostReceipts(workspaceRoot, {
        proof: {
          ...fixture,
          fileName: "Customer Design"
        }
      }),
    /privacy-sensitive Figma proof field/
  );

  assert.throws(
    () =>
      writeFigmaLoadedHostReceipts(workspaceRoot, {
        proof: {
          ...fixture,
          commandIdsVisible: ["dx.figma.show_status"]
        }
      }),
    /must include visible command metadata/
  );

  assert.throws(
    () =>
      writeFigmaLoadedHostReceipts(workspaceRoot, {
        proof: {
          ...fixture,
          fileState: "empty"
        }
      }),
    /must verify a loaded test file/
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("Figma loaded-host receipts verified");

function figmaLoadedHostFixture(packageOutputReceiptPath: string, proofFilePath: string) {
  return {
    hostApplication: "Figma",
    hostVersion: "126.0.0",
    hostExecutablePath: writeWorkspaceFile("host/Figma-fixture.exe", "Figma fixture executable\n"),
    packageOutputReceiptPath,
    proofFilePath,
    verificationMode: "figma-desktop-plugin",
    loadedHostVerified: true,
    pluginIdVerified: true,
    manifestPluginId: "dx-figma-command-center-development",
    pluginUiRendered: true,
    menuCommandsVisible: [...menuCommands],
    commandIdsVisible: [...commandIds],
    commandResults: commandIds.map((commandId) => ({
      commandId,
      status: commandId.endsWith("copy_receipts_path") ? "visible" : "proof-blocked"
    })),
    localServiceRequestsBlocked: true,
    fileState: "test-file",
    networkAccessRestricted: true,
    mutatesFigmaFile: false,
    storesFigmaPayloads: false
  };
}

async function writePackageOutputReceipt(): Promise<string> {
  const packageRoot = join(workspaceRoot, "package");
  const receiptPath = joinReceiptPath("package-output-latest.json");

  mkdirSync(packageRoot, { recursive: true });
  copyFileSync(join(adapterRoot, "manifest.json"), join(packageRoot, "manifest.json"));
  copyFileSync(join(adapterRoot, "ui.html"), join(packageRoot, "ui.html"));
  await buildFigmaPlugin({
    adapterRoot,
    outputRoot: packageRoot
  });
  writeFigmaCanvaPackageOutputReceipt({
    adapterId: "dx.figma.command-center",
    host: "figma",
    adapterRoot,
    packageRoot,
    receiptPath,
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run build:figma:j1"
  });

  return receiptPath;
}

function writeWorkspaceFile(relativePath: string, source: string): string {
  const absolutePath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);
  return absolutePath;
}

function joinReceiptPath(receiptName: string): string {
  return join(workspaceRoot, ".dx", "receipts", "extensions", "dx.figma.command-center", receiptName);
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
