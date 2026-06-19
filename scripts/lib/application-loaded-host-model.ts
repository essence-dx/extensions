export type ApplicationLoadedHostTarget = "zed" | "blender" | "obsidian" | "canva" | "sketch";

export type ApplicationLoadedHostVerificationMode =
  | "zed-dev-extension"
  | "blender-addon"
  | "obsidian-test-vault"
  | "canva-development-app"
  | "sketch-plugin";

export type ApplicationHostState = "loaded" | "empty" | "unavailable";
export type ApplicationCommandStatus = "proof-blocked" | "visible";

export interface ApplicationLoadedHostReceiptOptions {
  generatedAt?: Date | string;
  verificationCommand?: string;
  proof: ApplicationLoadedHostProof;
}

export interface ApplicationLoadedHostProof {
  target: ApplicationLoadedHostTarget;
  hostApplication: string;
  hostVersion: string;
  hostExecutablePath: string;
  packageOutputReceiptPath: string;
  proofFilePath: string;
  verificationMode: ApplicationLoadedHostVerificationMode;
  loadedHostVerified: boolean;
  extensionInstalled: boolean;
  commandIdsVisible: string[];
  commandResults: ApplicationLoadedHostCommandResult[];
  localServiceRequestsBlocked: boolean;
  hostState: ApplicationHostState;
  mutatesHostDocument: boolean;
  extensionId?: string;
  extensionLoaded?: boolean;
  addonInstalled?: boolean;
  developmentAppVerified?: boolean;
  runtimePermissionsEmpty?: boolean;
  sketchtoolPath?: string;
  sketchtoolVerified?: boolean;
  zedDevExtension?: ZedDevExtensionProof;
}

export interface ApplicationLoadedHostCommandResult {
  commandId: string;
  status: ApplicationCommandStatus;
}

export interface ZedDevExtensionProof {
  sourcePath: string;
  installedPath: string;
  installedPathLinksToSource: boolean;
  extensionIndexPath: string;
  extensionIndexContainsDevExtension: boolean;
  hostLogPath: string;
  hostLogReferencesExtension: boolean;
  wasmArtifactPath: string;
  wasmArtifactSha256: string;
  hostExecutableSha256: string;
}

export interface ApplicationLoadedHostReceipt {
  receipt: "dx.extension.application.loaded_host";
  adapterId: string;
  host: ApplicationLoadedHostTarget;
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  hostApplication: {
    name: string;
    version: string;
    executablePath: string;
    executableSha256: string;
    verificationMode: ApplicationLoadedHostVerificationMode;
    hostState: ApplicationHostState;
  };
  packageOutput: {
    receiptPath: string;
    receiptSha256: string;
    packageSha256: string;
  };
  loadedHost: {
    extensionInstalled: true;
    commandIdsVisible: string[];
    commandResults: ApplicationLoadedHostCommandResult[];
    localServiceRequestsBlocked: true;
    mutatesHostDocument: false;
  };
  manualProof: {
    proofFilePath: string;
    proofFileSha256: string;
  };
  zed?: {
    extensionId: "dx-command-center";
    devExtensionLoaded: true;
    sourcePath: string;
    installedPath: string;
    installedPathLinksToSource: true;
    extensionIndexPath: string;
    extensionIndexSha256: string;
    extensionIndexContainsDevExtension: true;
    hostLogPath: string;
    hostLogSha256: string;
    hostLogReferencesExtension: true;
    wasmArtifactPath: string;
    wasmArtifactSha256: string;
    hostExecutableSha256: string;
  };
  blender?: {
    addonModule: "dx_blender_command_center";
    addonInstalled: true;
  };
  obsidian?: {
    pluginId: "dx-command-center";
    testVaultLoaded: true;
  };
  canva?: {
    developmentAppVerified: true;
    runtimePermissionsEmpty: true;
  };
  sketch?: {
    pluginIdentifier: "dev.dx.sketch.command-center";
    pluginLoaded: true;
    sketchtoolVerified: boolean;
  };
  releaseClaims: ApplicationLoadedHostReleaseClaims;
}

export interface ApplicationLoadedHostReleaseClaims {
  loadedHostVerified: true;
  localServiceVerified: false;
  signingVerified: false;
  releaseChecksumVerified: false;
  distributionVerified: false;
  addonInstallVerified: boolean;
  developmentAppVerified: boolean;
  galleryReviewVerified: false;
  communityReviewVerified: false;
  sketchtoolVerified: boolean;
}

export interface BlenderAddonInstallReceipt {
  receipt: "dx.extension.blender.addon_install";
  adapterId: "dx.blender.command-center";
  host: "blender";
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  loadedHostReceiptPath: string;
  loadedHostReceiptSha256: string;
  packageOutput: ApplicationLoadedHostReceipt["packageOutput"];
  addon: {
    module: "dx_blender_command_center";
    installed: true;
  };
  manualProof: ApplicationLoadedHostReceipt["manualProof"];
  releaseClaims: {
    loadedHostVerified: true;
    addonInstallVerified: true;
    signingVerified: false;
    releaseChecksumVerified: false;
    distributionVerified: false;
  };
}

export interface SketchtoolRunReceipt {
  receipt: "dx.extension.sketch.sketchtool_run";
  adapterId: "dx.sketch.command-center";
  host: "sketch";
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  loadedHostReceiptPath: string;
  loadedHostReceiptSha256: string;
  packageOutput: ApplicationLoadedHostReceipt["packageOutput"];
  sketchtool: {
    path: string;
    sha256: string;
    commandIdsVerified: string[];
  };
  manualProof: ApplicationLoadedHostReceipt["manualProof"];
  releaseClaims: {
    loadedHostVerified: true;
    sketchtoolVerified: true;
    signingVerified: false;
    releaseChecksumVerified: false;
    notarizationVerified: false;
    distributionVerified: false;
  };
}

export interface ApplicationLoadedHostAdapterConfig {
  adapterId: string;
  hostApplication: string;
  packageHost: ApplicationLoadedHostTarget;
  receiptName: string;
  requiredCommandIds: string[];
  target: ApplicationLoadedHostTarget;
  verificationMode: ApplicationLoadedHostVerificationMode;
}

export const applicationLoadedHostAdapterConfigs: Record<
  ApplicationLoadedHostTarget,
  ApplicationLoadedHostAdapterConfig
> = {
  zed: {
    adapterId: "dx.zed.command-center",
    hostApplication: "Zed",
    packageHost: "zed",
    receiptName: "loaded-dev-extension-latest.json",
    requiredCommandIds: [],
    target: "zed",
    verificationMode: "zed-dev-extension"
  },
  blender: {
    adapterId: "dx.blender.command-center",
    hostApplication: "Blender",
    packageHost: "blender",
    receiptName: "loaded-host-latest.json",
    requiredCommandIds: ["dx.show_status", "dx.run_doctor", "dx.open_receipts"],
    target: "blender",
    verificationMode: "blender-addon"
  },
  obsidian: {
    adapterId: "dx.obsidian.command-center",
    hostApplication: "Obsidian",
    packageHost: "obsidian",
    receiptName: "loaded-vault-latest.json",
    requiredCommandIds: ["dx-show-status", "dx-run-doctor", "dx-copy-receipts-path"],
    target: "obsidian",
    verificationMode: "obsidian-test-vault"
  },
  canva: {
    adapterId: "dx.canva.command-center",
    hostApplication: "Canva",
    packageHost: "canva",
    receiptName: "development-app-latest.json",
    requiredCommandIds: ["showStatus", "searchAssets", "copyReceiptsPath"],
    target: "canva",
    verificationMode: "canva-development-app"
  },
  sketch: {
    adapterId: "dx.sketch.command-center",
    hostApplication: "Sketch",
    packageHost: "sketch",
    receiptName: "loaded-host-latest.json",
    requiredCommandIds: ["show-status", "search-assets", "show-receipts"],
    target: "sketch",
    verificationMode: "sketch-plugin"
  }
};
