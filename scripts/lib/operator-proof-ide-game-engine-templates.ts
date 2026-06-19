import { expectedIdeGameEngineCommandResultFor } from "./ide-game-engine-command-result-semantics.ts";
import {
  type OperatorProofHost,
  type OperatorProofTemplateDefinition,
  checklist
} from "./operator-proof-template-model.ts";

type IdeGameEngineHost = Extract<
  OperatorProofHost,
  "intellij-platform" | "visual-studio" | "unity-editor" | "unreal-engine"
>;
type IdeGameEngineLoadedHostTemplateId =
  | "intellij-platform-sandbox-ide"
  | "visual-studio-experimental-instance"
  | "unity-editor-loaded-host"
  | "unreal-engine-loaded-host";
type IdeGameEngineVerificationMode = "sandbox-ide" | "experimental-instance" | "loaded-editor";

interface LoadedHostTemplateConfig {
  adapterId: string;
  commandIds: string[];
  host: IdeGameEngineHost;
  hostApplication: string;
  hostExecutablePlaceholder: string;
  hostVersionPlaceholder: string;
  id: IdeGameEngineLoadedHostTemplateId;
  outputReceipt: string;
  verificationMode: IdeGameEngineVerificationMode;
}

const intellijLoadedHostTemplateConfig: LoadedHostTemplateConfig = {
  adapterId: "dx.intellij-platform.command-center",
  commandIds: [
    "dx.intellij-platform.show_status",
    "dx.intellij-platform.search_assets",
    "dx.intellij-platform.show_receipts"
  ],
  host: "intellij-platform",
  hostApplication: "IntelliJ IDEA",
  hostExecutablePlaceholder: "REPLACE_WITH_ABSOLUTE_INTELLIJ_IDEA_EXECUTABLE_PATH",
  hostVersionPlaceholder: "REPLACE_WITH_INTELLIJ_IDEA_VERSION",
  id: "intellij-platform-sandbox-ide",
  outputReceipt: "sandbox-ide-latest.json",
  verificationMode: "sandbox-ide"
};
const visualStudioLoadedHostTemplateConfig: LoadedHostTemplateConfig = {
  adapterId: "dx.visual-studio.command-center",
  commandIds: [
    "dx.visual-studio.show_status",
    "dx.visual-studio.search_assets",
    "dx.visual-studio.show_receipts"
  ],
  host: "visual-studio",
  hostApplication: "Visual Studio",
  hostExecutablePlaceholder: "REPLACE_WITH_ABSOLUTE_VISUAL_STUDIO_DEVENV_PATH",
  hostVersionPlaceholder: "REPLACE_WITH_VISUAL_STUDIO_VERSION",
  id: "visual-studio-experimental-instance",
  outputReceipt: "experimental-instance-latest.json",
  verificationMode: "experimental-instance"
};
const unityLoadedHostTemplateConfig: LoadedHostTemplateConfig = {
  adapterId: "dx.unity-editor.command-center",
  commandIds: [
    "dx.unity-editor.show_status",
    "dx.unity-editor.search_assets",
    "dx.unity-editor.show_receipts"
  ],
  host: "unity-editor",
  hostApplication: "Unity Editor",
  hostExecutablePlaceholder: "REPLACE_WITH_ABSOLUTE_UNITY_EDITOR_EXECUTABLE_PATH",
  hostVersionPlaceholder: "REPLACE_WITH_UNITY_EDITOR_VERSION",
  id: "unity-editor-loaded-host",
  outputReceipt: "loaded-host-latest.json",
  verificationMode: "loaded-editor"
};
const unrealLoadedHostTemplateConfig: LoadedHostTemplateConfig = {
  adapterId: "dx.unreal-engine.command-center",
  commandIds: [
    "dx.unreal-engine.show_status",
    "dx.unreal-engine.search_assets",
    "dx.unreal-engine.show_receipts"
  ],
  host: "unreal-engine",
  hostApplication: "Unreal Editor",
  hostExecutablePlaceholder: "REPLACE_WITH_ABSOLUTE_UNREAL_EDITOR_EXECUTABLE_PATH",
  hostVersionPlaceholder: "REPLACE_WITH_UNREAL_EDITOR_VERSION",
  id: "unreal-engine-loaded-host",
  outputReceipt: "loaded-host-latest.json",
  verificationMode: "loaded-editor"
};

export const ideGameEngineOperatorProofTemplates: OperatorProofTemplateDefinition[] = [
  createLoadedHostTemplate(intellijLoadedHostTemplateConfig),
  createIntellijPluginVerifierTemplate(),
  createLoadedHostTemplate(visualStudioLoadedHostTemplateConfig),
  createLoadedHostTemplate(unityLoadedHostTemplateConfig),
  createUnityProjectImportTemplate(),
  createLoadedHostTemplate(unrealLoadedHostTemplateConfig),
  createUnrealProjectEnablementTemplate()
];

function createLoadedHostTemplate(config: LoadedHostTemplateConfig): OperatorProofTemplateDefinition {
  return {
    id: config.id,
    adapterId: config.adapterId,
    host: config.host,
    receiptWriter: {
      script: "scripts/write-ide-game-engine-loaded-host-receipts.ts",
      outputReceipt: config.outputReceipt
    },
    evidenceChecklist: [
      checklist("hostVersion", `Capture the loaded ${config.hostApplication} version.`),
      checklist("hostExecutablePath", `Record the absolute ${config.hostApplication} executable path.`),
      checklist("packageOutputReceiptPath", `Link the current ${config.hostApplication} package-output receipt.`),
      checklist("proofFilePath", "Attach a metadata-only manual proof file."),
      checklist("verificationMode", `Keep the verification mode as ${config.verificationMode}.`),
      checklist("loadedHostVerified", `Verify the DX extension is loaded in ${config.hostApplication}.`),
      checklist("extensionInstalled", "Verify the extension is installed in the host."),
      checklist("commandIdsVisible", "Record visible command identifiers."),
      checklist("commandResults", "Record clicked, visible, or proof-blocked command metadata."),
      checklist("localServiceRequestsBlocked", "Confirm local-service requests stayed blocked until explicit proof."),
      checklist("projectState", "Use a coarse loaded project state without project names or paths.")
    ],
    proof: {
      target: config.host,
      hostApplication: config.hostApplication,
      hostVersion: config.hostVersionPlaceholder,
      hostExecutablePath: config.hostExecutablePlaceholder,
      packageOutputReceiptPath: "REPLACE_WITH_ABSOLUTE_PACKAGE_OUTPUT_RECEIPT_PATH",
      proofFilePath: "REPLACE_WITH_ABSOLUTE_MANUAL_PROOF_FILE_PATH",
      verificationMode: config.verificationMode,
      loadedHostVerified: false,
      extensionInstalled: false,
      commandIdsVisible: sortedCommandIds(config.commandIds),
      commandResults: commandResults(config.commandIds),
      localServiceRequestsBlocked: false,
      projectState: "unavailable"
    }
  };
}

function createIntellijPluginVerifierTemplate(): OperatorProofTemplateDefinition {
  return {
    id: "intellij-platform-plugin-verifier",
    adapterId: "dx.intellij-platform.command-center",
    host: "intellij-platform",
    receiptWriter: {
      script: "scripts/write-ide-game-engine-special-proof-receipts.ts",
      outputReceipt: "plugin-verifier-latest.json"
    },
    evidenceChecklist: [
      checklist("packageOutputReceiptPath", "Link the current IntelliJ Platform package-output receipt."),
      checklist("loadedHostReceiptPath", "Link the verified IntelliJ sandbox IDE receipt."),
      checklist("proofFilePath", "Attach the metadata-only Plugin Verifier proof file."),
      checklist("toolVersion", "Capture the JetBrains Plugin Verifier version."),
      checklist("ideVersions", "Record every compatible IntelliJ Platform IDE version."),
      checklist("compatible", "Verify Plugin Verifier compatibility."),
      checklist("problems", "Record an empty Plugin Verifier problems list."),
      checklist("warnings", "Record Plugin Verifier warnings without user or project details.")
    ],
    proof: {
      target: "intellij-platform",
      packageOutputReceiptPath: "REPLACE_WITH_ABSOLUTE_PACKAGE_OUTPUT_RECEIPT_PATH",
      loadedHostReceiptPath: "REPLACE_WITH_ABSOLUTE_SANDBOX_IDE_RECEIPT_PATH",
      proofFilePath: "REPLACE_WITH_ABSOLUTE_PLUGIN_VERIFIER_PROOF_FILE_PATH",
      pluginVerifier: {
        toolVersion: "REPLACE_WITH_PLUGIN_VERIFIER_VERSION",
        ideVersions: [],
        compatible: false,
        problems: [],
        warnings: []
      }
    }
  };
}

function createUnityProjectImportTemplate(): OperatorProofTemplateDefinition {
  return {
    id: "unity-editor-project-import",
    adapterId: "dx.unity-editor.command-center",
    host: "unity-editor",
    receiptWriter: {
      script: "scripts/write-ide-game-engine-special-proof-receipts.ts",
      outputReceipt: "project-import-latest.json"
    },
    evidenceChecklist: [
      checklist("packageOutputReceiptPath", "Link the current Unity package-output receipt."),
      checklist("loadedHostReceiptPath", "Link the verified Unity loaded-host receipt."),
      checklist("proofFilePath", "Attach the metadata-only Unity project import proof file."),
      checklist("unityVersion", "Capture the loaded Unity Editor version."),
      checklist("packageName", "Record the Unity package name from package output."),
      checklist("packageVersion", "Record the Unity package version from package output."),
      checklist("imported", "Verify import into an empty test project."),
      checklist("compileStatus", "Verify editor compilation passed."),
      checklist("editorTestsStatus", "Verify editor tests passed."),
      checklist("assetDatabaseRefreshed", "Verify the AssetDatabase refreshed after import."),
      checklist("mutatesProjectAssets", "Confirm the proof did not mutate project assets.")
    ],
    proof: {
      target: "unity-editor",
      packageOutputReceiptPath: "REPLACE_WITH_ABSOLUTE_PACKAGE_OUTPUT_RECEIPT_PATH",
      loadedHostReceiptPath: "REPLACE_WITH_ABSOLUTE_LOADED_HOST_RECEIPT_PATH",
      proofFilePath: "REPLACE_WITH_ABSOLUTE_PROJECT_IMPORT_PROOF_FILE_PATH",
      projectImport: {
        unityVersion: "REPLACE_WITH_UNITY_VERSION",
        packageName: "dev.dx.unity-command-center",
        packageVersion: "REPLACE_WITH_PACKAGE_VERSION",
        testProjectKind: "empty-project",
        imported: false,
        compileStatus: "not-run",
        editorTestsStatus: "not-run",
        assetDatabaseRefreshed: false,
        mutatesProjectAssets: false
      }
    }
  };
}

function createUnrealProjectEnablementTemplate(): OperatorProofTemplateDefinition {
  return {
    id: "unreal-engine-project-enablement",
    adapterId: "dx.unreal-engine.command-center",
    host: "unreal-engine",
    receiptWriter: {
      script: "scripts/write-ide-game-engine-special-proof-receipts.ts",
      outputReceipt: "project-enablement-latest.json"
    },
    evidenceChecklist: [
      checklist("packageOutputReceiptPath", "Link the current Unreal package-output receipt."),
      checklist("loadedHostReceiptPath", "Link the verified Unreal loaded-host receipt."),
      checklist("proofFilePath", "Attach the metadata-only Unreal project enablement proof file."),
      checklist("engineVersion", "Capture the loaded Unreal Engine version."),
      checklist("pluginModuleName", "Record the editor module name from package output."),
      checklist("pluginEnabled", "Verify the plugin is enabled in an empty sample project."),
      checklist("editorModuleLoaded", "Verify the editor module loaded."),
      checklist("automationTestsStatus", "Verify automation tests passed."),
      checklist("mutatesProjectContent", "Confirm the proof did not mutate project content.")
    ],
    proof: {
      target: "unreal-engine",
      packageOutputReceiptPath: "REPLACE_WITH_ABSOLUTE_PACKAGE_OUTPUT_RECEIPT_PATH",
      loadedHostReceiptPath: "REPLACE_WITH_ABSOLUTE_LOADED_HOST_RECEIPT_PATH",
      proofFilePath: "REPLACE_WITH_ABSOLUTE_PROJECT_ENABLEMENT_PROOF_FILE_PATH",
      projectEnablement: {
        engineVersion: "REPLACE_WITH_UNREAL_ENGINE_VERSION",
        pluginModuleName: "DXUnrealCommandCenterEditor",
        testProjectKind: "empty-sample-project",
        pluginEnabled: false,
        editorModuleLoaded: false,
        automationTestsStatus: "not-run",
        mutatesProjectContent: false
      }
    }
  };
}

function commandResults(commandIds: string[]): Record<string, unknown>[] {
  return sortedCommandIds(commandIds).map((commandId) => {
    const expected = expectedIdeGameEngineCommandResultFor(commandId);

    if (!expected) {
      throw new Error(`Unsupported IDE/game-engine command id: ${commandId}`);
    }

    return {
      commandId,
      operation: expected.operation,
      transport: expected.transport,
      status: expected.status
    };
  });
}

function sortedCommandIds(commandIds: string[]): string[] {
  return [...commandIds].sort();
}
