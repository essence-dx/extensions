import {
  DX_GOOGLE_WORKSPACE_ACTIONS,
  type DxGoogleWorkspaceAction
} from "./messages.ts";

export interface DxGoogleWorkspaceCommandPlan {
  action: DxGoogleWorkspaceAction;
  operation: "dx.status" | "dx.assets.search" | "receipt.showPath";
  transport: "cloud-service";
  requiresRuntimeProof: boolean;
  mutatesWorkspaceFile: boolean;
}

export const DX_GOOGLE_WORKSPACE_COMMAND_PLANS: Record<
  DxGoogleWorkspaceAction,
  DxGoogleWorkspaceCommandPlan
> = {
  [DX_GOOGLE_WORKSPACE_ACTIONS.showStatus]: {
    action: DX_GOOGLE_WORKSPACE_ACTIONS.showStatus,
    operation: "dx.status",
    transport: "cloud-service",
    requiresRuntimeProof: true,
    mutatesWorkspaceFile: false
  },
  [DX_GOOGLE_WORKSPACE_ACTIONS.searchAssets]: {
    action: DX_GOOGLE_WORKSPACE_ACTIONS.searchAssets,
    operation: "dx.assets.search",
    transport: "cloud-service",
    requiresRuntimeProof: true,
    mutatesWorkspaceFile: false
  },
  [DX_GOOGLE_WORKSPACE_ACTIONS.showReceipts]: {
    action: DX_GOOGLE_WORKSPACE_ACTIONS.showReceipts,
    operation: "receipt.showPath",
    transport: "cloud-service",
    requiresRuntimeProof: true,
    mutatesWorkspaceFile: false
  }
} as const;

export function commandPlanForAction(action: DxGoogleWorkspaceAction): DxGoogleWorkspaceCommandPlan {
  return DX_GOOGLE_WORKSPACE_COMMAND_PLANS[action];
}
