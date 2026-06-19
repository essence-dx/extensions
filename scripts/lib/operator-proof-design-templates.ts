import {
  type OperatorProofTemplateDefinition,
  canvaRequest,
  canvaResponse,
  checklist,
  proofBlockedResults
} from "./operator-proof-template-model.ts";

export const designOperatorProofTemplates: OperatorProofTemplateDefinition[] = [
  {
    id: "figma",
    adapterId: "dx.figma.command-center",
    host: "figma",
    receiptWriter: {
      script: "scripts/write-figma-loaded-host-receipts.ts",
      outputReceipt: "loaded-host-latest.json",
      outputReceipts: ["loaded-host-latest.json", "plugin-id-latest.json"]
    },
    evidenceChecklist: [
      checklist("hostVersion", "Capture the loaded Figma Desktop version."),
      checklist("hostExecutablePath", "Record the absolute Figma executable path."),
      checklist("packageOutputReceiptPath", "Link the current Figma package-output receipt."),
      checklist("proofFilePath", "Attach a metadata-only manual proof file."),
      checklist("manifestPluginId", "Record the Figma manifest plugin id observed in the package."),
      checklist("pluginUiRendered", "Verify the plugin UI rendered in a test file."),
      checklist("menuCommandsVisible", "Record the visible Figma menu command metadata."),
      checklist("commandResults", "Record visible or proof-blocked command metadata for every required command.")
    ],
    proof: {
      hostApplication: "Figma",
      hostVersion: "REPLACE_WITH_FIGMA_VERSION",
      hostExecutablePath: "REPLACE_WITH_ABSOLUTE_FIGMA_EXECUTABLE_PATH",
      packageOutputReceiptPath: "REPLACE_WITH_ABSOLUTE_PACKAGE_OUTPUT_RECEIPT_PATH",
      proofFilePath: "REPLACE_WITH_ABSOLUTE_MANUAL_PROOF_FILE_PATH",
      verificationMode: "figma-desktop-plugin",
      loadedHostVerified: false,
      pluginIdVerified: false,
      manifestPluginId: "REPLACE_WITH_FIGMA_MANIFEST_PLUGIN_ID",
      pluginUiRendered: false,
      menuCommandsVisible: ["copy-receipts-path", "search-assets", "show-status"],
      commandIdsVisible: [
        "dx.figma.copy_receipts_path",
        "dx.figma.search_assets",
        "dx.figma.show_status"
      ],
      commandResults: proofBlockedResults([
        "dx.figma.show_status",
        "dx.figma.search_assets",
        "dx.figma.copy_receipts_path"
      ]),
      localServiceRequestsBlocked: false,
      fileState: "unavailable",
      networkAccessRestricted: false,
      mutatesFigmaFile: false,
      storesFigmaPayloads: false
    }
  },
  {
    id: "canva-cloud-service",
    adapterId: "dx.canva.command-center",
    host: "canva",
    receiptWriter: {
      script: "scripts/write-canva-cloud-service-receipt.ts",
      outputReceipt: "cloud-service-latest.json"
    },
    evidenceChecklist: [
      checklist("loadedHostReceiptPath", "Link the verified Canva development-app receipt."),
      checklist("proofFilePath", "Attach a metadata-only manual proof file."),
      checklist("serviceEndpointHost", "Record only the cloud-service host name."),
      checklist("requests", "Record metadata-only request evidence for every required Canva action."),
      checklist("responses", "Replace proof-blocked responses with successful metadata-only card evidence.")
    ],
    proof: {
      loadedHostReceiptPath: "REPLACE_WITH_ABSOLUTE_CANVA_LOADED_HOST_RECEIPT_PATH",
      proofFilePath: "REPLACE_WITH_ABSOLUTE_MANUAL_PROOF_FILE_PATH",
      cloudServiceVerified: false,
      serviceEndpointHost: "REPLACE_WITH_SERVICE_HOST_NAME",
      serviceTransport: "https",
      requests: [
        canvaRequest("showStatus", "dx.status"),
        canvaRequest("searchAssets", "dx.assets.search"),
        canvaRequest("copyReceiptsPath", "receipt.showPath")
      ],
      responses: [
        canvaResponse("showStatus"),
        canvaResponse("searchAssets"),
        canvaResponse("copyReceiptsPath")
      ],
      storesDesignPayloads: false
    }
  }
];
