export const DX_GOOGLE_WORKSPACE_ACTIONS = {
  showStatus: "dx.google-workspace.show_status",
  searchAssets: "dx.google-workspace.search_assets",
  showReceipts: "dx.google-workspace.show_receipts"
} as const;

export type DxGoogleWorkspaceAction =
  (typeof DX_GOOGLE_WORKSPACE_ACTIONS)[keyof typeof DX_GOOGLE_WORKSPACE_ACTIONS];
