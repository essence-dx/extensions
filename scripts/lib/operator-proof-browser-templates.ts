import {
  type OperatorProofTemplateDefinition,
  checklist
} from "./operator-proof-template-model.ts";

type BrowserLoadedProfileTarget = "chrome" | "edge" | "firefox";
type BrowserLoadedProfileTemplateId =
  | "browser-chrome-loaded-profile"
  | "browser-edge-loaded-profile"
  | "browser-firefox-loaded-profile";

interface BrowserLoadedProfileTemplateConfig {
  browserExecutablePlaceholder: string;
  browserVersionPlaceholder: string;
  extensionBaseUrl: string;
  extensionIdPlaceholder: string;
  id: BrowserLoadedProfileTemplateId;
  manifestPathPlaceholder: string;
  outputReceipt: string;
  profilePathPlaceholder: string;
  target: BrowserLoadedProfileTarget;
}

const browserLoadedProfileTemplateConfigs: BrowserLoadedProfileTemplateConfig[] = [
  {
    browserExecutablePlaceholder: "REPLACE_WITH_ABSOLUTE_CHROME_EXECUTABLE_PATH",
    browserVersionPlaceholder: "REPLACE_WITH_CHROME_VERSION",
    extensionBaseUrl: "chrome-extension://REPLACE_WITH_CHROME_EXTENSION_ID/",
    extensionIdPlaceholder: "REPLACE_WITH_CHROME_EXTENSION_ID",
    id: "browser-chrome-loaded-profile",
    manifestPathPlaceholder: "REPLACE_WITH_ABSOLUTE_CHROME_NATIVE_HOST_MANIFEST_PATH",
    outputReceipt: "chrome-loaded-profile-latest.json",
    profilePathPlaceholder: "REPLACE_WITH_ABSOLUTE_TEMPORARY_CHROME_PROFILE_PATH",
    target: "chrome"
  },
  {
    browserExecutablePlaceholder: "REPLACE_WITH_ABSOLUTE_EDGE_EXECUTABLE_PATH",
    browserVersionPlaceholder: "REPLACE_WITH_EDGE_VERSION",
    extensionBaseUrl: "chrome-extension://REPLACE_WITH_EDGE_EXTENSION_ID/",
    extensionIdPlaceholder: "REPLACE_WITH_EDGE_EXTENSION_ID",
    id: "browser-edge-loaded-profile",
    manifestPathPlaceholder: "REPLACE_WITH_ABSOLUTE_EDGE_NATIVE_HOST_MANIFEST_PATH",
    outputReceipt: "edge-loaded-profile-latest.json",
    profilePathPlaceholder: "REPLACE_WITH_ABSOLUTE_TEMPORARY_EDGE_PROFILE_PATH",
    target: "edge"
  },
  {
    browserExecutablePlaceholder: "REPLACE_WITH_ABSOLUTE_FIREFOX_EXECUTABLE_PATH",
    browserVersionPlaceholder: "REPLACE_WITH_FIREFOX_VERSION",
    extensionBaseUrl: "moz-extension://REPLACE_WITH_FIREFOX_EXTENSION_ID/",
    extensionIdPlaceholder: "REPLACE_WITH_FIREFOX_EXTENSION_ID",
    id: "browser-firefox-loaded-profile",
    manifestPathPlaceholder: "REPLACE_WITH_ABSOLUTE_FIREFOX_NATIVE_HOST_MANIFEST_PATH",
    outputReceipt: "firefox-loaded-profile-latest.json",
    profilePathPlaceholder: "REPLACE_WITH_ABSOLUTE_TEMPORARY_FIREFOX_PROFILE_PATH",
    target: "firefox"
  }
];

export const browserOperatorProofTemplates: OperatorProofTemplateDefinition[] =
  browserLoadedProfileTemplateConfigs.map(createBrowserLoadedProfileTemplate);

function createBrowserLoadedProfileTemplate(
  config: BrowserLoadedProfileTemplateConfig
): OperatorProofTemplateDefinition {
  return {
    id: config.id,
    adapterId: "dx.browser.command-center",
    host: "browser",
    receiptWriter: {
      script: "scripts/write-browser-loaded-profile-proof-receipts.ts",
      outputReceipt: config.outputReceipt
    },
    evidenceChecklist: [
      checklist("browserExecutablePath", `Record the absolute ${config.target} executable path.`),
      checklist("browserVersion", `Capture the loaded ${config.target} browser version.`),
      checklist("profilePath", "Record the absolute temporary browser profile path."),
      checklist("extensionId", "Record the loaded extension id from the launched profile."),
      checklist("extensionBaseUrl", "Record the loaded extension base URL with the browser-specific scheme."),
      checklist("packageOutputReceiptPath", "Link the current browser package-output receipt."),
      checklist("nativeHostPackageReceiptPath", "Link the browser native-host package receipt."),
      checklist("nativeHostManifestPath", `Record the absolute ${config.target} native-host manifest path.`),
      checklist("nativeHostName", "Record the native-host manifest name."),
      checklist("loadedProfileVerified", "Verify the extension was loaded in a real launched browser profile."),
      checklist("loadedBackgroundServiceWorkerVerified", "Verify the background service worker is loaded."),
      checklist("nativeHostRegistered", "Verify native-host registration for the launched browser profile."),
      checklist("commandRoundTrips", "Capture native-host round trips for status, forge packages, and build graph."),
      checklist("hostUiCommandIds", "Capture host-UI command ids visible in the loaded browser surface.")
    ],
    proof: {
      target: config.target,
      browserExecutablePath: config.browserExecutablePlaceholder,
      browserVersion: config.browserVersionPlaceholder,
      profilePath: config.profilePathPlaceholder,
      extensionId: config.extensionIdPlaceholder,
      extensionBaseUrl: config.extensionBaseUrl,
      packageOutputReceiptPath: "REPLACE_WITH_ABSOLUTE_BROWSER_PACKAGE_OUTPUT_RECEIPT_PATH",
      nativeHostPackageReceiptPath: "REPLACE_WITH_ABSOLUTE_BROWSER_NATIVE_HOST_PACKAGE_RECEIPT_PATH",
      nativeHostManifestPath: config.manifestPathPlaceholder,
      nativeHostName: "dev.dx.browser",
      loadedProfileVerified: false,
      loadedBackgroundServiceWorkerVerified: false,
      nativeHostRegistered: false,
      commandRoundTrips: browserCommandRoundTrips(),
      hostUiCommandIds: ["openReceipts"]
    }
  };
}

function browserCommandRoundTrips(): Record<string, unknown>[] {
  return [
    {
      commandId: "status",
      hostActionId: "dx.browser.show_status",
      handledBy: "native-host",
      ok: false,
      receiptPath: ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
    },
    {
      commandId: "forgePackages",
      hostActionId: "dx.browser.list_forge_packages",
      handledBy: "native-host",
      ok: false,
      receiptPath: ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
    },
    {
      commandId: "showBuildGraph",
      hostActionId: "dx.browser.show_build_graph",
      handledBy: "native-host",
      ok: false,
      receiptPath: ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
    }
  ];
}
