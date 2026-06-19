export const DX_FIGMA_MESSAGES = {
  showStatus: "dx.figma.show_status",
  searchAssets: "dx.figma.search_assets",
  copyReceiptsPath: "dx.figma.copy_receipts_path"
} as const;

export const DX_FIGMA_MENU_COMMANDS = {
  showStatus: "show-status",
  searchAssets: "search-assets",
  copyReceiptsPath: "copy-receipts-path"
} as const;

export type DxFigmaMessageType =
  typeof DX_FIGMA_MESSAGES[keyof typeof DX_FIGMA_MESSAGES];

export type DxFigmaMenuCommand =
  typeof DX_FIGMA_MENU_COMMANDS[keyof typeof DX_FIGMA_MENU_COMMANDS];

export interface DxFigmaMessage {
  type: DxFigmaMessageType;
  query?: string;
}

export interface DxFigmaHostMessage {
  type: "dx.figma.notice" | "dx.figma.receipts_path";
  message: string;
}

export function isDxFigmaUiMessage(value: unknown): value is DxFigmaMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const message = value as Record<string, unknown>;
  if (!isDxFigmaMessageType(message.type)) {
    return false;
  }

  if (message.query !== undefined && typeof message.query !== "string") {
    return false;
  }

  return Object.keys(message).every((key) => key === "type" || key === "query");
}

export function messageTypeForMenuCommand(command: string): DxFigmaMessageType | undefined {
  if (command === DX_FIGMA_MENU_COMMANDS.showStatus) {
    return DX_FIGMA_MESSAGES.showStatus;
  }

  if (command === DX_FIGMA_MENU_COMMANDS.searchAssets) {
    return DX_FIGMA_MESSAGES.searchAssets;
  }

  if (command === DX_FIGMA_MENU_COMMANDS.copyReceiptsPath) {
    return DX_FIGMA_MESSAGES.copyReceiptsPath;
  }

  return undefined;
}

function isDxFigmaMessageType(value: unknown): value is DxFigmaMessageType {
  return (
    typeof value === "string" &&
    Object.values(DX_FIGMA_MESSAGES).includes(value as DxFigmaMessageType)
  );
}
