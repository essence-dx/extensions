export type IdeGameEngineSpecialProofTarget =
  | "intellij-platform"
  | "unity-editor"
  | "unreal-engine";
export type IdeGameEngineSpecialProofKind =
  | "plugin_verifier"
  | "project_import"
  | "project_enablement";
export type TestRunStatus = "passed";

export interface IdeGameEngineSpecialProofReceiptOptions {
  generatedAt?: Date | string;
  verificationCommand?: string;
  proof: IdeGameEngineSpecialProof;
}

export interface IdeGameEngineSpecialProof {
  target: IdeGameEngineSpecialProofTarget;
  packageOutputReceiptPath: string;
  loadedHostReceiptPath: string;
  proofFilePath: string;
  pluginVerifier?: IdeGameEnginePluginVerifierProof;
  projectImport?: IdeGameEngineProjectImportProof;
  projectEnablement?: IdeGameEngineProjectEnablementProof;
}

export interface IdeGameEnginePluginVerifierProof {
  toolVersion: string;
  ideVersions: string[];
  compatible: boolean;
  problems: string[];
  warnings: string[];
}

export interface IdeGameEngineProjectImportProof {
  unityVersion: string;
  packageName: string;
  packageVersion: string;
  testProjectKind: "empty-project";
  imported: boolean;
  compileStatus: TestRunStatus;
  editorTestsStatus: TestRunStatus;
  assetDatabaseRefreshed: boolean;
  mutatesProjectAssets: boolean;
}

export interface IdeGameEngineProjectEnablementProof {
  engineVersion: string;
  pluginModuleName: string;
  testProjectKind: "empty-sample-project";
  pluginEnabled: boolean;
  editorModuleLoaded: boolean;
  automationTestsStatus: TestRunStatus;
  mutatesProjectContent: boolean;
}

export type IdeGameEngineSpecialProofReceipt =
  | IdeGameEnginePluginVerifierReceipt
  | IdeGameEngineProjectImportReceipt
  | IdeGameEngineProjectEnablementReceipt;

export interface IdeGameEngineSpecialProofReceiptBase {
  adapterId: string;
  host: IdeGameEngineSpecialProofTarget;
  proofKind: IdeGameEngineSpecialProofKind;
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  packageOutput: {
    receiptPath: string;
    receiptSha256: string;
    packageSha256: string;
    filesVerified: number;
  };
  loadedHostReceiptPath: string;
  loadedHostReceiptSha256: string;
  manualProof: {
    proofFilePath: string;
    proofFileSha256: string;
  };
  releaseClaims: {
    packageOutputVerified: true;
    loadedHostVerified: true;
    localServiceVerified: false;
    signingVerified: false;
    releaseChecksumVerified: false;
    distributionVerified: false;
    marketplaceReviewVerified: false;
    pluginVerifierVerified: boolean;
    projectImportVerified: boolean;
    projectEnablementVerified: boolean;
  };
}

export interface IdeGameEnginePluginVerifierReceipt
  extends IdeGameEngineSpecialProofReceiptBase {
  receipt: "dx.extension.ide_game_engine.plugin_verifier";
  proofKind: "plugin_verifier";
  pluginVerifier: {
    toolName: "JetBrains Plugin Verifier";
    toolVersion: string;
    ideVersions: string[];
    compatible: true;
    problems: [];
    warnings: string[];
  };
}

export interface IdeGameEngineProjectImportReceipt extends IdeGameEngineSpecialProofReceiptBase {
  receipt: "dx.extension.ide_game_engine.project_import";
  proofKind: "project_import";
  projectImport: {
    unityVersion: string;
    packageName: string;
    packageVersion: string;
    testProjectKind: "empty-project";
    imported: true;
    compileStatus: "passed";
    editorTestsStatus: "passed";
    assetDatabaseRefreshed: true;
    mutatesProjectAssets: false;
  };
}

export interface IdeGameEngineProjectEnablementReceipt
  extends IdeGameEngineSpecialProofReceiptBase {
  receipt: "dx.extension.ide_game_engine.project_enablement";
  proofKind: "project_enablement";
  projectEnablement: {
    engineVersion: string;
    pluginModuleName: string;
    testProjectKind: "empty-sample-project";
    pluginEnabled: true;
    editorModuleLoaded: true;
    automationTestsStatus: "passed";
    mutatesProjectContent: false;
  };
}

export interface IdeGameEngineSpecialProofAdapterConfig {
  adapterId: string;
  expectedHost: IdeGameEngineSpecialProofTarget;
  packageOutputReceipt: string;
  receipt: IdeGameEngineSpecialProofReceipt["receipt"];
  proofKind: IdeGameEngineSpecialProofKind;
}

export const releaseGatesRelativePath = "registry/release-evidence-gates.toml";
export const ideGameEngineSpecialProofAdapterConfigs: Record<
  IdeGameEngineSpecialProofTarget,
  IdeGameEngineSpecialProofAdapterConfig
> = {
  "intellij-platform": {
    adapterId: "dx.intellij-platform.command-center",
    expectedHost: "intellij-platform",
    packageOutputReceipt: "dx.extension.intellij_platform.package_output",
    receipt: "dx.extension.ide_game_engine.plugin_verifier",
    proofKind: "plugin_verifier"
  },
  "unity-editor": {
    adapterId: "dx.unity-editor.command-center",
    expectedHost: "unity-editor",
    packageOutputReceipt: "dx.extension.unity_editor.package_output",
    receipt: "dx.extension.ide_game_engine.project_import",
    proofKind: "project_import"
  },
  "unreal-engine": {
    adapterId: "dx.unreal-engine.command-center",
    expectedHost: "unreal-engine",
    packageOutputReceipt: "dx.extension.unreal_engine.package_output",
    receipt: "dx.extension.ide_game_engine.project_enablement",
    proofKind: "project_enablement"
  }
};

export const ideGameEngineSpecialProofKeys = new Set([
  "target",
  "packageOutputReceiptPath",
  "loadedHostReceiptPath",
  "proofFilePath",
  "pluginVerifier",
  "projectImport",
  "projectEnablement"
]);
export const pluginVerifierProofKeys = new Set([
  "toolVersion",
  "ideVersions",
  "compatible",
  "problems",
  "warnings"
]);
export const projectImportProofKeys = new Set([
  "unityVersion",
  "packageName",
  "packageVersion",
  "testProjectKind",
  "imported",
  "compileStatus",
  "editorTestsStatus",
  "assetDatabaseRefreshed",
  "mutatesProjectAssets"
]);
export const projectEnablementProofKeys = new Set([
  "engineVersion",
  "pluginModuleName",
  "testProjectKind",
  "pluginEnabled",
  "editorModuleLoaded",
  "automationTestsStatus",
  "mutatesProjectContent"
]);
export const ideGameEnginePrivacySensitiveProofKeys = new Set([
  "account",
  "apiKey",
  "assetName",
  "documentName",
  "email",
  "filePath",
  "organization",
  "password",
  "projectName",
  "projectPath",
  "sceneName",
  "secret",
  "solutionName",
  "tenant",
  "token",
  "url",
  "workspaceName"
]);
