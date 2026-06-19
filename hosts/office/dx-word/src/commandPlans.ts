import { DX_WORD_MESSAGES, type DxWordMessageType } from "./messages";

export interface DxWordCommandPlan {
  messageType: DxWordMessageType;
  operation: "dx.status" | "dx.assets.search" | "receipt.copyPath";
  transport: "local-service" | "host-ui";
  requiresRuntimeProof: boolean;
}

export const DX_WORD_COMMAND_PLANS: Record<string, DxWordCommandPlan> = {
  showStatus: {
    messageType: DX_WORD_MESSAGES.showStatus,
    operation: "dx.status",
    transport: "local-service",
    requiresRuntimeProof: true
  },
  searchAssets: {
    messageType: DX_WORD_MESSAGES.searchAssets,
    operation: "dx.assets.search",
    transport: "local-service",
    requiresRuntimeProof: true
  },
  copyReceiptsPath: {
    messageType: DX_WORD_MESSAGES.copyReceiptsPath,
    operation: "receipt.copyPath",
    transport: "host-ui",
    requiresRuntimeProof: false
  }
} as const;
