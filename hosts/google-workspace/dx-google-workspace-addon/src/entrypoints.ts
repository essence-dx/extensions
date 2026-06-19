import { buildProofGateCard, showDxCommandCenter } from "./cards.ts";
import { commandPlanForAction } from "./commandPlans.ts";
import {
  DX_GOOGLE_WORKSPACE_ACTIONS,
  type DxGoogleWorkspaceAction
} from "./messages.ts";

export { showDxCommandCenter };

export interface DxWorkspaceActionEvent {
  parameters?: {
    action?: string;
  };
}

export function handleDxWorkspaceAction(event: DxWorkspaceActionEvent) {
  const action = normalizeAction(event.parameters?.action);
  commandPlanForAction(action);
  return buildProofGateCard(action);
}

function normalizeAction(action: string | undefined): DxGoogleWorkspaceAction {
  const actions = Object.values(DX_GOOGLE_WORKSPACE_ACTIONS);
  if (actions.includes(action as DxGoogleWorkspaceAction)) {
    return action as DxGoogleWorkspaceAction;
  }

  return DX_GOOGLE_WORKSPACE_ACTIONS.showStatus;
}
