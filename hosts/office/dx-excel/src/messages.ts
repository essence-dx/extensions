export const DX_EXCEL_MESSAGES = {
  showStatus: "dx.excel.show_status",
  searchAssets: "dx.excel.search_assets",
  copyReceiptsPath: "dx.excel.copy_receipts_path"
} as const;

export type DxExcelMessageType =
  typeof DX_EXCEL_MESSAGES[keyof typeof DX_EXCEL_MESSAGES];

export interface DxExcelMessage {
  type: DxExcelMessageType;
  query?: string;
}

export function isDxExcelMessageType(type: string): type is DxExcelMessageType {
  return Object.values(DX_EXCEL_MESSAGES).includes(type as DxExcelMessageType);
}
