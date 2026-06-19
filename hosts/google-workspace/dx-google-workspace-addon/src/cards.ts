import { commandPlanForAction } from "./commandPlans.ts";
import { createWorkspaceServiceRequest } from "./localServiceBoundary.ts";
import { DX_GOOGLE_WORKSPACE_ACTIONS, type DxGoogleWorkspaceAction } from "./messages.ts";

export interface WorkspaceCardAction {
  label: string;
  action: DxGoogleWorkspaceAction;
}

export interface WorkspaceCardModel {
  title: string;
  body: string;
  actions: WorkspaceCardAction[];
}

export function showDxCommandCenter(): WorkspaceCardModel {
  return buildDxCommandCenterCard();
}

export function buildDxCommandCenterCard(): WorkspaceCardModel {
  return {
    title: "DX Command Center",
    body: "DX service connection is not configured for this host.",
    actions: [
      { label: "Show Status", action: DX_GOOGLE_WORKSPACE_ACTIONS.showStatus },
      { label: "Search Assets", action: DX_GOOGLE_WORKSPACE_ACTIONS.searchAssets },
      { label: "Show Receipts Path", action: DX_GOOGLE_WORKSPACE_ACTIONS.showReceipts }
    ]
  };
}

export function buildProofGateCard(action: DxGoogleWorkspaceAction): WorkspaceCardModel {
  const plan = commandPlanForAction(action);
  createWorkspaceServiceRequest(plan);

  return {
    title: "DX Command Center",
    body: `${plan.operation}\n\nDX service connection is not configured for this host.`,
    actions: [{ label: "Back", action: DX_GOOGLE_WORKSPACE_ACTIONS.showStatus }]
  };
}
