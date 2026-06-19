import {
  type OperatorProofTemplateDefinition,
  checklist,
  proofBlockedResults
} from "./operator-proof-template-model.ts";

interface AdobeUxpHostConfig {
  adapterId: string;
  ccxPackageTemplateId:
    | "adobe-photoshop-ccx-package"
    | "adobe-premiere-pro-ccx-package"
    | "adobe-indesign-ccx-package";
  commandIds: string[];
  host: "photoshop" | "premiere-pro" | "indesign";
  hostApplication: string;
  hostExecutablePlaceholder: string;
  hostVersionPlaceholder: string;
  loadedHostTemplateId:
    | "adobe-photoshop-loaded-host"
    | "adobe-premiere-pro-loaded-host"
    | "adobe-indesign-loaded-host";
  manifestId: string;
  pluginIdTemplateId:
    | "adobe-photoshop-plugin-id"
    | "adobe-premiere-pro-plugin-id"
    | "adobe-indesign-plugin-id";
}

interface AdobeNativePluginConfig extends AdobeUxpHostConfig {
  artifactPlaceholder: string;
  nativePluginTemplateId: "adobe-premiere-pro-native-plugin" | "adobe-indesign-native-plugin";
  sdkName: string;
  sdkVersionPlaceholder: string;
}

const adobeEntrypointIds = ["dxCommandCenterPanel", "dxShowReceipts", "dxShowStatus"];
const photoshopConfig: AdobeUxpHostConfig = {
  adapterId: "dx.photoshop.command-center",
  ccxPackageTemplateId: "adobe-photoshop-ccx-package",
  commandIds: [
    "dx.photoshop.show_status",
    "dx.photoshop.search_assets",
    "dx.photoshop.copy_receipts_path"
  ],
  host: "photoshop",
  hostApplication: "Photoshop",
  hostExecutablePlaceholder: "REPLACE_WITH_ABSOLUTE_PHOTOSHOP_EXECUTABLE_PATH",
  hostVersionPlaceholder: "REPLACE_WITH_PHOTOSHOP_VERSION",
  loadedHostTemplateId: "adobe-photoshop-loaded-host",
  manifestId: "dx.photoshop.command-center.development",
  pluginIdTemplateId: "adobe-photoshop-plugin-id"
};
const premiereProConfig: AdobeNativePluginConfig = {
  adapterId: "dx.premiere-pro.command-center",
  artifactPlaceholder: "REPLACE_WITH_ABSOLUTE_PRM_PATH",
  ccxPackageTemplateId: "adobe-premiere-pro-ccx-package",
  commandIds: [
    "dx.premiere-pro.show_status",
    "dx.premiere-pro.search_media_assets",
    "dx.premiere-pro.show_receipts"
  ],
  host: "premiere-pro",
  hostApplication: "Premiere Pro",
  hostExecutablePlaceholder: "REPLACE_WITH_ABSOLUTE_PREMIERE_PRO_EXECUTABLE_PATH",
  hostVersionPlaceholder: "REPLACE_WITH_PREMIERE_PRO_VERSION",
  loadedHostTemplateId: "adobe-premiere-pro-loaded-host",
  manifestId: "dx.premiere-pro.command-center.development",
  nativePluginTemplateId: "adobe-premiere-pro-native-plugin",
  pluginIdTemplateId: "adobe-premiere-pro-plugin-id",
  sdkName: "Premiere Pro SDK",
  sdkVersionPlaceholder: "REPLACE_WITH_PREMIERE_PRO_SDK_VERSION"
};
const indesignConfig: AdobeNativePluginConfig = {
  adapterId: "dx.indesign.command-center",
  artifactPlaceholder: "REPLACE_WITH_ABSOLUTE_IDPLN_PATH",
  ccxPackageTemplateId: "adobe-indesign-ccx-package",
  commandIds: [
    "dx.indesign.show_status",
    "dx.indesign.search_assets",
    "dx.indesign.show_receipts"
  ],
  host: "indesign",
  hostApplication: "InDesign",
  hostExecutablePlaceholder: "REPLACE_WITH_ABSOLUTE_INDESIGN_EXECUTABLE_PATH",
  hostVersionPlaceholder: "REPLACE_WITH_INDESIGN_VERSION",
  loadedHostTemplateId: "adobe-indesign-loaded-host",
  manifestId: "dx.indesign.command-center.development",
  nativePluginTemplateId: "adobe-indesign-native-plugin",
  pluginIdTemplateId: "adobe-indesign-plugin-id",
  sdkName: "InDesign SDK",
  sdkVersionPlaceholder: "REPLACE_WITH_INDESIGN_SDK_VERSION"
};

export const adobeOperatorProofTemplates: OperatorProofTemplateDefinition[] = [
  createLoadedHostTemplate(photoshopConfig),
  createPluginIdTemplate(photoshopConfig),
  createCcxPackageTemplate(photoshopConfig),
  createLoadedHostTemplate(premiereProConfig),
  createPluginIdTemplate(premiereProConfig),
  createCcxPackageTemplate(premiereProConfig),
  createNativePluginTemplate(premiereProConfig),
  createLoadedHostTemplate(indesignConfig),
  createPluginIdTemplate(indesignConfig),
  createCcxPackageTemplate(indesignConfig),
  createNativePluginTemplate(indesignConfig)
];

function createLoadedHostTemplate(config: AdobeUxpHostConfig): OperatorProofTemplateDefinition {
  return {
    id: config.loadedHostTemplateId,
    adapterId: config.adapterId,
    host: config.host,
    receiptWriter: {
      script: "scripts/write-creative-loaded-host-receipts.ts",
      outputReceipt: "loaded-host-latest.json"
    },
    evidenceChecklist: [
      checklist("hostVersion", `Capture the loaded ${config.hostApplication} version.`),
      checklist("hostExecutablePath", `Record the absolute ${config.hostApplication} executable path.`),
      checklist("packageOutputReceiptPath", `Link the current ${config.hostApplication} UXP package-output receipt.`),
      checklist("proofFilePath", "Attach a metadata-only manual proof file."),
      checklist("uxpDeveloperToolPath", "Record the absolute UXP Developer Tool path."),
      checklist("developerToolVerified", "Verify the UXP Developer Tool loaded the plugin."),
      checklist("pluginLoaded", `Verify the DX UXP plugin loaded in ${config.hostApplication}.`),
      checklist("panelRendered", "Verify the command-center panel rendered."),
      checklist("uxpManifestId", "Record the UXP manifest id from the loaded package."),
      checklist("entrypointsVisible", "Record visible UXP panel and command entrypoints."),
      checklist("commandResults", "Record visible or proof-blocked command metadata for every required command."),
      checklist("localServiceRequestsBlocked", "Confirm local-service requests stayed blocked until explicit proof.")
    ],
    proof: {
      target: config.host,
      hostApplication: config.hostApplication,
      hostVersion: config.hostVersionPlaceholder,
      hostExecutablePath: config.hostExecutablePlaceholder,
      packageOutputReceiptPath: "REPLACE_WITH_ABSOLUTE_PACKAGE_OUTPUT_RECEIPT_PATH",
      proofFilePath: "REPLACE_WITH_ABSOLUTE_MANUAL_PROOF_FILE_PATH",
      verificationMode: "uxp-developer-tool",
      loadedHostVerified: false,
      commandIdsVisible: sortedCommandIds(config.commandIds),
      commandResults: proofBlockedResults(config.commandIds),
      localServiceRequestsBlocked: false,
      hostState: "unavailable",
      uxpDeveloperToolPath: "REPLACE_WITH_ABSOLUTE_UXP_DEVELOPER_TOOL_PATH",
      developerToolVerified: false,
      pluginLoaded: false,
      panelRendered: false,
      uxpManifestId: config.manifestId,
      entrypointsVisible: [...adobeEntrypointIds]
    }
  };
}

function createPluginIdTemplate(config: AdobeUxpHostConfig): OperatorProofTemplateDefinition {
  return {
    id: config.pluginIdTemplateId,
    adapterId: config.adapterId,
    host: config.host,
    receiptWriter: {
      script: "scripts/write-adobe-uxp-plugin-id-receipt.ts",
      outputReceipt: "plugin-id-latest.json"
    },
    evidenceChecklist: [
      checklist("loadedHostReceiptPath", `Link the verified ${config.hostApplication} loaded-host receipt.`),
      checklist("proofFilePath", "Attach the Adobe Developer Console metadata proof file."),
      checklist("developerConsolePluginId", "Record the Developer Console plugin id."),
      checklist("developerConsolePluginIdVerified", "Verify the Developer Console plugin id matches the loaded UXP manifest."),
      checklist("developerConsoleProjectVerified", "Verify the Developer Console project metadata without account details."),
      checklist("marketplaceListingState", "Record draft, submitted, or published listing state.")
    ],
    proof: {
      adapterId: config.adapterId,
      host: config.host,
      loadedHostReceiptPath: "REPLACE_WITH_ABSOLUTE_LOADED_HOST_RECEIPT_PATH",
      proofFilePath: "REPLACE_WITH_ABSOLUTE_DEVELOPER_CONSOLE_PROOF_FILE_PATH",
      developerConsolePluginId: config.manifestId,
      developerConsolePluginIdVerified: false,
      developerConsoleProjectVerified: false,
      marketplaceListingState: "draft"
    }
  };
}

function createCcxPackageTemplate(config: AdobeUxpHostConfig): OperatorProofTemplateDefinition {
  return {
    id: config.ccxPackageTemplateId,
    adapterId: config.adapterId,
    host: config.host,
    receiptWriter: {
      script: "scripts/write-adobe-ccx-package-receipts.ts",
      outputReceipt: "ccx-package-latest.json"
    },
    evidenceChecklist: [
      checklist("packageOutputReceiptPath", `Link the current ${config.hostApplication} UXP package-output receipt.`),
      checklist("ccxArtifactPath", "Record the absolute packaged CCX artifact path."),
      checklist("sourcePackageRoot", "Record the absolute source package root used for CCX packaging."),
      checklist("packagingTool", "Record the packaging tool used for the CCX artifact."),
      checklist("packagingToolVersion", "Capture the packaging tool version.")
    ],
    proof: {
      adapterId: config.adapterId,
      host: config.host,
      packageOutputReceiptPath: "REPLACE_WITH_ABSOLUTE_PACKAGE_OUTPUT_RECEIPT_PATH",
      ccxArtifactPath: "REPLACE_WITH_ABSOLUTE_CCX_ARTIFACT_PATH",
      sourcePackageRoot: "REPLACE_WITH_ABSOLUTE_SOURCE_PACKAGE_ROOT",
      packagingTool: "uxp-developer-tool",
      packagingToolVersion: "REPLACE_WITH_UXP_DEVELOPER_TOOL_VERSION"
    }
  };
}

function createNativePluginTemplate(config: AdobeNativePluginConfig): OperatorProofTemplateDefinition {
  return {
    id: config.nativePluginTemplateId,
    adapterId: config.adapterId,
    host: config.host,
    receiptWriter: {
      script: "scripts/write-creative-native-or-hybrid-plugin-receipts.ts",
      outputReceipt: "native-plugin-latest.json"
    },
    evidenceChecklist: [
      checklist("loadedHostReceiptPath", `Link the verified ${config.hostApplication} loaded-host receipt.`),
      checklist("packageOutputReceiptPath", `Link the current ${config.hostApplication} UXP package-output receipt.`),
      checklist("proofFilePath", "Attach the metadata-only native or hybrid plugin proof file."),
      checklist("nativePluginArtifactPath", `Record the absolute ${config.hostApplication} native plugin artifact path.`),
      checklist("sdkName", `Keep the SDK name as ${config.sdkName}.`),
      checklist("sdkVersion", "Capture the SDK version used for the native plugin artifact."),
      checklist("loadedByHost", `Verify the native plugin is loaded by ${config.hostApplication}.`),
      checklist("commandIdsVerified", "Record verified metadata-only command identifiers."),
      checklist("metadataOnly", "Confirm command handling remains metadata-only."),
      checklist("storesHostPayloads", "Confirm the proof stores no host payloads."),
      checklist("mutatesHostProject", "Confirm the proof does not mutate host project content."),
      checklist("mutatesHostDocument", "Confirm the proof does not mutate host document content.")
    ],
    proof: {
      adapterId: config.adapterId,
      host: config.host,
      loadedHostReceiptPath: "REPLACE_WITH_ABSOLUTE_LOADED_HOST_RECEIPT_PATH",
      packageOutputReceiptPath: "REPLACE_WITH_ABSOLUTE_PACKAGE_OUTPUT_RECEIPT_PATH",
      proofFilePath: "REPLACE_WITH_ABSOLUTE_NATIVE_PLUGIN_PROOF_FILE_PATH",
      nativePluginArtifactPath: config.artifactPlaceholder,
      pluginKind: "host-native-plugin",
      sdkName: config.sdkName,
      sdkVersion: config.sdkVersionPlaceholder,
      bridgeMode: "metadata-command-bridge",
      loadedByHost: false,
      commandIdsVerified: sortedCommandIds(config.commandIds),
      metadataOnly: true,
      storesHostPayloads: false,
      mutatesHostProject: false,
      mutatesHostDocument: false
    }
  };
}

function sortedCommandIds(commandIds: string[]): string[] {
  return [...commandIds].sort();
}
