import type { DxSketchMessage } from "./messages.ts";
import { DX_SKETCH_MESSAGES } from "./messages.ts";

export const DX_SKETCH_COMMAND_PLANS = {
  [DX_SKETCH_MESSAGES.showStatus]: {
    operation: "dx.status",
    transport: "local-service",
    requiresRuntimeProof: true,
    mutatesSketchDocument: false
  },
  [DX_SKETCH_MESSAGES.searchAssets]: {
    operation: "dx.assets.search",
    transport: "local-service",
    requiresRuntimeProof: true,
    mutatesSketchDocument: false
  },
  [DX_SKETCH_MESSAGES.showReceipts]: {
    operation: "receipt.showPath",
    transport: "host-ui",
    requiresRuntimeProof: true,
    mutatesSketchDocument: false
  }
} as const;

export type DxSketchCommandPlan =
  (typeof DX_SKETCH_COMMAND_PLANS)[keyof typeof DX_SKETCH_COMMAND_PLANS];

export function commandPlanForMessage(message: DxSketchMessage): DxSketchCommandPlan {
  return DX_SKETCH_COMMAND_PLANS[message];
}
