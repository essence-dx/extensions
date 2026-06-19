import {
  type OperatorProofHost,
  type OperatorProofTemplateDefinition,
  checklist,
  proofBlockedResults
} from "./operator-proof-template-model.ts";

interface OfficeTemplateHost {
  adapterId: string;
  application: "Excel" | "PowerPoint" | "Word";
  host: Extract<OperatorProofHost, "excel" | "powerpoint" | "word">;
  searchCommand: string;
  searchOperation: "dx.assets.search" | "dx.media.search";
  sideloadCommands: string[];
  taskpanePlaceholder: string;
}

const officeHosts: OfficeTemplateHost[] = [
  {
    adapterId: "dx.excel.command-center",
    application: "Excel",
    host: "excel",
    searchCommand: "dx.excel.search_assets",
    searchOperation: "dx.assets.search",
    sideloadCommands: ["dx.excel.show_status", "dx.excel.search_assets", "dx.excel.copy_receipts_path"],
    taskpanePlaceholder: "REPLACE_WITH_HTTPS_EXCEL_TASKPANE_URL"
  },
  {
    adapterId: "dx.powerpoint.command-center",
    application: "PowerPoint",
    host: "powerpoint",
    searchCommand: "dx.powerpoint.search_media",
    searchOperation: "dx.media.search",
    sideloadCommands: [
      "dx.powerpoint.show_status",
      "dx.powerpoint.search_media",
      "dx.powerpoint.copy_receipts_path"
    ],
    taskpanePlaceholder: "REPLACE_WITH_HTTPS_POWERPOINT_TASKPANE_URL"
  },
  {
    adapterId: "dx.word.command-center",
    application: "Word",
    host: "word",
    searchCommand: "dx.word.search_assets",
    searchOperation: "dx.assets.search",
    sideloadCommands: ["dx.word.show_status", "dx.word.search_assets", "dx.word.copy_receipts_path"],
    taskpanePlaceholder: "REPLACE_WITH_HTTPS_WORD_TASKPANE_URL"
  }
];

export const officeOperatorProofTemplates: OperatorProofTemplateDefinition[] = [
  ...officeHosts.map(createOfficeSideloadedTemplate),
  ...officeHosts.map(createOfficeLocalServiceTemplate)
];

function createOfficeSideloadedTemplate(host: OfficeTemplateHost): OperatorProofTemplateDefinition {
  return {
    id: `office-${host.host}-sideloaded-host`,
    adapterId: host.adapterId,
    host: host.host,
    receiptWriter: {
      script: "scripts/write-office-sideloaded-host-receipts.ts",
      outputReceipt: "sideloaded-host-latest.json"
    },
    evidenceChecklist: [
      checklist("officeVersion", `Capture the loaded ${host.application} version.`),
      checklist("packageOutputReceiptPath", `Link the current ${host.application} package-output receipt.`),
      checklist("sideloadManifestPath", `Record the absolute ${host.application} sideload manifest path.`),
      checklist("taskpaneUrl", `Record the HTTPS ${host.application} taskpane URL.`),
      checklist("proofFilePath", "Attach a metadata-only manual proof file."),
      checklist("taskpaneLoaded", `Verify the ${host.application} task pane loaded.`),
      checklist("commandResults", "Record clicked, visible, or proof-blocked command metadata.")
    ],
    proof: {
      host: host.host,
      officeApplication: host.application,
      officeVersion: "REPLACE_WITH_OFFICE_VERSION",
      packageOutputReceiptPath: "REPLACE_WITH_ABSOLUTE_PACKAGE_OUTPUT_RECEIPT_PATH",
      sideloadManifestPath: "REPLACE_WITH_ABSOLUTE_SIDELOAD_MANIFEST_PATH",
      taskpaneUrl: host.taskpanePlaceholder,
      proofFilePath: "REPLACE_WITH_ABSOLUTE_MANUAL_PROOF_FILE_PATH",
      taskpaneLoaded: false,
      commandIdsVisible: [...host.sideloadCommands].sort(),
      commandResults: proofBlockedResults(host.sideloadCommands),
      localServiceRequestsBlocked: false,
      documentState: "unavailable"
    }
  };
}

function createOfficeLocalServiceTemplate(host: OfficeTemplateHost): OperatorProofTemplateDefinition {
  const statusCommand = `dx.${host.host}.show_status`;

  return {
    id: `office-${host.host}-local-service`,
    adapterId: host.adapterId,
    host: host.host,
    receiptWriter: {
      script: "scripts/write-office-local-service-receipts.ts",
      outputReceipt: "local-service-latest.json"
    },
    evidenceChecklist: [
      checklist("officeVersion", `Capture the loaded ${host.application} version.`),
      checklist("sideloadedHostReceiptPath", `Link the verified ${host.application} sideloaded-host receipt.`),
      checklist("proofFilePath", "Attach a metadata-only manual proof file."),
      checklist("localServiceConnected", "Verify the loopback DX local-service connection."),
      checklist("requests", "Record metadata-only request evidence for every local-service command."),
      checklist("responses", "Record metadata-only response evidence for every local-service command.")
    ],
    proof: {
      host: host.host,
      officeApplication: host.application,
      officeVersion: "REPLACE_WITH_OFFICE_VERSION",
      sideloadedHostReceiptPath: "REPLACE_WITH_ABSOLUTE_SIDELOADED_HOST_RECEIPT_PATH",
      proofFilePath: "REPLACE_WITH_ABSOLUTE_MANUAL_PROOF_FILE_PATH",
      localServiceTransport: "loopback",
      localServiceConnected: false,
      requests: [
        officeLocalServiceRequest(host.host, statusCommand, "dx.status"),
        officeLocalServiceRequest(host.host, host.searchCommand, host.searchOperation, "REPLACE_WITH_METADATA_QUERY")
      ],
      responses: [
        officeLocalServiceResponse(statusCommand),
        officeLocalServiceResponse(host.searchCommand)
      ],
      documentState: "unavailable"
    }
  };
}

function officeLocalServiceRequest(
  host: OfficeTemplateHost["host"],
  command: string,
  operation: "dx.status" | "dx.assets.search" | "dx.media.search",
  query?: string
): Record<string, unknown> {
  const request: Record<string, unknown> = {
    protocol: "dx.office.local-service",
    schemaVersion: 1,
    host,
    command,
    operation,
    context: {
      hostDocumentState: "unavailable"
    }
  };

  if (query) {
    request.query = query;
  }

  return request;
}

function officeLocalServiceResponse(command: string): Record<string, unknown> {
  return {
    command,
    status: "ok",
    payloadKind: "metadata-only"
  };
}
