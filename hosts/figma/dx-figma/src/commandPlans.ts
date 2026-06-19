import { DX_FIGMA_MESSAGES, type DxFigmaMessageType } from "./messages";

export interface DxFigmaCommandPlan {
  messageType: DxFigmaMessageType;
  operation: "dx.status" | "dx.assets.search" | "receipt.copyPath";
  transport: "local-service" | "host-ui";
  requiresRuntimeProof: boolean;
}

export const DX_FIGMA_COMMAND_PLANS: Record<string, DxFigmaCommandPlan> = {
  showStatus: {
    messageType: DX_FIGMA_MESSAGES.showStatus,
    operation: "dx.status",
    transport: "local-service",
    requiresRuntimeProof: true
  },
  searchAssets: {
    messageType: DX_FIGMA_MESSAGES.searchAssets,
    operation: "dx.assets.search",
    transport: "local-service",
    requiresRuntimeProof: true
  },
  copyReceiptsPath: {
    messageType: DX_FIGMA_MESSAGES.copyReceiptsPath,
    operation: "receipt.copyPath",
    transport: "host-ui",
    requiresRuntimeProof: false
  }
} as const;

export function isKnownDxFigmaMessage(type: string): type is DxFigmaMessageType {
  return Object.values(DX_FIGMA_MESSAGES).includes(type as DxFigmaMessageType);
}
