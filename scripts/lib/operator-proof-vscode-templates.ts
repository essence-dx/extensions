import {
  type OperatorProofTemplateDefinition,
  checklist
} from "./operator-proof-template-model.ts";

const vscodeCommandIds = [
  "dx.openCommandCenter",
  "dx.copyReceiptsPath",
  "dx.doctor",
  "dx.listForgePackages",
  "dx.openReceipts",
  "dx.searchIcons",
  "dx.showBuildGraph",
  "dx.showCheckEditorState",
  "dx.showLatestCheckReceipt",
  "dx.showStatus"
];

export const vscodeOperatorProofTemplates: OperatorProofTemplateDefinition[] = [
  {
    id: "vscode-loaded-host",
    adapterId: "dx.vscode.command-center",
    host: "vscode",
    receiptWriter: {
      script: "scripts/write-vscode-loaded-host-proof-receipts.ts",
      outputReceipt: "vscode-loaded-host-latest.json"
    },
    evidenceChecklist: [
      checklist("vscodeExecutablePath", "Record the absolute VS Code executable path used for the Extension Development Host."),
      checklist("vscodeVersion", "Capture the loaded VS Code version."),
      checklist("packageOutputReceiptPath", "Link the current VS Code package-output receipt."),
      checklist("workspacePath", "Record the absolute temporary workspace path used for the proof."),
      checklist("proofFilePath", "Attach a metadata-only manual proof file."),
      checklist("extensionDevelopmentHostVerified", "Verify the extension loaded in a VS Code Extension Development Host."),
      checklist("commandIds", "Capture the contributed DX command ids visible in the loaded host."),
      checklist("storesProcessOutput", "Confirm the proof does not store command or process output.")
    ],
    proof: {
      vscodeExecutablePath: "REPLACE_WITH_ABSOLUTE_VSCODE_EXECUTABLE_PATH",
      vscodeVersion: "REPLACE_WITH_VSCODE_VERSION",
      extensionId: "dx-runtime.dx-vscode",
      packageOutputReceiptPath: "REPLACE_WITH_ABSOLUTE_VSCODE_PACKAGE_OUTPUT_RECEIPT_PATH",
      workspacePath: "REPLACE_WITH_ABSOLUTE_TEMPORARY_WORKSPACE_PATH",
      proofFilePath: "REPLACE_WITH_ABSOLUTE_MANUAL_PROOF_FILE_PATH",
      extensionDevelopmentHostVerified: false,
      commandIds: vscodeCommandIds,
      storesProcessOutput: false
    }
  }
];
