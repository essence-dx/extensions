import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { adobeOperatorProofTemplates } from "./operator-proof-adobe-templates.ts";
import { affinityOperatorProofTemplates } from "./operator-proof-affinity-templates.ts";
import { applicationOperatorProofTemplates } from "./operator-proof-application-templates.ts";
import { browserOperatorProofTemplates } from "./operator-proof-browser-templates.ts";
import { davinciOperatorProofTemplates } from "./operator-proof-davinci-templates.ts";
import { designOperatorProofTemplates } from "./operator-proof-design-templates.ts";
import { ideGameEngineOperatorProofTemplates } from "./operator-proof-ide-game-engine-templates.ts";
import { productivityOperatorProofTemplates } from "./operator-proof-productivity-templates.ts";
import { vscodeOperatorProofTemplates } from "./operator-proof-vscode-templates.ts";
import {
  type CreateOperatorProofTemplateOptions,
  type OperatorProofTemplate,
  type OperatorProofTemplateDefinition,
  type OperatorProofTemplateId,
  type OperatorProofTemplateSummary,
  type WriteOperatorProofTemplateFileOptions,
  type WriteOperatorProofTemplateFileResult,
  cloneJson,
  normalizeGeneratedAt
} from "./operator-proof-template-model.ts";

export type {
  CreateOperatorProofTemplateOptions,
  OperatorProofChecklistItem,
  OperatorProofHost,
  OperatorProofReceiptWriter,
  OperatorProofTemplate,
  OperatorProofTemplateDefinition,
  OperatorProofTemplateId,
  OperatorProofTemplateSummary,
  WriteOperatorProofTemplateFileOptions,
  WriteOperatorProofTemplateFileResult
} from "./operator-proof-template-model.ts";

const templateDefinitions = [
  ...browserOperatorProofTemplates,
  ...vscodeOperatorProofTemplates,
  ...applicationOperatorProofTemplates,
  ...designOperatorProofTemplates,
  ...adobeOperatorProofTemplates,
  ...productivityOperatorProofTemplates,
  ...ideGameEngineOperatorProofTemplates,
  ...affinityOperatorProofTemplates,
  ...davinciOperatorProofTemplates
];
const templateOrder: OperatorProofTemplateId[] = [
  "browser-chrome-loaded-profile",
  "browser-edge-loaded-profile",
  "browser-firefox-loaded-profile",
  "vscode-loaded-host",
  "zed-dev-extension",
  "blender",
  "obsidian",
  "figma",
  "canva-development-app",
  "canva-cloud-service",
  "sketch",
  "adobe-photoshop-loaded-host",
  "adobe-photoshop-plugin-id",
  "adobe-photoshop-ccx-package",
  "adobe-premiere-pro-loaded-host",
  "adobe-premiere-pro-plugin-id",
  "adobe-premiere-pro-ccx-package",
  "adobe-premiere-pro-native-plugin",
  "adobe-indesign-loaded-host",
  "adobe-indesign-plugin-id",
  "adobe-indesign-ccx-package",
  "adobe-indesign-native-plugin",
  "office-excel-sideloaded-host",
  "office-powerpoint-sideloaded-host",
  "office-word-sideloaded-host",
  "office-excel-local-service",
  "office-powerpoint-local-service",
  "office-word-local-service",
  "google-workspace-deployment",
  "intellij-platform-sandbox-ide",
  "intellij-platform-plugin-verifier",
  "visual-studio-experimental-instance",
  "unity-editor-loaded-host",
  "unity-editor-project-import",
  "unreal-engine-loaded-host",
  "unreal-engine-project-enablement",
  "affinity-manual-import",
  "affinity-loaded-app",
  "affinity-photoshop-filter-plugin",
  "davinci-resolve-loaded-host",
  "davinci-resolve-developer-docs"
];
const orderedTemplateDefinitions = templateOrder.map(resolveTemplateDefinition);

export function listOperatorProofTemplates(): OperatorProofTemplateSummary[] {
  return orderedTemplateDefinitions.map((definition) => ({
    id: definition.id,
    adapterId: definition.adapterId,
    host: definition.host,
    receiptWriter: cloneJson(definition.receiptWriter)
  }));
}

export function createOperatorProofTemplate(
  id: OperatorProofTemplateId,
  options: CreateOperatorProofTemplateOptions = {}
): OperatorProofTemplate {
  const definition = resolveTemplateDefinition(id);

  return {
    template: "dx.extension.operator_proof_template",
    id: definition.id,
    adapterId: definition.adapterId,
    host: definition.host,
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    receiptWriter: cloneJson(definition.receiptWriter),
    status: {
      validReceiptInput: false,
      operatorActionRequired: true
    },
    evidenceChecklist: cloneJson(definition.evidenceChecklist),
    proof: cloneJson(definition.proof)
  };
}

function resolveTemplateDefinition(id: OperatorProofTemplateId): OperatorProofTemplateDefinition {
  const definition = templateDefinitions.find((item) => item.id === id);

  if (!definition) {
    throw new Error(`Unsupported operator proof template: ${String(id)}`);
  }

  return definition;
}

export function writeOperatorProofTemplateFile(
  options: WriteOperatorProofTemplateFileOptions
): WriteOperatorProofTemplateFileResult {
  const outputPath = resolve(options.outputPath);
  const template = createOperatorProofTemplate(options.id, {
    generatedAt: options.generatedAt
  });

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(template, null, 2)}\n`);

  return {
    outputPath,
    template
  };
}
