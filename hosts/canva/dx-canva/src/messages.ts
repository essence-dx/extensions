export const DX_CANVA_MESSAGES = {
  showStatus: "dx.canva.show_status",
  searchAssets: "dx.canva.search_assets",
  copyReceiptsPath: "dx.canva.copy_receipts_path"
} as const;

export type DxCanvaMessageType =
  typeof DX_CANVA_MESSAGES[keyof typeof DX_CANVA_MESSAGES];

export interface DxCanvaMessage {
  type: DxCanvaMessageType;
  query?: string;
}

export interface DxCanvaHostMessage {
  type: "dx.canva.notice" | "dx.canva.receipts_path";
  message: string;
}

export function isDxCanvaMessageType(type: string): type is DxCanvaMessageType {
  return Object.values(DX_CANVA_MESSAGES).includes(type as DxCanvaMessageType);
}
