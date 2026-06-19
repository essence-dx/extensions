import {
  type OperatorProofTemplateDefinition,
  checklist
} from "./operator-proof-template-model.ts";

export const affinityOperatorProofTemplates: OperatorProofTemplateDefinition[] = [
  {
    id: "affinity-manual-import",
    adapterId: "dx.affinity-content.bridge",
    host: "affinity",
    receiptWriter: {
      script: "scripts/write-affinity-manual-import-receipt.ts",
      outputReceipt: "manual-import-latest.json"
    },
    evidenceChecklist: [
      checklist("affinityHost", "Select the Affinity application used for manual import."),
      checklist("hostVersion", "Capture the Affinity host version."),
      checklist("contentPackageReceiptPath", "Link the current Affinity content-package receipt."),
      checklist("proofFilePath", "Attach a metadata-only manual proof file."),
      checklist("importedContentTypes", "Record the content types imported from the package."),
      checklist("importedArtifactPaths", "Record imported artifact paths from the package receipt."),
      checklist("importSurfaces", "Record host import surfaces such as Assets, Fonts, or Swatches.")
    ],
    proof: {
      affinityHost: "Affinity Photo 2",
      hostVersion: "REPLACE_WITH_AFFINITY_HOST_VERSION",
      contentPackageReceiptPath: "REPLACE_WITH_ABSOLUTE_CONTENT_PACKAGE_RECEIPT_PATH",
      proofFilePath: "REPLACE_WITH_ABSOLUTE_MANUAL_PROOF_FILE_PATH",
      importedContentTypes: ["REPLACE_WITH_IMPORTED_CONTENT_TYPE"],
      importedArtifactPaths: ["REPLACE_WITH_IMPORTED_ARTIFACT_RELATIVE_PATH"],
      importSurfaces: ["REPLACE_WITH_AFFINITY_IMPORT_SURFACE"],
      operator: "REPLACE_WITH_CAPTURE_OPERATOR",
      notes: ["REPLACE_WITH_METADATA_ONLY_NOTE"]
    }
  },
  {
    id: "affinity-loaded-app",
    adapterId: "dx.affinity-content.bridge",
    host: "affinity",
    receiptWriter: {
      script: "scripts/write-affinity-loaded-app-receipt.ts",
      outputReceipt: "loaded-app-latest.json"
    },
    evidenceChecklist: [
      checklist("affinityHost", "Select the Affinity application used for loaded-app proof."),
      checklist("hostVersion", "Capture the Affinity host version."),
      checklist("hostExecutablePath", "Record the absolute Affinity executable path."),
      checklist("contentPackageReceiptPath", "Link the current Affinity content-package receipt."),
      checklist("manualImportReceiptPath", "Link the verified manual-import receipt."),
      checklist("proofFilePath", "Attach a metadata-only manual proof file."),
      checklist("importSurfaces", "Record the import surfaces visible in the loaded app.")
    ],
    proof: {
      affinityHost: "Affinity Photo 2",
      hostVersion: "REPLACE_WITH_AFFINITY_HOST_VERSION",
      hostExecutablePath: "REPLACE_WITH_ABSOLUTE_AFFINITY_EXECUTABLE_PATH",
      contentPackageReceiptPath: "REPLACE_WITH_ABSOLUTE_CONTENT_PACKAGE_RECEIPT_PATH",
      manualImportReceiptPath: "REPLACE_WITH_ABSOLUTE_MANUAL_IMPORT_RECEIPT_PATH",
      proofFilePath: "REPLACE_WITH_ABSOLUTE_MANUAL_PROOF_FILE_PATH",
      loadedAppVerified: false,
      contentPackageLoaded: false,
      manualImportVisible: false,
      importedContentTypes: ["REPLACE_WITH_IMPORTED_CONTENT_TYPE"],
      importedArtifactPaths: ["REPLACE_WITH_IMPORTED_ARTIFACT_RELATIVE_PATH"],
      importSurfaces: ["REPLACE_WITH_AFFINITY_IMPORT_SURFACE"],
      mutatesAffinityDocument: false,
      storesAffinityPayloads: false
    }
  },
  {
    id: "affinity-photoshop-filter-plugin",
    adapterId: "dx.affinity-content.bridge",
    host: "affinity",
    receiptWriter: {
      script: "scripts/write-affinity-photoshop-filter-plugin-receipt.ts",
      outputReceipt: "photoshop-filter-plugin-latest.json"
    },
    evidenceChecklist: [
      checklist("loadedAppReceiptPath", "Link the verified loaded Affinity Photo receipt."),
      checklist("proofFilePath", "Attach a metadata-only manual proof file."),
      checklist("filterPluginArtifactPath", "Record the absolute Photoshop-compatible filter artifact path."),
      checklist("loadedByAffinityPhoto", "Verify Affinity Photo loaded the filter plugin.")
    ],
    proof: {
      loadedAppReceiptPath: "REPLACE_WITH_ABSOLUTE_AFFINITY_LOADED_APP_RECEIPT_PATH",
      proofFilePath: "REPLACE_WITH_ABSOLUTE_MANUAL_PROOF_FILE_PATH",
      filterPluginArtifactPath: "REPLACE_WITH_ABSOLUTE_FILTER_PLUGIN_ARTIFACT_PATH",
      loadedByAffinityPhoto: false,
      metadataOnly: true,
      mutatesAffinityDocument: false,
      storesAffinityPayloads: false
    }
  }
];
