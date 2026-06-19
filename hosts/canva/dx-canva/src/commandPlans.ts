import { DX_CANVA_MESSAGES, type DxCanvaMessageType } from "./messages";

export interface DxCanvaCommandPlan {
  messageType: DxCanvaMessageType;
  operation: "dx.status" | "dx.assets.search" | "receipt.copyPath";
  transport: "local-service" | "host-ui";
  requiresRuntimeProof: boolean;
  mutatesCanvaDesign: boolean;
}

export const DX_CANVA_COMMAND_PLANS: Record<string, DxCanvaCommandPlan> = {
  showStatus: {
    messageType: DX_CANVA_MESSAGES.showStatus,
    operation: "dx.status",
    transport: "local-service",
    requiresRuntimeProof: true,
    mutatesCanvaDesign: false
  },
  searchAssets: {
    messageType: DX_CANVA_MESSAGES.searchAssets,
    operation: "dx.assets.search",
    transport: "local-service",
    requiresRuntimeProof: true,
    mutatesCanvaDesign: false
  },
  copyReceiptsPath: {
    messageType: DX_CANVA_MESSAGES.copyReceiptsPath,
    operation: "receipt.copyPath",
    transport: "host-ui",
    requiresRuntimeProof: false,
    mutatesCanvaDesign: false
  }
} as const;

export function planForCanvaMessage(type: DxCanvaMessageType): DxCanvaCommandPlan | undefined {
  return Object.values(DX_CANVA_COMMAND_PLANS).find((plan) => plan.messageType === type);
}
