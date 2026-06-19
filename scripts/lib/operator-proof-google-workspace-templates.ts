import {
  type OperatorProofTemplateDefinition,
  checklist
} from "./operator-proof-template-model.ts";

const googleWorkspaceCommandOperations = new Map([
  ["dx.google-workspace.show_status", "dx.status"],
  ["dx.google-workspace.search_assets", "dx.assets.search"],
  ["dx.google-workspace.show_receipts", "receipt.showPath"]
]);

export const googleWorkspaceOperatorProofTemplates: OperatorProofTemplateDefinition[] = [
  {
    id: "google-workspace-deployment",
    adapterId: "dx.google-workspace.command-center",
    host: "google-workspace",
    receiptWriter: {
      script: "scripts/write-google-workspace-deployment-receipts.ts",
      outputReceipt: "workspace-file-smoke-latest.json",
      outputReceipts: [
        "apps-script-deployment-latest.json",
        "cloud-service-latest.json",
        "workspace-file-smoke-latest.json"
      ]
    },
    evidenceChecklist: [
      checklist("packageOutputReceiptPath", "Link the current Google Workspace package-output receipt."),
      checklist("proofFilePath", "Attach a metadata-only manual proof file."),
      checklist("deploymentIdSha256", "Record only the SHA-256 hash of the Apps Script deployment id."),
      checklist("appsScriptProjectIdSha256", "Record only the SHA-256 hash of the Apps Script project id."),
      checklist("serviceEndpointHost", "Record only the cloud-service host name."),
      checklist("responses", "Replace proof-blocked responses with successful metadata-only card evidence."),
      checklist("workspaceFileType", "Record the test Workspace file type used for smoke proof.")
    ],
    proof: {
      packageOutputReceiptPath: "REPLACE_WITH_ABSOLUTE_PACKAGE_OUTPUT_RECEIPT_PATH",
      proofFilePath: "REPLACE_WITH_ABSOLUTE_MANUAL_PROOF_FILE_PATH",
      appsScriptDeploymentVerified: false,
      deploymentMode: "test-deployment",
      deploymentIdSha256: "REPLACE_WITH_DEPLOYMENT_ID_SHA256",
      appsScriptProjectIdSha256: "REPLACE_WITH_APPS_SCRIPT_PROJECT_ID_SHA256",
      deploymentVersion: "REPLACE_WITH_DEPLOYMENT_VERSION",
      oauthScopes: [],
      cloudServiceVerified: false,
      serviceEndpointHost: "REPLACE_WITH_SERVICE_HOST_NAME",
      serviceTransport: "https",
      requests: [...googleWorkspaceCommandOperations.entries()].map(([commandId, operation]) =>
        googleWorkspaceRequest(commandId, operation)
      ),
      responses: [...googleWorkspaceCommandOperations.keys()].map(googleWorkspaceResponse),
      workspaceFileSmokeVerified: false,
      workspaceFileType: "docs",
      workspaceFileState: "unavailable",
      cardsRendered: false,
      commandIdsVisible: [...googleWorkspaceCommandOperations.keys()].sort(),
      mutatesWorkspaceFile: false,
      storesWorkspacePayloads: false
    }
  }
];

function googleWorkspaceRequest(commandId: string, operation: string): Record<string, unknown> {
  return {
    commandId,
    operation,
    metadataOnly: true,
    transport: "cloud-service"
  };
}

function googleWorkspaceResponse(commandId: string): Record<string, unknown> {
  return {
    commandId,
    status: "proof-blocked",
    payloadKind: "metadata-only-card"
  };
}
