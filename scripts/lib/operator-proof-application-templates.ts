import {
  type OperatorProofTemplateDefinition,
  checklist,
  proofBlockedResults
} from "./operator-proof-template-model.ts";

const applicationLoadedHostWriter = {
  script: "scripts/write-application-loaded-host-receipts.ts"
};

export const applicationOperatorProofTemplates: OperatorProofTemplateDefinition[] = [
  {
    id: "zed-dev-extension",
    adapterId: "dx.zed.command-center",
    host: "zed",
    receiptWriter: {
      ...applicationLoadedHostWriter,
      outputReceipt: "loaded-dev-extension-latest.json"
    },
    evidenceChecklist: [
      checklist("hostVersion", "Capture the loaded Zed host version."),
      checklist("hostExecutablePath", "Record the absolute Zed executable path."),
      checklist("packageOutputReceiptPath", "Link the current Zed package-output receipt."),
      checklist("proofFilePath", "Attach a metadata-only manual proof file."),
      checklist("zedDevExtension", "Capture source, installed path, index, log, WASM, and host hashes.")
    ],
    proof: {
      target: "zed",
      hostApplication: "Zed",
      hostVersion: "REPLACE_WITH_ZED_VERSION",
      hostExecutablePath: "REPLACE_WITH_ABSOLUTE_ZED_EXECUTABLE_PATH",
      packageOutputReceiptPath: "REPLACE_WITH_ABSOLUTE_PACKAGE_OUTPUT_RECEIPT_PATH",
      proofFilePath: "REPLACE_WITH_ABSOLUTE_MANUAL_PROOF_FILE_PATH",
      verificationMode: "zed-dev-extension",
      loadedHostVerified: false,
      extensionInstalled: false,
      commandIdsVisible: [],
      commandResults: [],
      localServiceRequestsBlocked: false,
      hostState: "unavailable",
      mutatesHostDocument: false,
      zedDevExtension: {
        sourcePath: "REPLACE_WITH_ABSOLUTE_ZED_EXTENSION_SOURCE_PATH",
        installedPath: "REPLACE_WITH_ABSOLUTE_ZED_INSTALLED_EXTENSION_PATH",
        installedPathLinksToSource: false,
        extensionIndexPath: "REPLACE_WITH_ABSOLUTE_ZED_EXTENSION_INDEX_PATH",
        extensionIndexContainsDevExtension: false,
        hostLogPath: "REPLACE_WITH_ABSOLUTE_ZED_HOST_LOG_PATH",
        hostLogReferencesExtension: false,
        wasmArtifactPath: "REPLACE_WITH_ABSOLUTE_ZED_WASM_ARTIFACT_PATH",
        wasmArtifactSha256: "REPLACE_WITH_ZED_WASM_SHA256",
        hostExecutableSha256: "REPLACE_WITH_ZED_HOST_EXECUTABLE_SHA256"
      }
    }
  },
  {
    id: "blender",
    adapterId: "dx.blender.command-center",
    host: "blender",
    receiptWriter: {
      ...applicationLoadedHostWriter,
      outputReceipt: "loaded-host-latest.json",
      outputReceipts: ["loaded-host-latest.json", "addon-install-latest.json"]
    },
    evidenceChecklist: [
      checklist("hostVersion", "Capture the loaded Blender version."),
      checklist("hostExecutablePath", "Record the absolute Blender executable path."),
      checklist("packageOutputReceiptPath", "Link the current Blender package-output receipt."),
      checklist("proofFilePath", "Attach a metadata-only manual proof file."),
      checklist("addonInstalled", "Verify the DX Blender add-on is installed and enabled."),
      checklist("commandResults", "Record visible or proof-blocked command metadata for every required operator.")
    ],
    proof: {
      target: "blender",
      hostApplication: "Blender",
      hostVersion: "REPLACE_WITH_BLENDER_VERSION",
      hostExecutablePath: "REPLACE_WITH_ABSOLUTE_BLENDER_EXECUTABLE_PATH",
      packageOutputReceiptPath: "REPLACE_WITH_ABSOLUTE_PACKAGE_OUTPUT_RECEIPT_PATH",
      proofFilePath: "REPLACE_WITH_ABSOLUTE_MANUAL_PROOF_FILE_PATH",
      verificationMode: "blender-addon",
      loadedHostVerified: false,
      extensionInstalled: false,
      commandIdsVisible: ["dx.open_receipts", "dx.run_doctor", "dx.show_status"],
      commandResults: proofBlockedResults(["dx.show_status", "dx.run_doctor", "dx.open_receipts"]),
      localServiceRequestsBlocked: false,
      hostState: "unavailable",
      mutatesHostDocument: false,
      extensionId: "dx_blender_command_center",
      addonInstalled: false
    }
  },
  {
    id: "obsidian",
    adapterId: "dx.obsidian.command-center",
    host: "obsidian",
    receiptWriter: {
      ...applicationLoadedHostWriter,
      outputReceipt: "loaded-vault-latest.json"
    },
    evidenceChecklist: [
      checklist("hostVersion", "Capture the loaded Obsidian desktop version."),
      checklist("hostExecutablePath", "Record the absolute Obsidian executable path."),
      checklist("packageOutputReceiptPath", "Link the current Obsidian package-output receipt."),
      checklist("proofFilePath", "Attach a metadata-only manual proof file."),
      checklist("extensionLoaded", "Verify the DX plugin is loaded inside a test vault."),
      checklist("commandResults", "Record visible or proof-blocked command metadata for every required command.")
    ],
    proof: {
      target: "obsidian",
      hostApplication: "Obsidian",
      hostVersion: "REPLACE_WITH_OBSIDIAN_VERSION",
      hostExecutablePath: "REPLACE_WITH_ABSOLUTE_OBSIDIAN_EXECUTABLE_PATH",
      packageOutputReceiptPath: "REPLACE_WITH_ABSOLUTE_PACKAGE_OUTPUT_RECEIPT_PATH",
      proofFilePath: "REPLACE_WITH_ABSOLUTE_MANUAL_PROOF_FILE_PATH",
      verificationMode: "obsidian-test-vault",
      loadedHostVerified: false,
      extensionInstalled: false,
      commandIdsVisible: ["dx-copy-receipts-path", "dx-run-doctor", "dx-show-status"],
      commandResults: proofBlockedResults(["dx-show-status", "dx-run-doctor", "dx-copy-receipts-path"]),
      localServiceRequestsBlocked: false,
      hostState: "unavailable",
      mutatesHostDocument: false,
      extensionId: "dx-command-center",
      extensionLoaded: false
    }
  },
  {
    id: "canva-development-app",
    adapterId: "dx.canva.command-center",
    host: "canva",
    receiptWriter: {
      ...applicationLoadedHostWriter,
      outputReceipt: "development-app-latest.json"
    },
    evidenceChecklist: [
      checklist("hostVersion", "Capture the loaded Canva app runtime version or build marker."),
      checklist("hostExecutablePath", "Record the absolute browser or app host executable path used for the run."),
      checklist("packageOutputReceiptPath", "Link the current Canva package-output receipt."),
      checklist("proofFilePath", "Attach a metadata-only manual proof file."),
      checklist("developmentAppVerified", "Verify the DX Canva development app is loaded."),
      checklist("commandResults", "Record visible or proof-blocked command metadata for every required action.")
    ],
    proof: {
      target: "canva",
      hostApplication: "Canva",
      hostVersion: "REPLACE_WITH_CANVA_RUNTIME_VERSION",
      hostExecutablePath: "REPLACE_WITH_ABSOLUTE_CANVA_HOST_EXECUTABLE_PATH",
      packageOutputReceiptPath: "REPLACE_WITH_ABSOLUTE_PACKAGE_OUTPUT_RECEIPT_PATH",
      proofFilePath: "REPLACE_WITH_ABSOLUTE_MANUAL_PROOF_FILE_PATH",
      verificationMode: "canva-development-app",
      loadedHostVerified: false,
      extensionInstalled: false,
      commandIdsVisible: ["copyReceiptsPath", "searchAssets", "showStatus"],
      commandResults: proofBlockedResults(["showStatus", "searchAssets", "copyReceiptsPath"]),
      localServiceRequestsBlocked: false,
      hostState: "unavailable",
      mutatesHostDocument: false,
      developmentAppVerified: false,
      runtimePermissionsEmpty: false
    }
  },
  {
    id: "sketch",
    adapterId: "dx.sketch.command-center",
    host: "sketch",
    receiptWriter: {
      ...applicationLoadedHostWriter,
      outputReceipt: "loaded-host-latest.json",
      outputReceipts: ["loaded-host-latest.json", "sketchtool-latest.json"]
    },
    evidenceChecklist: [
      checklist("hostVersion", "Capture the loaded Sketch version."),
      checklist("hostExecutablePath", "Record the absolute Sketch executable path."),
      checklist("packageOutputReceiptPath", "Link the current Sketch package-output receipt."),
      checklist("proofFilePath", "Attach a metadata-only manual proof file."),
      checklist("extensionLoaded", "Verify the DX Sketch plugin is loaded."),
      checklist("sketchtoolVerified", "State whether sketchtool proof is also captured."),
      checklist("commandResults", "Record visible or proof-blocked command metadata for every required command.")
    ],
    proof: {
      target: "sketch",
      hostApplication: "Sketch",
      hostVersion: "REPLACE_WITH_SKETCH_VERSION",
      hostExecutablePath: "REPLACE_WITH_ABSOLUTE_SKETCH_EXECUTABLE_PATH",
      packageOutputReceiptPath: "REPLACE_WITH_ABSOLUTE_PACKAGE_OUTPUT_RECEIPT_PATH",
      proofFilePath: "REPLACE_WITH_ABSOLUTE_MANUAL_PROOF_FILE_PATH",
      verificationMode: "sketch-plugin",
      loadedHostVerified: false,
      extensionInstalled: false,
      commandIdsVisible: ["search-assets", "show-receipts", "show-status"],
      commandResults: proofBlockedResults(["show-status", "search-assets", "show-receipts"]),
      localServiceRequestsBlocked: false,
      hostState: "unavailable",
      mutatesHostDocument: false,
      extensionId: "dev.dx.sketch.command-center",
      extensionLoaded: false,
      sketchtoolVerified: false
    }
  }
];
