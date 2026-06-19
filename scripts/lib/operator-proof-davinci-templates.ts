import {
  type OperatorProofTemplateDefinition,
  checklist,
  proofBlockedResults
} from "./operator-proof-template-model.ts";

export const davinciOperatorProofTemplates: OperatorProofTemplateDefinition[] = [
  {
    id: "davinci-resolve-loaded-host",
    adapterId: "dx.davinci-resolve.command-center",
    host: "davinci-resolve",
    receiptWriter: {
      script: "scripts/write-creative-loaded-host-receipts.ts",
      outputReceipt: "loaded-host-latest.json",
      outputReceipts: ["loaded-host-latest.json", "workflow-integration-latest.json"]
    },
    evidenceChecklist: [
      checklist("hostVersion", "Capture the loaded DaVinci Resolve version."),
      checklist("hostExecutablePath", "Record the absolute Resolve executable path."),
      checklist("packageOutputReceiptPath", "Link the current Resolve package-output receipt."),
      checklist("proofFilePath", "Attach a metadata-only manual proof file."),
      checklist("scriptLoadedInResolve", "Verify the DX script loaded inside Resolve."),
      checklist("readOnlyProjectMetadataVerified", "Verify read-only project metadata only when workflow proof is captured."),
      checklist("commandResults", "Record visible or proof-blocked command metadata for every required command.")
    ],
    proof: {
      target: "davinci-resolve",
      hostApplication: "DaVinci Resolve",
      hostVersion: "REPLACE_WITH_DAVINCI_RESOLVE_VERSION",
      hostExecutablePath: "REPLACE_WITH_ABSOLUTE_DAVINCI_RESOLVE_EXECUTABLE_PATH",
      packageOutputReceiptPath: "REPLACE_WITH_ABSOLUTE_PACKAGE_OUTPUT_RECEIPT_PATH",
      proofFilePath: "REPLACE_WITH_ABSOLUTE_MANUAL_PROOF_FILE_PATH",
      verificationMode: "resolve-scripting",
      loadedHostVerified: false,
      commandIdsVisible: [
        "dx.davinci-resolve.inspect_project",
        "dx.davinci-resolve.show_receipts",
        "dx.davinci-resolve.show_status"
      ],
      commandResults: proofBlockedResults([
        "dx.davinci-resolve.show_status",
        "dx.davinci-resolve.inspect_project",
        "dx.davinci-resolve.show_receipts"
      ]),
      localServiceRequestsBlocked: false,
      hostState: "unavailable",
      loadedResolveVerified: false,
      scriptLanguage: "python",
      scriptLoadedInResolve: false,
      mutatesResolveProject: false,
      readOnlyProjectMetadataVerified: false,
      workflowIntegrationVerified: false
    }
  },
  {
    id: "davinci-resolve-developer-docs",
    adapterId: "dx.davinci-resolve.command-center",
    host: "davinci-resolve",
    receiptWriter: {
      script: "scripts/write-davinci-resolve-developer-docs-receipt.ts",
      outputReceipt: "developer-docs-latest.json"
    },
    evidenceChecklist: [
      checklist("packageOutputReceiptPath", "Link the current Resolve package-output receipt."),
      checklist("proofFilePath", "Attach a metadata-only manual proof file."),
      checklist("docsRoot", "Record the absolute documentation root."),
      checklist("docsFiles", "List non-empty documentation files under the documentation root."),
      checklist("docsSource", "State whether docs came from installed documentation or an export."),
      checklist("resolveVersion", "Capture the Resolve version matched to the documentation."),
      checklist("developerDocsVersion", "Capture the developer documentation version label.")
    ],
    proof: {
      packageOutputReceiptPath: "REPLACE_WITH_ABSOLUTE_PACKAGE_OUTPUT_RECEIPT_PATH",
      proofFilePath: "REPLACE_WITH_ABSOLUTE_MANUAL_PROOF_FILE_PATH",
      docsRoot: "REPLACE_WITH_ABSOLUTE_DEVELOPER_DOCUMENTATION_ROOT",
      docsFiles: ["REPLACE_WITH_ABSOLUTE_DEVELOPER_DOCUMENTATION_FILE"],
      docsSource: "installed-developer-documentation",
      resolveVersion: "REPLACE_WITH_DAVINCI_RESOLVE_VERSION",
      developerDocsVersion: "REPLACE_WITH_DEVELOPER_DOCUMENTATION_VERSION"
    }
  }
];
