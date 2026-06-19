import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  type ApplicationLoadedHostProof,
  type ApplicationLoadedHostTarget,
  writeApplicationLoadedHostReceipt
} from "../write-application-loaded-host-receipts.ts";
import { writeBlenderPackageOutputReceipt } from "../write-blender-package-output-receipt.ts";
import { writeFigmaCanvaPackageOutputReceipt } from "../write-figma-canva-package-output-receipts.ts";
import { classifyApplicationLoadedHostWeakness } from "../lib/release-evidence-loaded-application-host-classifier.ts";
import { classifySpecialProofWeakness } from "../lib/release-evidence-special-proof-classifier.ts";
import { writeObsidianPackageOutputReceipt } from "../write-obsidian-package-output-receipt.ts";
import { writeSketchPackageOutputReceipt } from "../write-sketch-package-output-receipt.ts";
import { writeZedPackageOutputReceipt } from "../write-zed-package-output-receipt.ts";

interface ApplicationFixture {
  adapterId: string;
  commandIds: string[];
  hostApplication: string;
  receiptName: string;
  target: ApplicationLoadedHostTarget;
  verificationMode: ApplicationLoadedHostProof["verificationMode"];
  writePackageOutputReceipt: () => string;
  proofFields: Partial<ApplicationLoadedHostProof>;
}

const repoRoot = process.cwd();
const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-application-loaded-host-"));

const fixtures: ApplicationFixture[] = [
  {
    adapterId: "dx.zed.command-center",
    commandIds: [],
    hostApplication: "Zed",
    receiptName: "loaded-dev-extension-latest.json",
    target: "zed",
    verificationMode: "zed-dev-extension",
    writePackageOutputReceipt: () =>
      writeZedPackageOutputReceipt({
        adapterRoot: join(repoRoot, "hosts", "zed", "dx-zed"),
        packageRoot: join(repoRoot, "hosts", "zed", "dx-zed"),
        receiptPath: receiptPathFor("dx.zed.command-center", "package-output-latest.json"),
        generatedAt: "2026-06-07T00:00:00.000Z",
        verificationCommand: "npm run package:zed:j1"
      }).receiptPath,
    proofFields: {}
  },
  {
    adapterId: "dx.blender.command-center",
    commandIds: ["dx.show_status", "dx.run_doctor", "dx.open_receipts"],
    hostApplication: "Blender",
    receiptName: "loaded-host-latest.json",
    target: "blender",
    verificationMode: "blender-addon",
    writePackageOutputReceipt: () =>
      writeBlenderPackageOutputReceipt({
        adapterRoot: join(repoRoot, "hosts", "blender", "dx-blender"),
        packageRoot: join(repoRoot, "hosts", "blender", "dx-blender", "dist"),
        receiptPath: receiptPathFor("dx.blender.command-center", "package-output-latest.json"),
        generatedAt: "2026-06-07T00:00:00.000Z",
        verificationCommand: "npm run build:blender:j1"
      }).receiptPath,
    proofFields: {
      addonInstalled: true,
      extensionId: "dx_blender_command_center"
    }
  },
  {
    adapterId: "dx.obsidian.command-center",
    commandIds: ["dx-show-status", "dx-run-doctor", "dx-copy-receipts-path"],
    hostApplication: "Obsidian",
    receiptName: "loaded-vault-latest.json",
    target: "obsidian",
    verificationMode: "obsidian-test-vault",
    writePackageOutputReceipt: () =>
      writeObsidianPackageOutputReceipt({
        adapterRoot: join(repoRoot, "hosts", "obsidian", "dx-command-center"),
        packageRoot: join(repoRoot, "hosts", "obsidian", "dx-command-center"),
        receiptPath: receiptPathFor("dx.obsidian.command-center", "package-output-latest.json"),
        generatedAt: "2026-06-07T00:00:00.000Z",
        verificationCommand: "npm run build:obsidian:j1"
      }).receiptPath,
    proofFields: {
      extensionId: "dx-command-center",
      extensionLoaded: true
    }
  },
  {
    adapterId: "dx.canva.command-center",
    commandIds: ["showStatus", "searchAssets", "copyReceiptsPath"],
    hostApplication: "Canva",
    receiptName: "development-app-latest.json",
    target: "canva",
    verificationMode: "canva-development-app",
    writePackageOutputReceipt: () =>
      writeFigmaCanvaPackageOutputReceipt({
        adapterId: "dx.canva.command-center",
        host: "canva",
        adapterRoot: join(repoRoot, "hosts", "canva", "dx-canva"),
        packageRoot: join(repoRoot, "hosts", "canva", "dx-canva"),
        receiptPath: receiptPathFor("dx.canva.command-center", "package-output-latest.json"),
        generatedAt: "2026-06-07T00:00:00.000Z",
        verificationCommand: "npm run build:canva:j1"
      }).receiptPath,
    proofFields: {
      developmentAppVerified: true,
      runtimePermissionsEmpty: true
    }
  },
  {
    adapterId: "dx.sketch.command-center",
    commandIds: ["show-status", "search-assets", "show-receipts"],
    hostApplication: "Sketch",
    receiptName: "loaded-host-latest.json",
    target: "sketch",
    verificationMode: "sketch-plugin",
    writePackageOutputReceipt: () =>
      writeSketchPackageOutputReceipt({
        adapterRoot: join(repoRoot, "hosts", "sketch", "dx-sketch"),
        bundleRoot: join(repoRoot, "hosts", "sketch", "dx-sketch", "dx-sketch.sketchplugin"),
        receiptPath: receiptPathFor("dx.sketch.command-center", "package-output-latest.json"),
        generatedAt: "2026-06-07T00:00:00.000Z",
        verificationCommand: "npm run build:sketch:j1"
      }).receiptPath,
    proofFields: {
      extensionId: "dev.dx.sketch.command-center",
      extensionLoaded: true,
      sketchtoolPath: writeWorkspaceFile("tools/sketchtool.exe", "sketchtool\n"),
      sketchtoolVerified: true
    }
  }
];

try {
  for (const fixture of fixtures) {
    const receipt = writeApplicationLoadedHostReceipt(workspaceRoot, {
      generatedAt: "2026-06-07T00:00:00.000Z",
      verificationCommand: "npm run smoke:application-loaded-host:j1",
      proof: createProof(fixture)
    });

    assert.equal(receipt.receipt, "dx.extension.application.loaded_host");
    assert.equal(receipt.adapterId, fixture.adapterId);
    assert.equal(receipt.host, fixture.target);
    assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
    assert.equal(receipt.verificationCommand, "npm run smoke:application-loaded-host:j1");
    assert.equal(receipt.receiptPath, receiptPathFor(fixture.adapterId, fixture.receiptName));
    assert.equal(receipt.hostApplication.name, fixture.hostApplication);
    assert.equal(receipt.hostApplication.version, "2026.1.0");
    assert.equal(receipt.hostApplication.verificationMode, fixture.verificationMode);
    assert.equal(receipt.hostApplication.executableSha256, sha256(readFileSync(receipt.hostApplication.executablePath)));
    assert.equal(receipt.loadedHost.extensionInstalled, true);
    assert.equal(receipt.loadedHost.localServiceRequestsBlocked, true);
    assert.equal(receipt.loadedHost.mutatesHostDocument, false);
    assert.deepEqual(receipt.loadedHost.commandIdsVisible, [...fixture.commandIds].sort());
    if (fixture.target === "zed") {
      assert.equal(receipt.loadedHost.commandResults.length, 0);
      assert.equal(receipt.zed?.extensionId, "dx-command-center");
      assert.equal(receipt.zed?.devExtensionLoaded, true);
      assert.equal(receipt.zed?.installedPathLinksToSource, true);
      assert.equal(receipt.zed?.extensionIndexContainsDevExtension, true);
      assert.equal(receipt.zed?.hostLogReferencesExtension, true);
      assert.equal(receipt.zed?.wasmArtifactSha256, zedWasmSha256());
      assert.equal(receipt.zed?.hostExecutableSha256, sha256(readFileSync(receipt.hostApplication.executablePath)));
      const zedProof = receipt.zed!;
      const extensionIndexSource = readFileSync(zedProof.extensionIndexPath, "utf8");

      writeFileSync(zedProof.extensionIndexPath, "{}\n");
      assert.match(
        classifyApplicationLoadedHostWeakness(receipt) ?? "",
        /Zed loaded-host extension index file hash changed/
      );
      writeFileSync(zedProof.extensionIndexPath, extensionIndexSource);

      const hostLogSource = readFileSync(zedProof.hostLogPath, "utf8");

      writeFileSync(zedProof.hostLogPath, "Zed started without loading DX.\n");
      assert.match(
        classifyApplicationLoadedHostWeakness(receipt) ?? "",
        /Zed loaded-host host log file hash changed/
      );
      writeFileSync(zedProof.hostLogPath, hostLogSource);

      const packageOutputSource = readFileSync(receipt.packageOutput.receiptPath, "utf8");
      const packageOutputReceipt = JSON.parse(packageOutputSource);
      packageOutputReceipt.webAssembly.sha256 = "f".repeat(64);
      const changedPackageOutputSource = `${JSON.stringify(packageOutputReceipt, null, 2)}\n`;
      writeFileSync(receipt.packageOutput.receiptPath, changedPackageOutputSource);
      assert.match(
        classifyApplicationLoadedHostWeakness({
          ...receipt,
          packageOutput: {
            ...receipt.packageOutput,
            receiptSha256: sha256(Buffer.from(changedPackageOutputSource))
          }
        }) ?? "",
        /Zed loaded-host WebAssembly hash does not match linked package-output receipt/
      );
      writeFileSync(receipt.packageOutput.receiptPath, packageOutputSource);
    }
    assert.equal(receipt.manualProof.proofFileSha256, sha256(readFileSync(receipt.manualProof.proofFilePath)));
    assert.equal(receipt.releaseClaims.loadedHostVerified, true);
    assert.equal(receipt.releaseClaims.localServiceVerified, false);
    assert.equal(receipt.releaseClaims.signingVerified, false);
    assert.equal(receipt.releaseClaims.distributionVerified, false);
    assert.equal(existsSync(receipt.receiptPath), true);
    assert.deepEqual(JSON.parse(readFileSync(receipt.receiptPath, "utf8")), receipt);
    assert.equal(classifyApplicationLoadedHostWeakness(receipt), undefined);

    assert.match(
      classifyApplicationLoadedHostWeakness({
        ...receipt,
        host: fixture.target === "sketch" ? "canva" : "sketch"
      }) ?? "",
      /application loaded-host receipt is missing adapter or host identity/
    );

    assert.match(
      classifyApplicationLoadedHostWeakness({
        ...receipt,
        hostApplication: {
          ...receipt.hostApplication,
          verificationMode: fixture.verificationMode === "sketch-plugin" ? "canva-development-app" : "sketch-plugin"
        }
      }) ?? "",
      /application loaded-host receipt has the wrong host application or verification mode/
    );

    assert.match(
      classifyApplicationLoadedHostWeakness({
        ...receipt,
        hostApplication: {
          ...receipt.hostApplication,
          hostState: "unavailable"
        }
      }) ?? "",
      /application loaded-host receipt must verify a loaded host state/
    );

    if (fixture.commandIds.length > 0) {
      assert.match(
        classifyApplicationLoadedHostWeakness({
          ...receipt,
          loadedHost: {
            ...receipt.loadedHost,
            commandIdsVisible: ["unsupported-command"],
            commandResults: [{ commandId: "unsupported-command", status: "visible" }]
          }
        }) ?? "",
        /application loaded-host receipt is missing expected command IDs/
      );
    }

    writeFileSync(receipt.manualProof.proofFilePath, `${fixture.target} loaded-host proof changed.\n`);
    assert.match(
      classifyApplicationLoadedHostWeakness(receipt) ?? "",
      /application loaded-host manual proof file hash changed/
    );

    writeFileSync(receipt.manualProof.proofFilePath, `${fixture.target} proof\n`);
    const packageOutputReceiptSource = readFileSync(receipt.packageOutput.receiptPath, "utf8");
    writeFileSync(receipt.packageOutput.receiptPath, "{}\n");
    assert.match(
      classifyApplicationLoadedHostWeakness(receipt) ?? "",
      /application loaded-host linked package-output receipt hash changed/
    );

    writeFileSync(receipt.packageOutput.receiptPath, packageOutputReceiptSource);

    writeFileSync(receipt.hostApplication.executablePath, `${fixture.target} host executable changed.\n`);
    assert.match(
      classifyApplicationLoadedHostWeakness(receipt) ?? "",
      /application loaded-host host executable hash changed/
    );
    writeFileSync(receipt.hostApplication.executablePath, `${fixture.hostApplication}\n`);
  }

  const blenderAddonReceipt = JSON.parse(
    readFileSync(receiptPathFor("dx.blender.command-center", "addon-install-latest.json"), "utf8")
  );
  assert.equal(blenderAddonReceipt.receipt, "dx.extension.blender.addon_install");
  assert.equal(blenderAddonReceipt.releaseClaims.addonInstallVerified, true);
  assert.equal(blenderAddonReceipt.releaseClaims.distributionVerified, false);
  assert.equal(classifySpecialProofWeakness("addon_install", blenderAddonReceipt), undefined);

  const blenderLoadedHostReceiptSource = readFileSync(blenderAddonReceipt.loadedHostReceiptPath, "utf8");
  writeFileSync(blenderAddonReceipt.loadedHostReceiptPath, "{}\n");
  assert.match(
    classifySpecialProofWeakness("addon_install", blenderAddonReceipt) ?? "",
    /Blender add-on install loaded-host receipt hash changed/
  );

  writeFileSync(blenderAddonReceipt.loadedHostReceiptPath, blenderLoadedHostReceiptSource);

  const sketchtoolReceipt = JSON.parse(
    readFileSync(receiptPathFor("dx.sketch.command-center", "sketchtool-latest.json"), "utf8")
  );
  assert.equal(sketchtoolReceipt.receipt, "dx.extension.sketch.sketchtool_run");
  assert.equal(sketchtoolReceipt.releaseClaims.sketchtoolVerified, true);
  assert.equal(sketchtoolReceipt.releaseClaims.distributionVerified, false);
  assert.equal(classifySpecialProofWeakness("sketchtool_run", sketchtoolReceipt), undefined);

  writeFileSync(sketchtoolReceipt.sketchtool.path, "changed sketchtool\n");
  assert.match(
    classifySpecialProofWeakness("sketchtool_run", sketchtoolReceipt) ?? "",
    /Sketch sketchtool file hash changed/
  );

  const zedFixture = fixtures[0];
  assert.throws(
    () =>
      writeApplicationLoadedHostReceipt(workspaceRoot, {
        proof: {
          ...createProof(zedFixture),
          workspaceName: "Private Workspace"
        }
      }),
    /privacy-sensitive application loaded-host proof field/
  );

  assert.throws(
    () =>
      writeApplicationLoadedHostReceipt(workspaceRoot, {
        proof: {
          ...createProof(zedFixture),
          zedDevExtension: undefined
        }
      }),
    /must include Zed dev-extension proof/
  );

  assert.throws(
    () =>
      writeApplicationLoadedHostReceipt(workspaceRoot, {
        proof: {
          ...createProof(zedFixture),
          commandIdsVisible: ["dx-status"],
          commandResults: [{ commandId: "dx-status", status: "visible" }]
        }
      }),
    /must not rely on slash-command metadata/
  );

  assert.throws(
    () =>
      writeApplicationLoadedHostReceipt(workspaceRoot, {
        proof: {
          ...createProof(fixtures[1]),
          hostState: "empty"
        }
      }),
    /must verify a loaded host state/
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("Application loaded-host receipts verified");

function createProof(fixture: ApplicationFixture): ApplicationLoadedHostProof {
  const packageOutputReceiptPath = fixture.writePackageOutputReceipt();
  const hostExecutablePath = writeWorkspaceFile(`hosts/${fixture.target}.exe`, `${fixture.hostApplication}\n`);
  const proof: ApplicationLoadedHostProof = {
    target: fixture.target,
    hostApplication: fixture.hostApplication,
    hostVersion: "2026.1.0",
    hostExecutablePath,
    packageOutputReceiptPath,
    proofFilePath: writeWorkspaceFile(`proof/${fixture.target}-loaded-host.txt`, `${fixture.target} proof\n`),
    verificationMode: fixture.verificationMode,
    loadedHostVerified: true,
    extensionInstalled: true,
    commandIdsVisible: fixture.commandIds,
    commandResults: fixture.commandIds.map((commandId) => ({
      commandId,
      status: commandId === fixture.commandIds[0] ? "visible" : "proof-blocked"
    })),
    localServiceRequestsBlocked: true,
    hostState: "loaded",
    mutatesHostDocument: false,
    ...fixture.proofFields
  } as ApplicationLoadedHostProof;

  if (fixture.target === "zed") {
    proof.zedDevExtension = createZedDevExtensionProof(hostExecutablePath);
  }

  return proof;
}

function createZedDevExtensionProof(hostExecutablePath: string) {
  const sourcePath = join(repoRoot, "hosts", "zed", "dx-zed");
  const installedPath = writeWorkspaceDirectory("LocalAppData/Zed/extensions/installed/dx-command-center");
  const extensionIndexPath = writeWorkspaceFile(
    "LocalAppData/Zed/extensions/index.json",
    JSON.stringify(
      {
        devExtensions: [
          {
            id: "dx-command-center",
            sourcePath,
            installedPath
          }
        ]
      },
      null,
      2
    )
  );
  const hostLogPath = writeWorkspaceFile(
    "LocalAppData/Zed/logs/zed.log",
    `Loaded dev extension dx-command-center from ${sourcePath}\n`
  );

  return {
    sourcePath,
    installedPath,
    installedPathLinksToSource: true,
    extensionIndexPath,
    extensionIndexContainsDevExtension: true,
    hostLogPath,
    hostLogReferencesExtension: true,
    wasmArtifactPath: join(sourcePath, "extension.wasm"),
    wasmArtifactSha256: zedWasmSha256(),
    hostExecutableSha256: sha256(readFileSync(hostExecutablePath))
  };
}

function receiptPathFor(adapterId: string, receiptName: string): string {
  return join(workspaceRoot, ".dx", "receipts", "extensions", adapterId, receiptName);
}

function writeWorkspaceFile(relativePath: string, source: string): string {
  const absolutePath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);

  return absolutePath;
}

function writeWorkspaceDirectory(relativePath: string): string {
  const absolutePath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(absolutePath, { recursive: true });

  return absolutePath;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function zedWasmSha256(): string {
  return sha256(readFileSync(join(repoRoot, "hosts", "zed", "dx-zed", "extension.wasm")));
}
