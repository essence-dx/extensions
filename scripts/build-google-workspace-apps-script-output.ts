import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildDxCommandCenterCard } from "../hosts/google-workspace/dx-google-workspace-addon/src/cards.ts";
import { DX_GOOGLE_WORKSPACE_COMMAND_PLANS } from "../hosts/google-workspace/dx-google-workspace-addon/src/commandPlans.ts";
import { DX_GOOGLE_WORKSPACE_ACTIONS } from "../hosts/google-workspace/dx-google-workspace-addon/src/messages.ts";

export interface GoogleWorkspaceAppsScriptOutputOptions {
  adapterRoot?: string;
  outputRoot?: string;
}

export interface GoogleWorkspaceAppsScriptOutputResult {
  adapterRoot: string;
  outputRoot: string;
  manifestPath: string;
  codePath: string;
  entrypoints: string[];
  actions: string[];
}

export function buildGoogleWorkspaceAppsScriptOutput(
  options: GoogleWorkspaceAppsScriptOutputOptions = {}
): GoogleWorkspaceAppsScriptOutputResult {
  const adapterRoot = resolve(
    options.adapterRoot ??
      join(process.cwd(), "hosts", "google-workspace", "dx-google-workspace-addon")
  );
  const outputRoot = resolve(options.outputRoot ?? join(adapterRoot, "dist"));
  const manifestPath = join(outputRoot, "appsscript.json");
  const codePath = join(outputRoot, "Code.gs");
  const entrypoints = ["showDxCommandCenter", "handleDxWorkspaceAction"];

  mkdirSync(outputRoot, { recursive: true });
  copyFileSync(join(adapterRoot, "appsscript.json"), manifestPath);
  writeFileSync(codePath, renderAppsScriptCode());

  return {
    adapterRoot,
    outputRoot,
    manifestPath,
    codePath,
    entrypoints,
    actions: Object.values(DX_GOOGLE_WORKSPACE_ACTIONS)
  };
}

if (isDirectRun()) {
  const result = buildGoogleWorkspaceAppsScriptOutput();
  console.log(`Google Workspace Apps Script output built: ${result.outputRoot}`);
}

function renderAppsScriptCode(): string {
  const homeCard = buildDxCommandCenterCard();
  const plans = Object.fromEntries(
    Object.entries(DX_GOOGLE_WORKSPACE_COMMAND_PLANS).map(([action, plan]) => [
      action,
      {
        operation: plan.operation,
        transport: plan.transport,
        requiresRuntimeProof: plan.requiresRuntimeProof,
        mutatesWorkspaceFile: plan.mutatesWorkspaceFile
      }
    ])
  );

  return [
    '"use strict";',
    "",
    `const DX_GOOGLE_WORKSPACE_ACTIONS_ = ${formatJson(DX_GOOGLE_WORKSPACE_ACTIONS)};`,
    `const DX_GOOGLE_WORKSPACE_COMMAND_PLANS_ = ${formatJson(plans)};`,
    `const DX_HOME_CARD_ = ${formatJson(homeCard)};`,
    "",
    "function showDxCommandCenter(e) {",
    "  return [buildDxWorkspaceCard_(DX_HOME_CARD_)];",
    "}",
    "",
    "function handleDxWorkspaceAction(e) {",
    "  const action = normalizeDxAction_(e && e.parameters && e.parameters.action);",
    "  const plan = DX_GOOGLE_WORKSPACE_COMMAND_PLANS_[action];",
    "  const card = buildDxWorkspaceCard_({",
    '    title: "DX Command Center",',
    '    body: plan.operation + "\\n\\nDX cloud-service proof is required before this command can run. This add-on scaffold is metadata only.",',
    '    actions: [{ label: "Back", action: DX_GOOGLE_WORKSPACE_ACTIONS_.showStatus }]',
    "  });",
    "",
    "  return CardService.newActionResponseBuilder()",
    "    .setNavigation(CardService.newNavigation().updateCard(card))",
    "    .build();",
    "}",
    "",
    "function buildDxWorkspaceCard_(model) {",
    "  const section = CardService.newCardSection();",
    "  section.addWidget(CardService.newTextParagraph().setText(model.body));",
    "",
    "  const buttons = CardService.newButtonSet();",
    "  for (let index = 0; index < model.actions.length; index += 1) {",
    "    const action = model.actions[index];",
    "    buttons.addButton(createDxActionButton_(action));",
    "  }",
    "  section.addWidget(buttons);",
    "",
    "  return CardService.newCardBuilder()",
    "    .setHeader(CardService.newCardHeader().setTitle(model.title))",
    "    .addSection(section)",
    "    .build();",
    "}",
    "",
    "function createDxActionButton_(action) {",
    "  return CardService.newTextButton().setText(action.label).setOnClickAction(",
    '    CardService.newAction().setFunctionName("handleDxWorkspaceAction")',
    "      .setParameters({ action: action.action })",
    "  );",
    "}",
    "",
    "function normalizeDxAction_(action) {",
    "  if (DX_GOOGLE_WORKSPACE_COMMAND_PLANS_[action]) {",
    "    return action;",
    "  }",
    "",
    "  return DX_GOOGLE_WORKSPACE_ACTIONS_.showStatus;",
    "}",
    ""
  ].join("\n");
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function isDirectRun(): boolean {
  if (!process.argv[1]) {
    return false;
  }

  return (
    normalize(resolve(process.argv[1])).toLowerCase() ===
    normalize(fileURLToPath(import.meta.url)).toLowerCase()
  );
}
