import { DX_EXCEL_MESSAGES, type DxExcelMessageType } from "./messages";

export interface DxExcelCommandPlan {
  messageType: DxExcelMessageType;
  operation: "dx.status" | "dx.assets.search" | "receipt.copyPath";
  transport: "local-service" | "host-ui";
  requiresRuntimeProof: boolean;
}

export const DX_EXCEL_COMMAND_PLANS: Record<string, DxExcelCommandPlan> = {
  showStatus: {
    messageType: DX_EXCEL_MESSAGES.showStatus,
    operation: "dx.status",
    transport: "local-service",
    requiresRuntimeProof: true
  },
  searchAssets: {
    messageType: DX_EXCEL_MESSAGES.searchAssets,
    operation: "dx.assets.search",
    transport: "local-service",
    requiresRuntimeProof: true
  },
  copyReceiptsPath: {
    messageType: DX_EXCEL_MESSAGES.copyReceiptsPath,
    operation: "receipt.copyPath",
    transport: "host-ui",
    requiresRuntimeProof: false
  }
} as const;
