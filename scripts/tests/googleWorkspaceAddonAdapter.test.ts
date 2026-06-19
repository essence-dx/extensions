import assert from "node:assert/strict";

import {
  assertDxManifest,
  assertJ1Script,
  assertPackageScript,
  assertRegistryEntry,
  assertSourceDoesNotMatch,
  readDxManifest,
  readWorkspaceJson,
  readWorkspaceText,
  requireWorkspacePaths
} from "./hostPluginScaffoldAssertions.ts";

interface AppsScriptManifest {
  timeZone: string;
  exceptionLogging: string;
  runtimeVersion: string;
  oauthScopes?: string[];
  addOns: {
    common: {
      name: string;
      logoUrl: string;
      layoutProperties: { primaryColor: string; secondaryColor: string };
      homepageTrigger: { runFunction: string; enabled: boolean };
    };
  };
}

const adapterRoot = "hosts/google-workspace/dx-google-workspace-addon";
const dxManifestPath = `${adapterRoot}/dx.extension.toml`;
const appsScriptManifestPath = `${adapterRoot}/appsscript.json`;
const messagesPath = `${adapterRoot}/src/messages.ts`;
const commandPlansPath = `${adapterRoot}/src/commandPlans.ts`;
const boundaryPath = `${adapterRoot}/src/localServiceBoundary.ts`;
const cardsPath = `${adapterRoot}/src/cards.ts`;
const entrypointsPath = `${adapterRoot}/src/entrypoints.ts`;
const readmePath = `${adapterRoot}/README.md`;
const starterGuidePath = "docs/google-workspace-addon-starter.md";

requireWorkspacePaths([
  "hosts/google-workspace/README.md",
  dxManifestPath,
  appsScriptManifestPath,
  `${adapterRoot}/.claspignore`,
  messagesPath,
  commandPlansPath,
  boundaryPath,
  cardsPath,
  entrypointsPath,
  `${adapterRoot}/.gitignore`,
  readmePath,
  starterGuidePath
]);

assertRegistryEntry({
  id: "dx.google-workspace.command-center",
  path: adapterRoot,
  manifest: dxManifestPath,
  professionalTarget: "google.workspace-addons"
});
assertPackageScript(
  "test:google-workspace-addon-adapter",
  "scripts/tests/googleWorkspaceAddonAdapter.test.ts"
);
assertJ1Script("test:google-workspace-addon-adapter");

assertDxManifest(readDxManifest(dxManifestPath), {
  id: "dx.google-workspace.command-center",
  name: "DX Google Workspace Command Center",
  hosts: ["google-workspace"],
  sandbox: "google-workspace-addon",
  network: "restricted-to-google-workspace",
  entrypointCommand: "dx-cloud-service",
  capabilities: [
    "google.workspace.card",
    "google.workspace.file.metadata",
    "cloud_service.connect",
    "receipts.read"
  ],
  hostActions: [
    "dx.google-workspace.show_status",
    "dx.google-workspace.search_assets",
    "dx.google-workspace.show_receipts"
  ],
  receiptPath:
    ".dx/receipts/extensions/dx.google-workspace.command-center/host-action-index-latest.json"
});
const dxManifestSource = readWorkspaceText(dxManifestPath);
assert.doesNotMatch(
  dxManifestSource,
  /scaffold|loaded-host proof|cloud-service proof|local-service proof/i
);

const appsScriptManifest = readWorkspaceJson<AppsScriptManifest>(appsScriptManifestPath);
assert.equal(appsScriptManifest.timeZone, "Etc/UTC");
assert.equal(appsScriptManifest.exceptionLogging, "STACKDRIVER");
assert.equal(appsScriptManifest.runtimeVersion, "V8");
assert.equal(appsScriptManifest.addOns.common.name, "DX Command Center");
assert.equal(appsScriptManifest.addOns.common.homepageTrigger.runFunction, "showDxCommandCenter");
assert.equal(appsScriptManifest.addOns.common.homepageTrigger.enabled, true);
assert.deepEqual(appsScriptManifest.oauthScopes ?? [], []);

const messagesSource = readWorkspaceText(messagesPath);
assert.match(messagesSource, /DX_GOOGLE_WORKSPACE_ACTIONS/);

const commandPlansSource = readWorkspaceText(commandPlansPath);
assert.match(commandPlansSource, /DX_GOOGLE_WORKSPACE_COMMAND_PLANS/);
assert.match(commandPlansSource, /operation: "dx\.status"/);
assert.match(commandPlansSource, /operation: "dx\.assets\.search"/);
assert.match(commandPlansSource, /operation: "receipt\.showPath"/);
assert.match(commandPlansSource, /transport: "cloud-service"/);
assert.match(commandPlansSource, /requiresRuntimeProof: true/);
assert.match(commandPlansSource, /mutatesWorkspaceFile: false/);

const boundarySource = readWorkspaceText(boundaryPath);
assert.match(boundarySource, /DxWorkspaceServiceRequest/);
assert.match(boundarySource, /metadataOnly: true/);
assert.doesNotMatch(boundarySource, /fileName|documentUrl|tenantUrl|selectedText|bodyText/i);

const cardsSource = readWorkspaceText(cardsPath);
assert.match(cardsSource, /showDxCommandCenter/);
assert.match(cardsSource, /buildDxCommandCenterCard/);
assert.match(cardsSource, /DX service connection is not configured for this host/);
assert.doesNotMatch(cardsSource, /metadata only|scaffold/i);

const entrypointsSource = readWorkspaceText(entrypointsPath);
assert.match(entrypointsSource, /handleDxWorkspaceAction/);
assert.match(entrypointsSource, /commandPlanForAction/);
assert.match(entrypointsSource, /showDxCommandCenter/);

const forbiddenRuntimePattern =
  /DriveApp|GmailApp|DocumentApp|SlidesApp|SpreadsheetApp|UrlFetchApp|PropertiesService|ScriptApp\.newTrigger|Utilities\.sleep|eval\(|Function\(|fetch\(|XMLHttpRequest|WebSocket|localhost|127\.0\.0\.1|PowerShell|cmd\.exe|bash|sh -c/i;
assertSourceDoesNotMatch(messagesPath, forbiddenRuntimePattern);
assertSourceDoesNotMatch(commandPlansPath, forbiddenRuntimePattern);
assertSourceDoesNotMatch(boundaryPath, forbiddenRuntimePattern);
assertSourceDoesNotMatch(cardsPath, forbiddenRuntimePattern);
assertSourceDoesNotMatch(entrypointsPath, forbiddenRuntimePattern);

const readmeSource = readWorkspaceText(readmePath);
assert.match(readmeSource, /source-level only/i);
assert.match(readmeSource, /test Workspace file smoke/i);
assert.match(readmeSource, /cloud-service proof remains deferred/i);
assert.match(readmeSource, /Marketplace readiness remains deferred/i);
assert.doesNotMatch(readmeSource, /release[- ]ready|published|installable/i);

const starterGuideSource = readWorkspaceText(starterGuidePath);
assert.match(starterGuideSource, /https:\/\/developers\.google\.com\/workspace\/add-ons\/overview/);
assert.match(starterGuideSource, /Apps Script/i);
assert.match(starterGuideSource, /cloud-service proof remains deferred/i);

console.log("Google Workspace add-on adapter verified");
