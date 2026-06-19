export const DX_POWERPOINT_MESSAGES = {
  showStatus: "dx.powerpoint.show_status",
  searchMedia: "dx.powerpoint.search_media",
  copyReceiptsPath: "dx.powerpoint.copy_receipts_path"
} as const;

export type DxPowerPointMessageType =
  typeof DX_POWERPOINT_MESSAGES[keyof typeof DX_POWERPOINT_MESSAGES];

export interface DxPowerPointMessage {
  type: DxPowerPointMessageType;
  query?: string;
}

export function isDxPowerPointMessageType(type: string): type is DxPowerPointMessageType {
  return Object.values(DX_POWERPOINT_MESSAGES).includes(type as DxPowerPointMessageType);
}
