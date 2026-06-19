import { DX_POWERPOINT_MESSAGES, type DxPowerPointMessageType } from "./messages";

export interface DxPowerPointCommandPlan {
  messageType: DxPowerPointMessageType;
  operation: "dx.status" | "dx.media.search" | "receipt.copyPath";
  transport: "local-service" | "host-ui";
  requiresRuntimeProof: boolean;
}

export const DX_POWERPOINT_COMMAND_PLANS: Record<string, DxPowerPointCommandPlan> = {
  showStatus: {
    messageType: DX_POWERPOINT_MESSAGES.showStatus,
    operation: "dx.status",
    transport: "local-service",
    requiresRuntimeProof: true
  },
  searchMedia: {
    messageType: DX_POWERPOINT_MESSAGES.searchMedia,
    operation: "dx.media.search",
    transport: "local-service",
    requiresRuntimeProof: true
  },
  copyReceiptsPath: {
    messageType: DX_POWERPOINT_MESSAGES.copyReceiptsPath,
    operation: "receipt.copyPath",
    transport: "host-ui",
    requiresRuntimeProof: false
  }
} as const;
