import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  classifyApplicationLoadedHostWeakness,
  classifyCreativeLoadedHostWeakness,
  classifyFigmaLoadedHostWeakness,
  classifyIdeGameEngineLoadedHostWeakness
} from "./release-evidence-loaded-application-host-classifier.ts";
import {
  classifyGoogleWorkspaceCloudServiceWeakness,
  classifyGoogleWorkspaceDeploymentWeakness
} from "./release-evidence-google-workspace-classifier.ts";
import {
  classifyCurrentFileProofWeakness,
  classifyCurrentSha256FileProofWeakness,
  classifyLinkedPackageOutputWeakness,
  classifyLinkedReceiptWeakness,
  classifyManualProofWeakness
} from "./release-evidence-linked-proof-freshness.ts";
import {
  classifyAffinityLoadedAppWeakness,
  classifyAffinityManualImportWeakness
} from "./release-evidence-productivity-host-classifier.ts";
import {
  classifyPackageSigningReceiptWeakness,
  classifyReleasePackageChecksumReceiptWeakness
} from "./release-evidence-signed-package-classifier.ts";
import {
  type ReceiptRecord,
  hasManualProofLink,
  hasReceiptShaLink,
  hasReleasePackageOutputLink,
  hasSafePackageFileProof,
  hasStringList,
  isNonEmptyString,
  isPositiveInteger,
  isSha256,
  readRecordArray,
  readRecordField,
  readStringArrayField
} from "./release-evidence-receipt-primitives.ts";

const creativeNativePluginConfigs: Record<
  string,
  {
    artifactExtensions: string[];
    commandIds: string[];
    host: string;
    sdkName: string;
  }
> = {
  "dx.premiere-pro.command-center": {
    artifactExtensions: [".prm"],
    commandIds: [
      "dx.premiere-pro.show_status",
      "dx.premiere-pro.search_media_assets",
      "dx.premiere-pro.show_receipts"
    ],
    host: "premiere-pro",
    sdkName: "Premiere Pro SDK"
  },
  "dx.indesign.command-center": {
    artifactExtensions: [".idpln"],
    commandIds: [
      "dx.indesign.show_status",
      "dx.indesign.search_assets",
      "dx.indesign.show_receipts"
    ],
    host: "indesign",
    sdkName: "InDesign SDK"
  }
};
const adobeUxpPluginIdConfigs: Record<
  string,
  {
    host: string;
    manifestId: string;
  }
> = {
  "dx.photoshop.command-center": {
    host: "photoshop",
    manifestId: "dx.photoshop.command-center.development"
  },
  "dx.premiere-pro.command-center": {
    host: "premiere-pro",
    manifestId: "dx.premiere-pro.command-center.development"
  },
  "dx.indesign.command-center": {
    host: "indesign",
    manifestId: "dx.indesign.command-center.development"
  }
};
export function classifySpecialProofWeakness(
  kind: string,
  receipt: ReceiptRecord | undefined
): string | undefined {
  switch (kind) {
    case "addon_install":
      return classifyBlenderAddonInstallWeakness(receipt);
    case "apps_script_deployment":
      return classifyGoogleWorkspaceDeploymentWeakness(receipt);
    case "cloud_service":
      return classifyCloudServiceWeakness(receipt);
    case "developer_docs":
      return classifyDavinciResolveDeveloperDocsWeakness(receipt);
    case "experimental_instance":
      return classifyVisualStudioExperimentalInstanceWeakness(receipt);
    case "manual_import":
      return classifyAffinityManualImportWeakness(receipt);
    case "native_or_hybrid_plugin":
      return classifyNativeOrHybridPluginWeakness(receipt);
    case "notarization":
      return classifyNotarizationWeakness(receipt);
    case "plugin_id":
      return classifyPluginIdWeakness(receipt);
    case "plugin_verifier":
      return classifyIdeGameEnginePluginVerifierWeakness(receipt);
    case "photoshop_filter_plugin":
      return classifyAffinityPhotoshopFilterPluginWeakness(receipt);
    case "project_enablement":
      return classifyIdeGameEngineProjectEnablementWeakness(receipt);
    case "project_import":
      return classifyIdeGameEngineProjectImportWeakness(receipt);
    case "sketchtool_run":
      return classifySketchtoolRunWeakness(receipt);
    case "workflow_integration":
      return classifyDavinciResolveWorkflowIntegrationWeakness(receipt);
    default:
      return undefined;
  }
}

function classifyPluginIdWeakness(receipt: ReceiptRecord | undefined): string | undefined {
  if (receipt?.receipt === "dx.extension.figma.plugin_id") {
    return classifyFigmaPluginIdWeakness(receipt);
  }

  if (receipt?.receipt === "dx.extension.adobe_uxp.plugin_id") {
    return classifyAdobeUxpPluginIdWeakness(receipt);
  }

  return "plugin-id evidence receipt is not a supported plugin-id receipt";
}

function classifyFigmaPluginIdWeakness(receipt: ReceiptRecord | undefined): string | undefined {
  if (!receipt || receipt.receipt !== "dx.extension.figma.plugin_id") {
    return "plugin-id evidence receipt is not a Figma plugin-id receipt";
  }

  if (receipt.adapterId !== "dx.figma.command-center" || receipt.host !== "figma") {
    return "Figma plugin-id receipt is missing adapter or host identity";
  }

  const releaseClaims = readRecordField(receipt, "releaseClaims");

  if (releaseClaims?.loadedHostVerified !== true || releaseClaims.pluginIdVerified !== true) {
    return "Figma plugin-id receipt does not verify loaded host and plugin id";
  }

  const plugin = readRecordField(receipt, "plugin");

  if (
    !hasReceiptShaLink({
      receiptPath: receipt.loadedHostReceiptPath,
      receiptSha256: receipt.loadedHostReceiptSha256
    }) ||
    !hasReleasePackageOutputLink(receipt) ||
    !hasManualProofLink(receipt) ||
    !isNonEmptyString(plugin?.manifestPluginId) ||
    !isSha256(plugin.manifestPluginIdSha256) ||
    plugin.pluginIdVerified !== true
  ) {
    return "Figma plugin-id receipt is missing loaded-host, package, manual, or manifest id proof";
  }

  return (
    classifyLinkedLoadedHostReceiptWeakness(
      {
        receiptPath: receipt.loadedHostReceiptPath,
        receiptSha256: receipt.loadedHostReceiptSha256
      },
      "Figma plugin-id loaded-host",
      "Figma plugin-id linked loaded-host",
      classifyFigmaLoadedHostWeakness
    ) ??
    classifyLinkedPackageOutputWeakness(receipt, "Figma plugin-id") ??
    classifyManualProofWeakness(receipt, "Figma plugin-id")
  );
}

function classifyAdobeUxpPluginIdWeakness(receipt: ReceiptRecord | undefined): string | undefined {
  if (!receipt || receipt.receipt !== "dx.extension.adobe_uxp.plugin_id") {
    return "plugin-id evidence receipt is not an Adobe UXP plugin-id receipt";
  }

  const config = adobeUxpPluginIdConfigs[String(receipt.adapterId)];
  const releaseClaims = readRecordField(receipt, "releaseClaims");
  const loadedHostLink = readRecordField(receipt, "loadedHost");
  const adobeDeveloperConsole = readRecordField(receipt, "adobeDeveloperConsole");

  if (
    !config ||
    receipt.host !== config.host ||
    releaseClaims?.loadedHostVerified !== true ||
    releaseClaims.pluginIdVerified !== true ||
    !hasReceiptShaLink(loadedHostLink) ||
    !hasReleasePackageOutputLink(receipt) ||
    !hasManualProofLink(receipt) ||
    adobeDeveloperConsole?.pluginId !== config.manifestId ||
    !isSha256(adobeDeveloperConsole.pluginIdSha256) ||
    adobeDeveloperConsole.pluginIdVerified !== true ||
    adobeDeveloperConsole.projectVerified !== true ||
    !["draft", "submitted", "published"].includes(String(adobeDeveloperConsole.marketplaceListingState))
  ) {
    return "Adobe UXP plugin-id receipt is missing loaded-host, package, manual, or Developer Console proof";
  }

  if (sha256String(config.manifestId) !== adobeDeveloperConsole.pluginIdSha256) {
    return "Adobe UXP plugin-id Developer Console plugin-id hash does not match the manifest id";
  }

  const linkedLoadedHostWeakness = classifyLinkedLoadedHostReceiptWeakness(
    loadedHostLink,
    "Adobe UXP plugin-id loaded-host",
    "Adobe UXP plugin-id linked loaded-host",
    classifyCreativeLoadedHostWeakness
  );

  if (linkedLoadedHostWeakness) {
    return linkedLoadedHostWeakness;
  }

  const linkedLoadedHost = readLinkedReceiptObject(
    loadedHostLink.receiptPath,
    "Adobe UXP plugin-id linked loaded-host"
  );

  if (typeof linkedLoadedHost === "string") {
    return linkedLoadedHost;
  }

  const adobeUxp = readRecordField(linkedLoadedHost, "adobeUxp");

  if (adobeUxp?.uxpManifestId !== adobeDeveloperConsole.pluginId) {
    return "Adobe UXP plugin-id receipt does not match linked loaded-host manifest id";
  }

  return (
    classifyLinkedPackageOutputWeakness(receipt, "Adobe UXP plugin-id") ??
    classifyManualProofWeakness(receipt, "Adobe UXP plugin-id")
  );
}

function classifyCloudServiceWeakness(receipt: ReceiptRecord | undefined): string | undefined {
  if (receipt?.receipt === "dx.extension.google_workspace.cloud_service") {
    return classifyGoogleWorkspaceCloudServiceWeakness(receipt);
  }

  if (receipt?.receipt === "dx.extension.canva.cloud_service") {
    return classifyCanvaCloudServiceWeakness(receipt);
  }

  return "cloud-service evidence receipt is not a supported cloud-service receipt";
}

function classifyCanvaCloudServiceWeakness(receipt: ReceiptRecord | undefined): string | undefined {
  if (!receipt || receipt.receipt !== "dx.extension.canva.cloud_service") {
    return "Canva cloud-service evidence receipt is not a Canva cloud-service receipt";
  }

  if (receipt.adapterId !== "dx.canva.command-center" || receipt.host !== "canva") {
    return "Canva cloud-service receipt is missing adapter or host identity";
  }

  const releaseClaims = readRecordField(receipt, "releaseClaims");
  const loadedHostLink = {
    receiptPath: receipt.loadedHostReceiptPath,
    receiptSha256: receipt.loadedHostReceiptSha256
  };

  if (
    releaseClaims?.loadedHostVerified !== true ||
    releaseClaims.developmentAppVerified !== true ||
    releaseClaims.cloudServiceVerified !== true
  ) {
    return "Canva cloud-service receipt does not verify development-app and cloud-service proof";
  }

  const service = readRecordField(receipt, "service");
  const metadataExchangeWeakness = classifyCloudMetadataExchangeWeakness(
    receipt.requests,
    receipt.responses,
    "Canva cloud-service"
  );

  if (
    !hasReceiptShaLink(loadedHostLink) ||
    !hasReleasePackageOutputLink(receipt) ||
    !hasManualProofLink(receipt) ||
    !isNonEmptyString(service?.endpointHost) ||
    service.transport !== "https" ||
    service.metadataOnly !== true ||
    service.storesDesignPayloads !== false
  ) {
    return "Canva cloud-service receipt is missing loaded-host, package, manual, or metadata-only service proof";
  }

  if (metadataExchangeWeakness) {
    return metadataExchangeWeakness;
  }

  return (
    classifyLinkedPackageOutputWeakness(receipt, "Canva cloud-service") ??
    classifyLinkedLoadedHostReceiptWeakness(
      loadedHostLink,
      "Canva cloud-service loaded-host",
      "Canva cloud-service linked loaded-host",
      classifyApplicationLoadedHostWeakness
    ) ??
    classifyManualProofWeakness(receipt, "Canva cloud-service")
  );
}

function classifyBlenderAddonInstallWeakness(receipt: ReceiptRecord | undefined): string | undefined {
  if (!receipt || receipt.receipt !== "dx.extension.blender.addon_install") {
    return "add-on install evidence receipt is not a Blender add-on install receipt";
  }

  const releaseClaims = readRecordField(receipt, "releaseClaims");
  const addon = readRecordField(receipt, "addon");

  if (
    receipt.adapterId !== "dx.blender.command-center" ||
    receipt.host !== "blender" ||
    releaseClaims?.loadedHostVerified !== true ||
    releaseClaims.addonInstallVerified !== true ||
    !hasReceiptShaLink({
      receiptPath: receipt.loadedHostReceiptPath,
      receiptSha256: receipt.loadedHostReceiptSha256
    }) ||
    !hasReleasePackageOutputLink(receipt) ||
    !hasManualProofLink(receipt) ||
    addon?.module !== "dx_blender_command_center" ||
    addon.installed !== true
  ) {
    return "Blender add-on install receipt is missing loaded-host, package, manual, or add-on proof";
  }

  return (
    classifyLinkedReceiptWeakness(
      {
        receiptPath: receipt.loadedHostReceiptPath,
        receiptSha256: receipt.loadedHostReceiptSha256
      },
      "Blender add-on install loaded-host"
    ) ??
    classifyLinkedPackageOutputWeakness(receipt, "Blender add-on install") ??
    classifyManualProofWeakness(receipt, "Blender add-on install")
  );
}

function classifySketchtoolRunWeakness(receipt: ReceiptRecord | undefined): string | undefined {
  if (!receipt || receipt.receipt !== "dx.extension.sketch.sketchtool_run") {
    return "sketchtool evidence receipt is not a Sketch sketchtool run receipt";
  }

  const releaseClaims = readRecordField(receipt, "releaseClaims");
  const sketchtool = readRecordField(receipt, "sketchtool");

  if (
    receipt.adapterId !== "dx.sketch.command-center" ||
    receipt.host !== "sketch" ||
    releaseClaims?.loadedHostVerified !== true ||
    releaseClaims.sketchtoolVerified !== true ||
    !hasReceiptShaLink({
      receiptPath: receipt.loadedHostReceiptPath,
      receiptSha256: receipt.loadedHostReceiptSha256
    }) ||
    !hasReleasePackageOutputLink(receipt) ||
    !hasManualProofLink(receipt) ||
    !isNonEmptyString(sketchtool?.path) ||
    !isSha256(sketchtool.sha256) ||
    !hasStringList(sketchtool.commandIdsVerified)
  ) {
    return "Sketch sketchtool receipt is missing loaded-host, package, manual, or command proof";
  }

  return (
    classifyLinkedReceiptWeakness(
      {
        receiptPath: receipt.loadedHostReceiptPath,
        receiptSha256: receipt.loadedHostReceiptSha256
      },
      "Sketch sketchtool loaded-host"
    ) ??
    classifyLinkedPackageOutputWeakness(receipt, "Sketch sketchtool") ??
    classifyManualProofWeakness(receipt, "Sketch sketchtool") ??
    classifyCurrentSha256FileProofWeakness(sketchtool.path, sketchtool.sha256, "Sketch sketchtool")
  );
}

function classifyDavinciResolveWorkflowIntegrationWeakness(receipt: ReceiptRecord | undefined): string | undefined {
  if (!receipt || receipt.receipt !== "dx.extension.davinci_resolve.workflow_integration") {
    return "workflow integration evidence receipt is not a DaVinci Resolve workflow receipt";
  }

  const releaseClaims = readRecordField(receipt, "releaseClaims");
  const workflow = readRecordField(receipt, "workflow");

  if (
    receipt.adapterId !== "dx.davinci-resolve.command-center" ||
    receipt.host !== "davinci-resolve" ||
    releaseClaims?.loadedHostVerified !== true ||
    releaseClaims.workflowIntegrationVerified !== true ||
    releaseClaims.readOnlyProjectMetadataVerified !== true ||
    !hasReceiptShaLink({
      receiptPath: receipt.loadedHostReceiptPath,
      receiptSha256: receipt.loadedHostReceiptSha256
    }) ||
    !hasReleasePackageOutputLink(receipt) ||
    !hasManualProofLink(receipt) ||
    workflow?.scriptLoadedInResolve !== true ||
    workflow.readOnlyProjectMetadataVerified !== true ||
    workflow.mutatesResolveProject !== false
  ) {
    return "DaVinci Resolve workflow receipt is missing loaded-host, package, manual, or read-only workflow proof";
  }

  return (
    classifyLinkedPackageOutputWeakness(receipt, "workflow integration") ??
    classifyManualProofWeakness(receipt, "workflow integration") ??
    classifyLinkedLoadedHostReceiptWeakness(
      {
        receiptPath: receipt.loadedHostReceiptPath,
        receiptSha256: receipt.loadedHostReceiptSha256
      },
      "workflow integration loaded-host",
      "workflow integration linked loaded-host",
      classifyCreativeLoadedHostWeakness
    )
  );
}

function classifyDavinciResolveDeveloperDocsWeakness(receipt: ReceiptRecord | undefined): string | undefined {
  if (!receipt || receipt.receipt !== "dx.extension.davinci_resolve.developer_docs") {
    return "developer documentation evidence receipt is not a DaVinci Resolve developer-docs receipt";
  }

  const releaseClaims = readRecordField(receipt, "releaseClaims");
  const documentation = readRecordField(receipt, "documentation");
  const docsFiles = readRecordArray(documentation?.files);

  if (
    receipt.adapterId !== "dx.davinci-resolve.command-center" ||
    receipt.host !== "davinci-resolve" ||
    releaseClaims?.packageOutputVerified !== true ||
    releaseClaims.developerDocsVersionVerified !== true ||
    !hasReleasePackageOutputLink(receipt) ||
    !hasManualProofLink(receipt) ||
    !isNonEmptyString(documentation?.docsRoot) ||
    !["installed-developer-documentation", "developer-documentation-export"].includes(
      String(documentation.docsSource)
    ) ||
    !isNonEmptyString(documentation.resolveVersion) ||
    !isNonEmptyString(documentation.developerDocsVersion) ||
    !isPositiveInteger(documentation.fileCount) ||
    documentation.metadataOnly !== true ||
    docsFiles.length !== documentation.fileCount ||
    !docsFiles.every(hasSafePackageFileProof)
  ) {
    return "DaVinci Resolve developer-docs receipt is missing package, manual, version, or documentation file proof";
  }

  return (
    classifyLinkedPackageOutputWeakness(receipt, "developer-docs") ??
    classifyManualProofWeakness(receipt, "developer-docs") ??
    classifyDavinciResolveDocumentationFilesWeakness(documentation.docsRoot, docsFiles)
  );
}

function classifyVisualStudioExperimentalInstanceWeakness(receipt: ReceiptRecord | undefined): string | undefined {
  if (receipt?.receipt !== "dx.extension.ide_game_engine.loaded_host") {
    return "experimental-instance evidence receipt is not a Visual Studio loaded-host receipt";
  }

  if (receipt.adapterId !== "dx.visual-studio.command-center" || receipt.host !== "visual-studio") {
    return "experimental-instance receipt is not linked to the Visual Studio adapter";
  }

  return classifyIdeGameEngineLoadedHostWeakness(receipt);
}

function classifyIdeGameEnginePluginVerifierWeakness(receipt: ReceiptRecord | undefined): string | undefined {
  if (receipt?.receipt !== "dx.extension.ide_game_engine.plugin_verifier") {
    return "Plugin Verifier receipt is not an IDE/game-engine Plugin Verifier receipt";
  }

  const releaseClaims = readRecordField(receipt, "releaseClaims");

  if (receipt.adapterId !== "dx.intellij-platform.command-center" || receipt.host !== "intellij-platform") {
    return "Plugin Verifier receipt is not linked to the IntelliJ Platform adapter";
  }

  if (releaseClaims?.packageOutputVerified !== true || releaseClaims.pluginVerifierVerified !== true) {
    return "Plugin Verifier receipt does not verify package output and Plugin Verifier proof";
  }

  const linkWeakness = classifyIdeGameEngineSpecialProofLinkWeakness(receipt, "Plugin Verifier");

  if (linkWeakness) {
    return linkWeakness;
  }

  const pluginVerifier = readRecordField(receipt, "pluginVerifier");
  const ideVersions = pluginVerifier ? readStringArrayField(pluginVerifier, "ideVersions") : [];
  const problems = pluginVerifier?.problems;

  if (
    pluginVerifier?.toolName !== "JetBrains Plugin Verifier" ||
    !isNonEmptyString(pluginVerifier.toolVersion) ||
    ideVersions.length === 0 ||
    pluginVerifier.compatible !== true
  ) {
    return "Plugin Verifier receipt is missing verifier compatibility proof";
  }

  if (!Array.isArray(problems) || !problems.every((problem) => typeof problem === "string")) {
    return "Plugin Verifier receipt is missing a problems list";
  }

  if (problems.length > 0) {
    return "Plugin Verifier receipt contains compatibility problems";
  }

  return undefined;
}

function classifyIdeGameEngineProjectImportWeakness(receipt: ReceiptRecord | undefined): string | undefined {
  if (receipt?.receipt !== "dx.extension.ide_game_engine.project_import") {
    return "project import receipt is not an IDE/game-engine project import receipt";
  }

  const releaseClaims = readRecordField(receipt, "releaseClaims");

  if (receipt.adapterId !== "dx.unity-editor.command-center" || receipt.host !== "unity-editor") {
    return "project import receipt is not linked to the Unity Editor adapter";
  }

  if (releaseClaims?.packageOutputVerified !== true || releaseClaims.projectImportVerified !== true) {
    return "project import receipt does not verify package output and Unity import proof";
  }

  const linkWeakness = classifyIdeGameEngineSpecialProofLinkWeakness(receipt, "project import");

  if (linkWeakness) {
    return linkWeakness;
  }

  const projectImport = readRecordField(receipt, "projectImport");

  if (
    !isNonEmptyString(projectImport?.unityVersion) ||
    !isNonEmptyString(projectImport.packageName) ||
    !isNonEmptyString(projectImport.packageVersion) ||
    projectImport.testProjectKind !== "empty-project" ||
    projectImport.imported !== true ||
    projectImport.compileStatus !== "passed" ||
    projectImport.editorTestsStatus !== "passed" ||
    projectImport.assetDatabaseRefreshed !== true
  ) {
    return "project import receipt is missing Unity import pass proof";
  }

  if (projectImport.mutatesProjectAssets !== false) {
    return "project import receipt mutates test project assets";
  }

  return undefined;
}

function classifyIdeGameEngineProjectEnablementWeakness(receipt: ReceiptRecord | undefined): string | undefined {
  if (receipt?.receipt !== "dx.extension.ide_game_engine.project_enablement") {
    return "project enablement receipt is not an IDE/game-engine project enablement receipt";
  }

  const releaseClaims = readRecordField(receipt, "releaseClaims");

  if (receipt.adapterId !== "dx.unreal-engine.command-center" || receipt.host !== "unreal-engine") {
    return "project enablement receipt is not linked to the Unreal Engine adapter";
  }

  if (releaseClaims?.packageOutputVerified !== true || releaseClaims.projectEnablementVerified !== true) {
    return "project enablement receipt does not verify package output and Unreal enablement proof";
  }

  const linkWeakness = classifyIdeGameEngineSpecialProofLinkWeakness(receipt, "project enablement");

  if (linkWeakness) {
    return linkWeakness;
  }

  const projectEnablement = readRecordField(receipt, "projectEnablement");

  if (
    !isNonEmptyString(projectEnablement?.engineVersion) ||
    !isNonEmptyString(projectEnablement.pluginModuleName) ||
    projectEnablement.testProjectKind !== "empty-sample-project"
  ) {
    return "project enablement receipt is missing Unreal project proof";
  }

  if (projectEnablement.pluginEnabled !== true) {
    return "project enablement receipt does not enable the Unreal plugin";
  }

  if (projectEnablement.editorModuleLoaded !== true || projectEnablement.automationTestsStatus !== "passed") {
    return "project enablement receipt does not prove editor module and automation test pass";
  }

  if (projectEnablement.mutatesProjectContent !== false) {
    return "project enablement receipt mutates project content";
  }

  return undefined;
}

function classifyIdeGameEngineSpecialProofLinkWeakness(
  receipt: ReceiptRecord,
  label: string
): string | undefined {
  const releaseClaims = readRecordField(receipt, "releaseClaims");
  const loadedHostLink = {
    receiptPath: receipt.loadedHostReceiptPath,
    receiptSha256: receipt.loadedHostReceiptSha256
  };

  if (releaseClaims?.loadedHostVerified !== true) {
    return `${label} receipt does not verify loaded-host proof`;
  }

  return (
    classifyLinkedPackageOutputWeakness(receipt, label) ??
    classifyManualProofWeakness(receipt, label) ??
    classifyLinkedLoadedHostReceiptWeakness(
      loadedHostLink,
      `${label} loaded-host`,
      `${label} linked loaded-host`,
      classifyIdeGameEngineLoadedHostWeakness
    )
  );
}

function classifyNativeOrHybridPluginWeakness(receipt: ReceiptRecord | undefined): string | undefined {
  if (!receipt || receipt.receipt !== "dx.extension.creative.native_or_hybrid_plugin") {
    return "native-or-hybrid plugin evidence receipt is not a creative native/hybrid plugin receipt";
  }

  const config = creativeNativePluginConfigs[String(receipt.adapterId)];
  const releaseClaims = readRecordField(receipt, "releaseClaims");
  const nativePlugin = readRecordField(receipt, "nativePlugin");

  if (
    !config ||
    receipt.host !== config.host ||
    releaseClaims?.loadedHostVerified !== true ||
    releaseClaims.packageOutputVerified !== true ||
    releaseClaims.nativeOrHybridPluginVerified !== true ||
    !hasReceiptShaLink({
      receiptPath: receipt.loadedHostReceiptPath,
      receiptSha256: receipt.loadedHostReceiptSha256
    }) ||
    !hasReleasePackageOutputLink(receipt) ||
    !hasManualProofLink(receipt) ||
    !hasCreativeNativePluginProof(nativePlugin, config)
  ) {
    return "native-or-hybrid plugin receipt is missing adapter, package, manual, or expected native plugin proof";
  }

  return (
    classifyLinkedPackageOutputWeakness(receipt, "native-or-hybrid plugin") ??
    classifyManualProofWeakness(receipt, "native-or-hybrid plugin") ??
    classifyLinkedLoadedHostReceiptWeakness(
      {
        receiptPath: receipt.loadedHostReceiptPath,
        receiptSha256: receipt.loadedHostReceiptSha256
      },
      "native-or-hybrid plugin loaded-host",
      "native-or-hybrid plugin linked loaded-host",
      classifyCreativeLoadedHostWeakness
    ) ??
    classifyCurrentFileProofWeakness(
      nativePlugin.artifactPath,
      nativePlugin.bytes,
      nativePlugin.sha256,
      "native-or-hybrid plugin native artifact"
    )
  );
}

function classifyAffinityPhotoshopFilterPluginWeakness(
  receipt: ReceiptRecord | undefined
): string | undefined {
  if (!receipt || receipt.receipt !== "dx.extension.affinity_content.photoshop_filter_plugin") {
    return "Photoshop-compatible filter plugin evidence receipt is not an Affinity filter plugin receipt";
  }

  const releaseClaims = readRecordField(receipt, "releaseClaims");
  const loadedAppLink = {
    receiptPath: receipt.loadedAppReceiptPath,
    receiptSha256: receipt.loadedAppReceiptSha256
  };
  const filterPlugin = readRecordField(receipt, "filterPlugin");

  if (
    receipt.adapterId !== "dx.affinity-content.bridge" ||
    receipt.host !== "affinity" ||
    releaseClaims?.loadedAffinityAppVerified !== true ||
    releaseClaims.photoshopFilterPluginVerified !== true ||
    !hasReceiptShaLink(loadedAppLink) ||
    !hasManualProofLink(receipt) ||
    !hasAffinityPhotoshopFilterPluginProof(filterPlugin)
  ) {
    return "Affinity filter plugin receipt is missing loaded-app, manual, or Photoshop-compatible filter proof";
  }

  return (
    classifyLinkedLoadedHostReceiptWeakness(
      loadedAppLink,
      "Affinity filter plugin loaded-app",
      "Affinity filter plugin linked loaded-app",
      classifyAffinityLoadedAppWeakness
    ) ??
    classifyManualProofWeakness(receipt, "Affinity filter plugin") ??
    classifyCurrentFileProofWeakness(
      filterPlugin.artifactPath,
      filterPlugin.bytes,
      filterPlugin.sha256,
      "Affinity filter plugin artifact"
    )
  );
}

function classifyDavinciResolveDocumentationFilesWeakness(
  docsRoot: unknown,
  docsFiles: ReceiptRecord[]
): string | undefined {
  if (!isNonEmptyString(docsRoot)) {
    return "developer-docs receipt is missing documentation root";
  }

  for (const docsFile of docsFiles) {
    const relativePath = String(docsFile.relativePath);
    const docsFileWeakness = classifyCurrentFileProofWeakness(
      join(docsRoot, ...relativePath.split("/")),
      docsFile.bytes,
      docsFile.sha256,
      "developer-docs documentation"
    );

    if (docsFileWeakness) {
      return docsFileWeakness;
    }
  }

  return undefined;
}

function hasCreativeNativePluginProof(
  nativePlugin: ReceiptRecord | undefined,
  config: (typeof creativeNativePluginConfigs)[string]
): boolean {
  if (!nativePlugin) {
    return false;
  }

  return (
    ["host-native-plugin", "uxp-native-bridge"].includes(String(nativePlugin.kind)) &&
    nativePlugin.sdkName === config.sdkName &&
    isNonEmptyString(nativePlugin.sdkVersion) &&
    isNonEmptyString(nativePlugin.artifactPath) &&
    isNonEmptyString(nativePlugin.fileName) &&
    hasAllowedArtifactExtension(nativePlugin.fileName, config.artifactExtensions) &&
    isPositiveInteger(nativePlugin.bytes) &&
    isSha256(nativePlugin.sha256) &&
    nativePlugin.loadedByHost === true &&
    nativePlugin.bridgeMode === "metadata-command-bridge" &&
    hasExactStringSet(nativePlugin.commandIdsVerified, config.commandIds) &&
    nativePlugin.metadataOnly === true &&
    nativePlugin.storesHostPayloads === false &&
    nativePlugin.mutatesHostProject === false &&
    nativePlugin.mutatesHostDocument === false
  );
}

function hasAffinityPhotoshopFilterPluginProof(filterPlugin: ReceiptRecord | undefined): boolean {
  if (!filterPlugin) {
    return false;
  }

  return (
    filterPlugin.kind === "photoshop-compatible-64-bit-filter" &&
    isNonEmptyString(filterPlugin.artifactPath) &&
    isNonEmptyString(filterPlugin.fileName) &&
    hasAllowedArtifactExtension(filterPlugin.fileName, [".8bf"]) &&
    isPositiveInteger(filterPlugin.bytes) &&
    isSha256(filterPlugin.sha256) &&
    filterPlugin.loadedByAffinityPhoto === true &&
    filterPlugin.metadataOnly === true &&
    filterPlugin.storesAffinityPayloads === false &&
    filterPlugin.mutatesAffinityDocument === false
  );
}

function hasAllowedArtifactExtension(fileName: string, extensions: string[]): boolean {
  const lowerFileName = fileName.toLowerCase();

  return extensions.some((extension) => lowerFileName.endsWith(extension));
}

function hasExactStringSet(value: unknown, expectedValues: string[]): boolean {
  if (!hasStringList(value)) {
    return false;
  }

  const values = value as string[];
  const uniqueValues = new Set(values);

  if (uniqueValues.size !== expectedValues.length) {
    return false;
  }

  return expectedValues.every((expectedValue) => uniqueValues.has(expectedValue));
}

function classifyNotarizationWeakness(receipt: ReceiptRecord | undefined): string | undefined {
  if (!receipt || receipt.receipt !== "dx.extension.package.notarization") {
    return "notarization evidence receipt is not a package notarization receipt";
  }

  const releaseClaims = readRecordField(receipt, "releaseClaims");

  if (
    receipt.adapterId !== "dx.sketch.command-center" ||
    receipt.host !== "sketch" ||
    releaseClaims?.notarizationVerified !== true ||
    releaseClaims.signingVerified !== true ||
    releaseClaims.releaseChecksumVerified !== true
  ) {
    return "notarization receipt is not linked to signed Sketch release artifact proof";
  }

  const notarization = readRecordField(receipt, "notarization");
  const signedArtifact = readRecordField(receipt, "signedArtifact");
  const signingLink = {
    receiptPath: receipt.signingReceiptPath,
    receiptSha256: receipt.signingReceiptSha256
  };
  const checksumLink = {
    receiptPath: receipt.checksumReceiptPath,
    receiptSha256: receipt.checksumReceiptSha256
  };

  if (
    !hasReceiptShaLink(signingLink) ||
    !hasReceiptShaLink(checksumLink) ||
    !isNonEmptyString(signedArtifact?.path) ||
    !isSha256(signedArtifact.sha256) ||
    !isNonEmptyString(notarization?.toolName) ||
    !isNonEmptyString(notarization.command) ||
    !isNonEmptyString(notarization.outputPath) ||
    !isSha256(notarization.outputSha256) ||
    !isSha256(notarization.ticketIdSha256) ||
    !isSha256(notarization.artifactSha256) ||
    notarization.verified !== true
  ) {
    return "notarization receipt is missing linked receipt, tool, output, ticket, or artifact proof";
  }

  if (signedArtifact.sha256 !== notarization.artifactSha256) {
    return "notarization signed artifact checksum does not match notarization artifact proof";
  }

  const signingReceiptWeakness = classifyLinkedReceiptWeakness(signingLink, "notarization signing");

  if (signingReceiptWeakness) {
    return signingReceiptWeakness;
  }

  const checksumReceiptWeakness = classifyLinkedReceiptWeakness(checksumLink, "notarization checksum");

  if (checksumReceiptWeakness) {
    return checksumReceiptWeakness;
  }

  const signedArtifactWeakness = classifyCurrentSha256FileProofWeakness(
    signedArtifact.path,
    signedArtifact.sha256,
    "notarization signed artifact"
  );

  if (signedArtifactWeakness) {
    return signedArtifactWeakness;
  }

  const notarizationOutputWeakness = classifyCurrentSha256FileProofWeakness(
    notarization.outputPath,
    notarization.outputSha256,
    "notarization output"
  );

  if (notarizationOutputWeakness) {
    return notarizationOutputWeakness;
  }

  const linkedSigningReceipt = readLinkedReceiptObject(receipt.signingReceiptPath, "notarization signing");

  if (typeof linkedSigningReceipt === "string") {
    return linkedSigningReceipt;
  }

  const linkedSigningReceiptWeakness = classifyNotarizationSigningReceiptWeakness(
    linkedSigningReceipt,
    receipt.adapterId,
    receipt.host,
    notarization.artifactSha256
  );

  if (linkedSigningReceiptWeakness) {
    return `notarization signing receipt is weak: ${linkedSigningReceiptWeakness}`;
  }

  const linkedChecksumReceipt = readLinkedReceiptObject(receipt.checksumReceiptPath, "notarization checksum");

  if (typeof linkedChecksumReceipt === "string") {
    return linkedChecksumReceipt;
  }

  const linkedChecksumReceiptWeakness = classifyNotarizationChecksumReceiptWeakness(
    linkedChecksumReceipt,
    receipt.adapterId,
    receipt.host,
    notarization.artifactSha256
  );

  if (linkedChecksumReceiptWeakness) {
    return `notarization checksum receipt is weak: ${linkedChecksumReceiptWeakness}`;
  }

  return undefined;
}

function classifyNotarizationSigningReceiptWeakness(
  signingReceipt: ReceiptRecord,
  expectedAdapterId: unknown,
  expectedHost: unknown,
  expectedArtifactSha256: unknown
): string | undefined {
  return classifyPackageSigningReceiptWeakness(signingReceipt, {
    expectedAdapterId,
    expectedHost,
    expectedArtifactSha256
  });
}

function classifyNotarizationChecksumReceiptWeakness(
  checksumReceipt: ReceiptRecord,
  expectedAdapterId: unknown,
  expectedHost: unknown,
  expectedArtifactSha256: unknown
): string | undefined {
  return classifyReleasePackageChecksumReceiptWeakness(checksumReceipt, {
    expectedAdapterId,
    expectedHost,
    expectedArtifactSha256
  });
}

function hasCloudMetadataRequests(value: unknown): boolean {
  const requests = readRecordArray(value);

  return (
    requests.length > 0 &&
    requests.every(
      (request) =>
        isNonEmptyString(request.commandId) &&
        isNonEmptyString(request.operation) &&
        request.metadataOnly === true &&
        request.transport === "cloud-service"
    )
  );
}

function hasCloudMetadataResponses(value: unknown): boolean {
  const responses = readRecordArray(value);

  return (
    responses.length > 0 &&
    responses.every(
      (response) =>
        isNonEmptyString(response.commandId) &&
        (response.status === "ok" || response.status === "proof-blocked") &&
        response.payloadKind === "metadata-only-card"
    )
  );
}

function classifyCloudMetadataExchangeWeakness(
  requestsValue: unknown,
  responsesValue: unknown,
  label: string,
  requiredCommandOperations?: Map<string, string>
): string | undefined {
  const requests = readRecordArray(requestsValue);
  const responses = readRecordArray(responsesValue);

  if (!hasCloudMetadataRequests(requestsValue)) {
    return `${label} receipt is missing metadata-only request proof`;
  }

  if (responses.some((response) => response.status === "proof-blocked")) {
    return `${label} responses must prove successful cloud-service execution`;
  }

  if (!hasCloudMetadataResponses(responsesValue)) {
    return `${label} receipt is missing metadata-only response proof`;
  }

  const requestCommandIds = commandIdSet(requests);
  const responseCommandIds = commandIdSet(responses);

  if (
    requestCommandIds.size !== requests.length ||
    responseCommandIds.size !== responses.length ||
    requestCommandIds.size !== responseCommandIds.size ||
    ![...requestCommandIds].every((commandId) => responseCommandIds.has(commandId))
  ) {
    return `${label} response command set does not match request command set`;
  }

  if (requiredCommandOperations) {
    const requiredCommandIds = [...requiredCommandOperations.keys()];

    if (
      requiredCommandIds.some(
        (commandId) => !requestCommandIds.has(commandId) || !responseCommandIds.has(commandId)
      )
    ) {
      return `${label} receipt is missing required command metadata`;
    }

    for (const request of requests) {
      const expectedOperation = requiredCommandOperations.get(String(request.commandId));

      if (!expectedOperation) {
        return `${label} receipt uses unsupported command metadata`;
      }

      if (request.operation !== expectedOperation) {
        return `${label} receipt has an invalid command operation`;
      }
    }
  }

  return undefined;
}

function classifyLinkedLoadedHostReceiptWeakness(
  link: ReceiptRecord,
  linkLabel: string,
  semanticLabel: string,
  classifyReceipt: (receipt: ReceiptRecord) => string | undefined
): string | undefined {
  const linkWeakness = classifyLinkedReceiptWeakness(link, linkLabel);

  if (linkWeakness) {
    return linkWeakness;
  }

  const linkedReceipt = readLinkedReceiptObject(link.receiptPath, semanticLabel);

  if (typeof linkedReceipt === "string") {
    return linkedReceipt;
  }

  const receiptWeakness = classifyReceipt(linkedReceipt);

  if (receiptWeakness) {
    return `${semanticLabel} receipt is weak: ${receiptWeakness}`;
  }

  return undefined;
}

function readLinkedReceiptObject(path: unknown, label: string): ReceiptRecord | string {
  if (!isNonEmptyString(path)) {
    return `${label} receipt is missing receipt path`;
  }

  try {
    const parsedReceipt = JSON.parse(readFileSync(path, "utf8"));

    if (!parsedReceipt || typeof parsedReceipt !== "object" || Array.isArray(parsedReceipt)) {
      return `${label} receipt is not a JSON object`;
    }

    return parsedReceipt as ReceiptRecord;
  } catch {
    return `${label} receipt is not readable JSON`;
  }
}

function commandIdSet(records: ReceiptRecord[]): Set<string> {
  return new Set(
    records
      .map((record) => record.commandId)
      .filter((commandId): commandId is string => isNonEmptyString(commandId))
  );
}

function sha256String(value: string): string {
  return createHash("sha256").update(Buffer.from(value)).digest("hex");
}
