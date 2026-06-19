export const DX_WORD_MESSAGES = {
  showStatus: "dx.word.show_status",
  searchAssets: "dx.word.search_assets",
  copyReceiptsPath: "dx.word.copy_receipts_path"
} as const;

export type DxWordMessageType =
  typeof DX_WORD_MESSAGES[keyof typeof DX_WORD_MESSAGES];

export interface DxWordMessage {
  type: DxWordMessageType;
  query?: string;
}

export function isDxWordMessageType(type: string): type is DxWordMessageType {
  return Object.values(DX_WORD_MESSAGES).includes(type as DxWordMessageType);
}
