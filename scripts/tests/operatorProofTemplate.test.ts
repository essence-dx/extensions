import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createOperatorProofTemplate,
  listOperatorProofTemplates,
  writeOperatorProofTemplateFile
} from "../lib/operator-proof-templates.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-operator-proof-template-"));
const expectedTemplateIds = [
  "browser-chrome-loaded-profile",
  "browser-edge-loaded-profile",
  "browser-firefox-loaded-profile",
  "vscode-loaded-host",
  "zed-dev-extension",
  "blender",
  "obsidian",
  "figma",
  "canva-development-app",
  "canva-cloud-service",
  "sketch",
  "adobe-photoshop-loaded-host",
  "adobe-photoshop-plugin-id",
  "adobe-photoshop-ccx-package",
  "adobe-premiere-pro-loaded-host",
  "adobe-premiere-pro-plugin-id",
  "adobe-premiere-pro-ccx-package",
  "adobe-premiere-pro-native-plugin",
  "adobe-indesign-loaded-host",
  "adobe-indesign-plugin-id",
  "adobe-indesign-ccx-package",
  "adobe-indesign-native-plugin",
  "office-excel-sideloaded-host",
  "office-powerpoint-sideloaded-host",
  "office-word-sideloaded-host",
  "office-excel-local-service",
  "office-powerpoint-local-service",
  "office-word-local-service",
  "google-workspace-deployment",
  "intellij-platform-sandbox-ide",
  "intellij-platform-plugin-verifier",
  "visual-studio-experimental-instance",
  "unity-editor-loaded-host",
  "unity-editor-project-import",
  "unreal-engine-loaded-host",
  "unreal-engine-project-enablement",
  "affinity-manual-import",
  "affinity-loaded-app",
  "affinity-photoshop-filter-plugin",
  "davinci-resolve-loaded-host",
  "davinci-resolve-developer-docs"
];
const forbiddenSerializedTerms = [
  "DX_",
  "Approved",
  "approved",
  "appSourceApproved",
  "canvaReviewVerified",
  "communityReviewVerified",
  "distributionVerified",
  "marketplaceApproved",
  "oauthReviewVerified",
  "reviewStatus"
];

try {
  const listedTemplates = listOperatorProofTemplates();

  assert.deepEqual(
    listedTemplates.map((template) => template.id),
    expectedTemplateIds
  );

  const chromeLoadedProfileTemplate = createOperatorProofTemplate("browser-chrome-loaded-profile");

  assert.equal(chromeLoadedProfileTemplate.adapterId, "dx.browser.command-center");
  assert.equal(chromeLoadedProfileTemplate.host, "browser");
  assert.equal(
    chromeLoadedProfileTemplate.receiptWriter.script,
    "scripts/write-browser-loaded-profile-proof-receipts.ts"
  );
  assert.equal(chromeLoadedProfileTemplate.receiptWriter.outputReceipt, "chrome-loaded-profile-latest.json");
  assert.equal(chromeLoadedProfileTemplate.proof.target, "chrome");
  assert.equal(
    chromeLoadedProfileTemplate.proof.browserExecutablePath,
    "REPLACE_WITH_ABSOLUTE_CHROME_EXECUTABLE_PATH"
  );
  assert.equal(chromeLoadedProfileTemplate.proof.extensionBaseUrl, "chrome-extension://REPLACE_WITH_CHROME_EXTENSION_ID/");
  assert.equal(chromeLoadedProfileTemplate.proof.loadedProfileVerified, false);
  assert.equal(chromeLoadedProfileTemplate.proof.loadedBackgroundServiceWorkerVerified, false);
  assert.equal(chromeLoadedProfileTemplate.proof.nativeHostRegistered, false);
  assert.deepEqual(
    (chromeLoadedProfileTemplate.proof.commandRoundTrips as Array<{
      commandId: string;
      handledBy: string;
      hostActionId: string;
      ok: boolean;
      receiptPath: string;
    }>).map((roundTrip) => [
      roundTrip.commandId,
      roundTrip.hostActionId,
      roundTrip.handledBy,
      roundTrip.ok,
      roundTrip.receiptPath
    ]),
    [
      [
        "status",
        "dx.browser.show_status",
        "native-host",
        false,
        ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
      ],
      [
        "forgePackages",
        "dx.browser.list_forge_packages",
        "native-host",
        false,
        ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
      ],
      [
        "showBuildGraph",
        "dx.browser.show_build_graph",
        "native-host",
        false,
        ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
      ]
    ]
  );
  assert.deepEqual(chromeLoadedProfileTemplate.proof.hostUiCommandIds, ["openReceipts"]);
  assert.deepEqual(chromeLoadedProfileTemplate.evidenceChecklist.map((item) => item.field), [
    "browserExecutablePath",
    "browserVersion",
    "profilePath",
    "extensionId",
    "extensionBaseUrl",
    "packageOutputReceiptPath",
    "nativeHostPackageReceiptPath",
    "nativeHostManifestPath",
    "nativeHostName",
    "loadedProfileVerified",
    "loadedBackgroundServiceWorkerVerified",
    "nativeHostRegistered",
    "commandRoundTrips",
    "hostUiCommandIds"
  ]);

  const vsCodeLoadedHostTemplate = createOperatorProofTemplate("vscode-loaded-host");

  assert.equal(vsCodeLoadedHostTemplate.adapterId, "dx.vscode.command-center");
  assert.equal(vsCodeLoadedHostTemplate.host, "vscode");
  assert.equal(
    vsCodeLoadedHostTemplate.receiptWriter.script,
    "scripts/write-vscode-loaded-host-proof-receipts.ts"
  );
  assert.equal(vsCodeLoadedHostTemplate.receiptWriter.outputReceipt, "vscode-loaded-host-latest.json");
  assert.equal(vsCodeLoadedHostTemplate.proof.extensionId, "dx-runtime.dx-vscode");
  assert.equal(vsCodeLoadedHostTemplate.proof.extensionDevelopmentHostVerified, false);
  assert.equal(vsCodeLoadedHostTemplate.proof.storesProcessOutput, false);
  assert.deepEqual(vsCodeLoadedHostTemplate.proof.commandIds, [
    "dx.openCommandCenter",
    "dx.copyReceiptsPath",
    "dx.doctor",
    "dx.listForgePackages",
    "dx.openReceipts",
    "dx.searchIcons",
    "dx.showBuildGraph",
    "dx.showCheckEditorState",
    "dx.showLatestCheckReceipt",
    "dx.showStatus"
  ]);
  assert.deepEqual(vsCodeLoadedHostTemplate.evidenceChecklist.map((item) => item.field), [
    "vscodeExecutablePath",
    "vscodeVersion",
    "packageOutputReceiptPath",
    "workspacePath",
    "proofFilePath",
    "extensionDevelopmentHostVerified",
    "commandIds",
    "storesProcessOutput"
  ]);

  const edgeLoadedProfileTemplate = createOperatorProofTemplate("browser-edge-loaded-profile");

  assert.equal(edgeLoadedProfileTemplate.receiptWriter.outputReceipt, "edge-loaded-profile-latest.json");
  assert.equal(edgeLoadedProfileTemplate.proof.target, "edge");
  assert.equal(edgeLoadedProfileTemplate.proof.extensionBaseUrl, "chrome-extension://REPLACE_WITH_EDGE_EXTENSION_ID/");

  const firefoxLoadedProfileTemplate = createOperatorProofTemplate("browser-firefox-loaded-profile");

  assert.equal(firefoxLoadedProfileTemplate.receiptWriter.outputReceipt, "firefox-loaded-profile-latest.json");
  assert.equal(firefoxLoadedProfileTemplate.proof.target, "firefox");
  assert.equal(
    firefoxLoadedProfileTemplate.proof.extensionBaseUrl,
    "moz-extension://REPLACE_WITH_FIREFOX_EXTENSION_ID/"
  );

  const figmaTemplate = createOperatorProofTemplate("figma");

  assert.equal(figmaTemplate.template, "dx.extension.operator_proof_template");
  assert.equal(figmaTemplate.id, "figma");
  assert.equal(figmaTemplate.adapterId, "dx.figma.command-center");
  assert.equal(figmaTemplate.host, "figma");
  assert.equal(figmaTemplate.receiptWriter.script, "scripts/write-figma-loaded-host-receipts.ts");
  assert.equal(figmaTemplate.receiptWriter.outputReceipt, "loaded-host-latest.json");
  assert.deepEqual(figmaTemplate.receiptWriter.outputReceipts, [
    "loaded-host-latest.json",
    "plugin-id-latest.json"
  ]);
  assert.equal(figmaTemplate.status.validReceiptInput, false);
  assert.equal(figmaTemplate.status.operatorActionRequired, true);
  assert.equal(figmaTemplate.proof.loadedHostVerified, false);
  assert.equal(figmaTemplate.proof.pluginIdVerified, false);
  assert.equal(figmaTemplate.proof.hostExecutablePath, "REPLACE_WITH_ABSOLUTE_FIGMA_EXECUTABLE_PATH");
  assert.deepEqual(figmaTemplate.evidenceChecklist.map((item) => item.field), [
    "hostVersion",
    "hostExecutablePath",
    "packageOutputReceiptPath",
    "proofFilePath",
    "manifestPluginId",
    "pluginUiRendered",
    "menuCommandsVisible",
    "commandResults"
  ]);

  const canvaServiceTemplate = createOperatorProofTemplate("canva-cloud-service");

  assert.equal(canvaServiceTemplate.adapterId, "dx.canva.command-center");
  assert.equal(canvaServiceTemplate.host, "canva");
  assert.equal(canvaServiceTemplate.proof.cloudServiceVerified, false);
  assert.equal(canvaServiceTemplate.proof.serviceTransport, "https");
  assert.equal(canvaServiceTemplate.proof.storesDesignPayloads, false);
  assert.equal(
    canvaServiceTemplate.receiptWriter.script,
    "scripts/write-canva-cloud-service-receipt.ts"
  );

  const davinciTemplate = createOperatorProofTemplate("davinci-resolve-loaded-host");

  assert.equal(davinciTemplate.adapterId, "dx.davinci-resolve.command-center");
  assert.deepEqual(davinciTemplate.receiptWriter.outputReceipts, [
    "loaded-host-latest.json",
    "workflow-integration-latest.json"
  ]);
  assert.equal(davinciTemplate.proof.loadedResolveVerified, false);
  assert.equal(davinciTemplate.proof.workflowIntegrationVerified, false);
  assert.equal(davinciTemplate.proof.mutatesResolveProject, false);

  const photoshopLoadedHostTemplate = createOperatorProofTemplate("adobe-photoshop-loaded-host" as never);

  assert.equal(photoshopLoadedHostTemplate.adapterId, "dx.photoshop.command-center");
  assert.equal(photoshopLoadedHostTemplate.host, "photoshop");
  assert.equal(
    photoshopLoadedHostTemplate.receiptWriter.script,
    "scripts/write-creative-loaded-host-receipts.ts"
  );
  assert.equal(photoshopLoadedHostTemplate.receiptWriter.outputReceipt, "loaded-host-latest.json");
  assert.equal(photoshopLoadedHostTemplate.proof.target, "photoshop");
  assert.equal(photoshopLoadedHostTemplate.proof.verificationMode, "uxp-developer-tool");
  assert.equal(photoshopLoadedHostTemplate.proof.uxpManifestId, "dx.photoshop.command-center.development");
  assert.equal(photoshopLoadedHostTemplate.proof.pluginLoaded, false);
  assert.equal(photoshopLoadedHostTemplate.proof.panelRendered, false);
  assert.deepEqual(photoshopLoadedHostTemplate.proof.entrypointsVisible, [
    "dxCommandCenterPanel",
    "dxShowReceipts",
    "dxShowStatus"
  ]);

  const photoshopCcxPackageTemplate = createOperatorProofTemplate("adobe-photoshop-ccx-package" as never);

  assert.equal(photoshopCcxPackageTemplate.adapterId, "dx.photoshop.command-center");
  assert.equal(photoshopCcxPackageTemplate.host, "photoshop");
  assert.equal(
    photoshopCcxPackageTemplate.receiptWriter.script,
    "scripts/write-adobe-ccx-package-receipts.ts"
  );
  assert.equal(photoshopCcxPackageTemplate.receiptWriter.outputReceipt, "ccx-package-latest.json");
  assert.deepEqual(photoshopCcxPackageTemplate.evidenceChecklist.map((item) => item.field), [
    "packageOutputReceiptPath",
    "ccxArtifactPath",
    "sourcePackageRoot",
    "packagingTool",
    "packagingToolVersion"
  ]);
  assert.deepEqual(photoshopCcxPackageTemplate.proof, {
    adapterId: "dx.photoshop.command-center",
    host: "photoshop",
    packageOutputReceiptPath: "REPLACE_WITH_ABSOLUTE_PACKAGE_OUTPUT_RECEIPT_PATH",
    ccxArtifactPath: "REPLACE_WITH_ABSOLUTE_CCX_ARTIFACT_PATH",
    sourcePackageRoot: "REPLACE_WITH_ABSOLUTE_SOURCE_PACKAGE_ROOT",
    packagingTool: "uxp-developer-tool",
    packagingToolVersion: "REPLACE_WITH_UXP_DEVELOPER_TOOL_VERSION"
  });

  const premierePluginIdTemplate = createOperatorProofTemplate("adobe-premiere-pro-plugin-id" as never);

  assert.equal(premierePluginIdTemplate.adapterId, "dx.premiere-pro.command-center");
  assert.equal(premierePluginIdTemplate.host, "premiere-pro");
  assert.equal(premierePluginIdTemplate.receiptWriter.script, "scripts/write-adobe-uxp-plugin-id-receipt.ts");
  assert.equal(premierePluginIdTemplate.receiptWriter.outputReceipt, "plugin-id-latest.json");
  assert.equal(
    premierePluginIdTemplate.proof.developerConsolePluginId,
    "dx.premiere-pro.command-center.development"
  );
  assert.equal(premierePluginIdTemplate.proof.developerConsolePluginIdVerified, false);
  assert.equal(premierePluginIdTemplate.proof.developerConsoleProjectVerified, false);
  assert.equal(premierePluginIdTemplate.proof.marketplaceListingState, "draft");

  const premiereCcxPackageTemplate = createOperatorProofTemplate("adobe-premiere-pro-ccx-package" as never);

  assert.equal(premiereCcxPackageTemplate.adapterId, "dx.premiere-pro.command-center");
  assert.equal(premiereCcxPackageTemplate.host, "premiere-pro");
  assert.equal(premiereCcxPackageTemplate.receiptWriter.script, "scripts/write-adobe-ccx-package-receipts.ts");
  assert.equal(premiereCcxPackageTemplate.receiptWriter.outputReceipt, "ccx-package-latest.json");
  assert.equal(premiereCcxPackageTemplate.proof.host, "premiere-pro");
  assert.equal(premiereCcxPackageTemplate.proof.packagingTool, "uxp-developer-tool");

  const indesignNativePluginTemplate = createOperatorProofTemplate("adobe-indesign-native-plugin" as never);

  assert.equal(indesignNativePluginTemplate.adapterId, "dx.indesign.command-center");
  assert.equal(indesignNativePluginTemplate.host, "indesign");
  assert.equal(
    indesignNativePluginTemplate.receiptWriter.script,
    "scripts/write-creative-native-or-hybrid-plugin-receipts.ts"
  );
  assert.equal(indesignNativePluginTemplate.receiptWriter.outputReceipt, "native-plugin-latest.json");
  assert.equal(indesignNativePluginTemplate.proof.nativePluginArtifactPath, "REPLACE_WITH_ABSOLUTE_IDPLN_PATH");
  assert.equal(indesignNativePluginTemplate.proof.pluginKind, "host-native-plugin");
  assert.equal(indesignNativePluginTemplate.proof.sdkName, "InDesign SDK");
  assert.equal(indesignNativePluginTemplate.proof.bridgeMode, "metadata-command-bridge");
  assert.equal(indesignNativePluginTemplate.proof.loadedByHost, false);
  assert.equal(indesignNativePluginTemplate.proof.metadataOnly, true);
  assert.equal(indesignNativePluginTemplate.proof.mutatesHostDocument, false);

  const indesignCcxPackageTemplate = createOperatorProofTemplate("adobe-indesign-ccx-package" as never);

  assert.equal(indesignCcxPackageTemplate.adapterId, "dx.indesign.command-center");
  assert.equal(indesignCcxPackageTemplate.host, "indesign");
  assert.equal(indesignCcxPackageTemplate.receiptWriter.script, "scripts/write-adobe-ccx-package-receipts.ts");
  assert.equal(indesignCcxPackageTemplate.receiptWriter.outputReceipt, "ccx-package-latest.json");
  assert.equal(indesignCcxPackageTemplate.proof.host, "indesign");
  assert.equal(indesignCcxPackageTemplate.proof.packagingToolVersion, "REPLACE_WITH_UXP_DEVELOPER_TOOL_VERSION");

  const excelSideloadTemplate = createOperatorProofTemplate("office-excel-sideloaded-host");

  assert.equal(excelSideloadTemplate.adapterId, "dx.excel.command-center");
  assert.equal(excelSideloadTemplate.host, "excel");
  assert.equal(excelSideloadTemplate.receiptWriter.script, "scripts/write-office-sideloaded-host-receipts.ts");
  assert.equal(excelSideloadTemplate.receiptWriter.outputReceipt, "sideloaded-host-latest.json");
  assert.equal(excelSideloadTemplate.proof.host, "excel");
  assert.equal(excelSideloadTemplate.proof.officeApplication, "Excel");
  assert.equal(excelSideloadTemplate.proof.taskpaneLoaded, false);
  assert.equal(excelSideloadTemplate.proof.localServiceRequestsBlocked, false);
  assert.deepEqual(excelSideloadTemplate.proof.commandIdsVisible, [
    "dx.excel.copy_receipts_path",
    "dx.excel.search_assets",
    "dx.excel.show_status"
  ]);
  assert.deepEqual(excelSideloadTemplate.evidenceChecklist.map((item) => item.field), [
    "officeVersion",
    "packageOutputReceiptPath",
    "sideloadManifestPath",
    "taskpaneUrl",
    "proofFilePath",
    "taskpaneLoaded",
    "commandResults"
  ]);

  const wordLocalServiceTemplate = createOperatorProofTemplate("office-word-local-service");

  assert.equal(wordLocalServiceTemplate.adapterId, "dx.word.command-center");
  assert.equal(wordLocalServiceTemplate.receiptWriter.script, "scripts/write-office-local-service-receipts.ts");
  assert.equal(wordLocalServiceTemplate.receiptWriter.outputReceipt, "local-service-latest.json");
  assert.equal(wordLocalServiceTemplate.proof.host, "word");
  assert.equal(wordLocalServiceTemplate.proof.officeApplication, "Word");
  assert.equal(wordLocalServiceTemplate.proof.localServiceTransport, "loopback");
  assert.equal(wordLocalServiceTemplate.proof.localServiceConnected, false);
  assert.deepEqual(
    (wordLocalServiceTemplate.proof.requests as Array<{ command: string; operation: string }>).map((request) => [
      request.command,
      request.operation
    ]),
    [
      ["dx.word.show_status", "dx.status"],
      ["dx.word.search_assets", "dx.assets.search"]
    ]
  );

  const googleWorkspaceTemplate = createOperatorProofTemplate("google-workspace-deployment");

  assert.equal(googleWorkspaceTemplate.adapterId, "dx.google-workspace.command-center");
  assert.equal(googleWorkspaceTemplate.host, "google-workspace");
  assert.equal(
    googleWorkspaceTemplate.receiptWriter.script,
    "scripts/write-google-workspace-deployment-receipts.ts"
  );
  assert.equal(googleWorkspaceTemplate.receiptWriter.outputReceipt, "workspace-file-smoke-latest.json");
  assert.deepEqual(googleWorkspaceTemplate.receiptWriter.outputReceipts, [
    "apps-script-deployment-latest.json",
    "cloud-service-latest.json",
    "workspace-file-smoke-latest.json"
  ]);
  assert.equal(googleWorkspaceTemplate.proof.appsScriptDeploymentVerified, false);
  assert.equal(googleWorkspaceTemplate.proof.cloudServiceVerified, false);
  assert.equal(googleWorkspaceTemplate.proof.workspaceFileSmokeVerified, false);
  assert.equal(googleWorkspaceTemplate.proof.serviceTransport, "https");
  assert.deepEqual(googleWorkspaceTemplate.proof.oauthScopes, []);
  assert.equal(googleWorkspaceTemplate.proof.mutatesWorkspaceFile, false);
  assert.equal(googleWorkspaceTemplate.proof.storesWorkspacePayloads, false);

  const intellijSandboxTemplate = createOperatorProofTemplate("intellij-platform-sandbox-ide");

  assert.equal(intellijSandboxTemplate.adapterId, "dx.intellij-platform.command-center");
  assert.equal(intellijSandboxTemplate.host, "intellij-platform");
  assert.equal(
    intellijSandboxTemplate.receiptWriter.script,
    "scripts/write-ide-game-engine-loaded-host-receipts.ts"
  );
  assert.equal(intellijSandboxTemplate.receiptWriter.outputReceipt, "sandbox-ide-latest.json");
  assert.equal(intellijSandboxTemplate.proof.target, "intellij-platform");
  assert.equal(intellijSandboxTemplate.proof.hostApplication, "IntelliJ IDEA");
  assert.equal(intellijSandboxTemplate.proof.verificationMode, "sandbox-ide");
  assert.equal(intellijSandboxTemplate.proof.loadedHostVerified, false);
  assert.equal(intellijSandboxTemplate.proof.extensionInstalled, false);
  assert.equal(intellijSandboxTemplate.proof.localServiceRequestsBlocked, false);
  assert.equal(intellijSandboxTemplate.proof.projectState, "unavailable");
  assert.deepEqual(intellijSandboxTemplate.proof.commandIdsVisible, [
    "dx.intellij-platform.search_assets",
    "dx.intellij-platform.show_receipts",
    "dx.intellij-platform.show_status"
  ]);
  assert.deepEqual(intellijSandboxTemplate.proof.commandResults, [
    {
      commandId: "dx.intellij-platform.search_assets",
      operation: "dx.assets.search",
      transport: "local-service",
      status: "proof-blocked"
    },
    {
      commandId: "dx.intellij-platform.show_receipts",
      operation: "receipt.showPath",
      transport: "host-ui",
      status: "visible"
    },
    {
      commandId: "dx.intellij-platform.show_status",
      operation: "dx.status",
      transport: "local-service",
      status: "proof-blocked"
    }
  ]);

  const visualStudioTemplate = createOperatorProofTemplate("visual-studio-experimental-instance");

  assert.equal(visualStudioTemplate.adapterId, "dx.visual-studio.command-center");
  assert.equal(visualStudioTemplate.host, "visual-studio");
  assert.equal(visualStudioTemplate.receiptWriter.outputReceipt, "experimental-instance-latest.json");
  assert.equal(visualStudioTemplate.proof.target, "visual-studio");
  assert.equal(visualStudioTemplate.proof.hostApplication, "Visual Studio");
  assert.equal(visualStudioTemplate.proof.verificationMode, "experimental-instance");
  assert.equal(visualStudioTemplate.proof.projectState, "unavailable");

  const intellijPluginVerifierTemplate = createOperatorProofTemplate("intellij-platform-plugin-verifier");

  assert.equal(intellijPluginVerifierTemplate.receiptWriter.script, "scripts/write-ide-game-engine-special-proof-receipts.ts");
  assert.equal(intellijPluginVerifierTemplate.receiptWriter.outputReceipt, "plugin-verifier-latest.json");
  assert.equal(intellijPluginVerifierTemplate.proof.target, "intellij-platform");
  assert.deepEqual(intellijPluginVerifierTemplate.proof.pluginVerifier, {
    toolVersion: "REPLACE_WITH_PLUGIN_VERIFIER_VERSION",
    ideVersions: [],
    compatible: false,
    problems: [],
    warnings: []
  });

  const unityLoadedHostTemplate = createOperatorProofTemplate("unity-editor-loaded-host");

  assert.equal(unityLoadedHostTemplate.adapterId, "dx.unity-editor.command-center");
  assert.equal(unityLoadedHostTemplate.host, "unity-editor");
  assert.equal(unityLoadedHostTemplate.receiptWriter.outputReceipt, "loaded-host-latest.json");
  assert.equal(unityLoadedHostTemplate.proof.target, "unity-editor");
  assert.equal(unityLoadedHostTemplate.proof.hostApplication, "Unity Editor");
  assert.equal(unityLoadedHostTemplate.proof.verificationMode, "loaded-editor");

  const blenderTemplate = createOperatorProofTemplate("blender");

  assert.deepEqual(blenderTemplate.receiptWriter.outputReceipts, [
    "loaded-host-latest.json",
    "addon-install-latest.json"
  ]);

  const sketchTemplate = createOperatorProofTemplate("sketch");

  assert.deepEqual(sketchTemplate.receiptWriter.outputReceipts, [
    "loaded-host-latest.json",
    "sketchtool-latest.json"
  ]);

  const unityProjectImportTemplate = createOperatorProofTemplate("unity-editor-project-import");

  assert.equal(unityProjectImportTemplate.receiptWriter.outputReceipt, "project-import-latest.json");
  assert.equal(unityProjectImportTemplate.proof.target, "unity-editor");
  assert.deepEqual(unityProjectImportTemplate.proof.projectImport, {
    unityVersion: "REPLACE_WITH_UNITY_VERSION",
    packageName: "dev.dx.unity-command-center",
    packageVersion: "REPLACE_WITH_PACKAGE_VERSION",
    testProjectKind: "empty-project",
    imported: false,
    compileStatus: "not-run",
    editorTestsStatus: "not-run",
    assetDatabaseRefreshed: false,
    mutatesProjectAssets: false
  });

  const unrealLoadedHostTemplate = createOperatorProofTemplate("unreal-engine-loaded-host");

  assert.equal(unrealLoadedHostTemplate.adapterId, "dx.unreal-engine.command-center");
  assert.equal(unrealLoadedHostTemplate.host, "unreal-engine");
  assert.equal(unrealLoadedHostTemplate.proof.target, "unreal-engine");
  assert.equal(unrealLoadedHostTemplate.proof.hostApplication, "Unreal Editor");

  const unrealProjectEnablementTemplate = createOperatorProofTemplate("unreal-engine-project-enablement");

  assert.equal(unrealProjectEnablementTemplate.receiptWriter.outputReceipt, "project-enablement-latest.json");
  assert.equal(unrealProjectEnablementTemplate.proof.target, "unreal-engine");
  assert.deepEqual(unrealProjectEnablementTemplate.proof.projectEnablement, {
    engineVersion: "REPLACE_WITH_UNREAL_ENGINE_VERSION",
    pluginModuleName: "DXUnrealCommandCenterEditor",
    testProjectKind: "empty-sample-project",
    pluginEnabled: false,
    editorModuleLoaded: false,
    automationTestsStatus: "not-run",
    mutatesProjectContent: false
  });

  for (const template of listedTemplates.map((item) => createOperatorProofTemplate(item.id))) {
    const serialized = JSON.stringify(template);

    for (const forbiddenTerm of forbiddenSerializedTerms) {
      assert.equal(
        serialized.includes(forbiddenTerm),
        false,
        `${template.id} template must not include ${forbiddenTerm}`
      );
    }

    assert.equal(template.status.validReceiptInput, false);
    assert.equal(template.status.operatorActionRequired, true);
    assert.ok(template.evidenceChecklist.length > 0, `${template.id} must tell the operator what to capture`);
  }

  const outputPath = join(workspaceRoot, "operator-proof", "figma-proof-template.json");
  const written = writeOperatorProofTemplateFile({
    id: "figma",
    outputPath,
    generatedAt: "2026-06-09T00:00:00.000Z"
  });

  assert.equal(written.outputPath, outputPath);
  assert.equal(existsSync(outputPath), true);
  assert.deepEqual(JSON.parse(readFileSync(outputPath, "utf8")), written.template);
  assert.equal(existsSync(join(workspaceRoot, ".dx")), false);

  assert.throws(() => createOperatorProofTemplate("photoshop" as never), /Unsupported operator proof template/);
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("Operator proof templates verified");
