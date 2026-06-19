export const DX_AFFINITY_CONTENT_ACTIONS = {
  prepareAssets: "dx.affinity-content.prepare_assets",
  prepareFonts: "dx.affinity-content.prepare_fonts",
  showReceipts: "dx.affinity-content.show_receipts"
} as const;

export type DxAffinityContentAction =
  (typeof DX_AFFINITY_CONTENT_ACTIONS)[keyof typeof DX_AFFINITY_CONTENT_ACTIONS];

export interface DxAffinityContentPlan {
  action: DxAffinityContentAction;
  operation:
    | "dx.assets.exportAffinityPack"
    | "dx.fonts.exportAffinityPack"
    | "receipt.showPath";
  transport: "manual-import" | "host-ui";
  requiresRuntimeProof: boolean;
  mutatesAffinityDocument: boolean;
}

export const DX_AFFINITY_CONTENT_PLANS: Record<
  DxAffinityContentAction,
  DxAffinityContentPlan
> = {
  [DX_AFFINITY_CONTENT_ACTIONS.prepareAssets]: {
    action: DX_AFFINITY_CONTENT_ACTIONS.prepareAssets,
    operation: "dx.assets.exportAffinityPack",
    transport: "manual-import",
    requiresRuntimeProof: true,
    mutatesAffinityDocument: false
  },
  [DX_AFFINITY_CONTENT_ACTIONS.prepareFonts]: {
    action: DX_AFFINITY_CONTENT_ACTIONS.prepareFonts,
    operation: "dx.fonts.exportAffinityPack",
    transport: "manual-import",
    requiresRuntimeProof: true,
    mutatesAffinityDocument: false
  },
  [DX_AFFINITY_CONTENT_ACTIONS.showReceipts]: {
    action: DX_AFFINITY_CONTENT_ACTIONS.showReceipts,
    operation: "receipt.showPath",
    transport: "host-ui",
    requiresRuntimeProof: true,
    mutatesAffinityDocument: false
  }
};

export function contentPlanForAction(action: DxAffinityContentAction): DxAffinityContentPlan {
  return DX_AFFINITY_CONTENT_PLANS[action];
}
