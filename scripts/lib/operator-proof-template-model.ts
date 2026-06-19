export type OperatorProofTemplateId =
  | "browser-chrome-loaded-profile"
  | "browser-edge-loaded-profile"
  | "browser-firefox-loaded-profile"
  | "vscode-loaded-host"
  | "zed-dev-extension"
  | "blender"
  | "obsidian"
  | "figma"
  | "canva-development-app"
  | "canva-cloud-service"
  | "sketch"
  | "adobe-photoshop-loaded-host"
  | "adobe-photoshop-plugin-id"
  | "adobe-photoshop-ccx-package"
  | "adobe-premiere-pro-loaded-host"
  | "adobe-premiere-pro-plugin-id"
  | "adobe-premiere-pro-ccx-package"
  | "adobe-premiere-pro-native-plugin"
  | "adobe-indesign-loaded-host"
  | "adobe-indesign-plugin-id"
  | "adobe-indesign-ccx-package"
  | "adobe-indesign-native-plugin"
  | "office-excel-sideloaded-host"
  | "office-powerpoint-sideloaded-host"
  | "office-word-sideloaded-host"
  | "office-excel-local-service"
  | "office-powerpoint-local-service"
  | "office-word-local-service"
  | "google-workspace-deployment"
  | "intellij-platform-sandbox-ide"
  | "intellij-platform-plugin-verifier"
  | "visual-studio-experimental-instance"
  | "unity-editor-loaded-host"
  | "unity-editor-project-import"
  | "unreal-engine-loaded-host"
  | "unreal-engine-project-enablement"
  | "affinity-manual-import"
  | "affinity-loaded-app"
  | "affinity-photoshop-filter-plugin"
  | "davinci-resolve-loaded-host"
  | "davinci-resolve-developer-docs";

export type OperatorProofHost =
  | "affinity"
  | "blender"
  | "browser"
  | "canva"
  | "davinci-resolve"
  | "figma"
  | "indesign"
  | "excel"
  | "google-workspace"
  | "intellij-platform"
  | "obsidian"
  | "photoshop"
  | "powerpoint"
  | "premiere-pro"
  | "sketch"
  | "unity-editor"
  | "unreal-engine"
  | "vscode"
  | "visual-studio"
  | "word"
  | "zed";

export interface OperatorProofTemplate {
  template: "dx.extension.operator_proof_template";
  id: OperatorProofTemplateId;
  adapterId: string;
  host: OperatorProofHost;
  generatedAt: string;
  receiptWriter: OperatorProofReceiptWriter;
  status: {
    validReceiptInput: false;
    operatorActionRequired: true;
  };
  evidenceChecklist: OperatorProofChecklistItem[];
  proof: Record<string, unknown>;
}

export interface OperatorProofTemplateSummary {
  id: OperatorProofTemplateId;
  adapterId: string;
  host: OperatorProofHost;
  receiptWriter: OperatorProofReceiptWriter;
}

export interface OperatorProofReceiptWriter {
  script: string;
  outputReceipt: string;
  outputReceipts?: string[];
}

export interface OperatorProofChecklistItem {
  field: string;
  capture: string;
}

export interface CreateOperatorProofTemplateOptions {
  generatedAt?: Date | string;
}

export interface WriteOperatorProofTemplateFileOptions extends CreateOperatorProofTemplateOptions {
  id: OperatorProofTemplateId;
  outputPath: string;
}

export interface WriteOperatorProofTemplateFileResult {
  outputPath: string;
  template: OperatorProofTemplate;
}

export interface OperatorProofTemplateDefinition {
  id: OperatorProofTemplateId;
  adapterId: string;
  host: OperatorProofHost;
  receiptWriter: OperatorProofReceiptWriter;
  evidenceChecklist: OperatorProofChecklistItem[];
  proof: Record<string, unknown>;
}

export function proofBlockedResults(commandIds: string[]): { commandId: string; status: "proof-blocked" }[] {
  return commandIds.map((commandId) => ({
    commandId,
    status: "proof-blocked"
  }));
}

export function canvaRequest(commandId: string, operation: string): Record<string, unknown> {
  return {
    commandId,
    operation,
    metadataOnly: true,
    transport: "cloud-service"
  };
}

export function canvaResponse(commandId: string): Record<string, unknown> {
  return {
    commandId,
    status: "proof-blocked",
    payloadKind: "metadata-only-card"
  };
}

export function checklist(field: string, capture: string): OperatorProofChecklistItem {
  return {
    field,
    capture
  };
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function normalizeGeneratedAt(value: Date | string | undefined): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value ?? new Date().toISOString();
}
