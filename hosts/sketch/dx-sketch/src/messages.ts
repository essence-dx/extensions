export const DX_SKETCH_MESSAGES = {
  showStatus: "dx.sketch.show_status",
  searchAssets: "dx.sketch.search_assets",
  showReceipts: "dx.sketch.show_receipts"
} as const;

export const DX_SKETCH_MENU_COMMANDS = {
  showStatus: "show-status",
  searchAssets: "search-assets",
  showReceipts: "show-receipts"
} as const;

type SketchMenuCommand = (typeof DX_SKETCH_MENU_COMMANDS)[keyof typeof DX_SKETCH_MENU_COMMANDS];
export type DxSketchMessage = (typeof DX_SKETCH_MESSAGES)[keyof typeof DX_SKETCH_MESSAGES];

const menuCommandMessages: Record<SketchMenuCommand, DxSketchMessage> = {
  [DX_SKETCH_MENU_COMMANDS.showStatus]: DX_SKETCH_MESSAGES.showStatus,
  [DX_SKETCH_MENU_COMMANDS.searchAssets]: DX_SKETCH_MESSAGES.searchAssets,
  [DX_SKETCH_MENU_COMMANDS.showReceipts]: DX_SKETCH_MESSAGES.showReceipts
};

export function messageTypeForMenuCommand(command: string | undefined): DxSketchMessage | undefined {
  if (!command) {
    return undefined;
  }

  return menuCommandMessages[command as SketchMenuCommand];
}
