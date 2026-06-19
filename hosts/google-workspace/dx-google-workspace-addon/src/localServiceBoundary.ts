import type { DxGoogleWorkspaceCommandPlan } from "./commandPlans.ts";

export interface DxWorkspaceServiceRequest {
  operation: DxGoogleWorkspaceCommandPlan["operation"];
  transport: DxGoogleWorkspaceCommandPlan["transport"];
  metadataOnly: true;
  requiresRuntimeProof: boolean;
  host: "google-workspace";
}

export function createWorkspaceServiceRequest(
  plan: DxGoogleWorkspaceCommandPlan
): DxWorkspaceServiceRequest {
  return {
    operation: plan.operation,
    transport: plan.transport,
    metadataOnly: true,
    requiresRuntimeProof: plan.requiresRuntimeProof,
    host: "google-workspace"
  };
}
