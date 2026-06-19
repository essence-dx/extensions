import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildGoogleWorkspaceAppsScriptOutput } from "../build-google-workspace-apps-script-output.ts";

const root = process.cwd();
const adapterRoot = join(root, "hosts", "google-workspace", "dx-google-workspace-addon");
const outputRoot = mkdtempSync(join(tmpdir(), "dx-google-workspace-output-"));

try {
  const result = buildGoogleWorkspaceAppsScriptOutput({
    adapterRoot,
    outputRoot
  });

  assert.equal(result.adapterRoot, adapterRoot);
  assert.equal(result.outputRoot, outputRoot);
  assert.equal(result.manifestPath, join(outputRoot, "appsscript.json"));
  assert.equal(result.codePath, join(outputRoot, "Code.gs"));
  assert.deepEqual(result.entrypoints, [
    "showDxCommandCenter",
    "handleDxWorkspaceAction"
  ]);
  assert.deepEqual(result.actions, [
    "dx.google-workspace.show_status",
    "dx.google-workspace.search_assets",
    "dx.google-workspace.show_receipts"
  ]);

  assert.equal(existsSync(result.manifestPath), true, "appsscript.json should be emitted");
  assert.equal(existsSync(result.codePath), true, "Code.gs should be emitted");

  const manifest = JSON.parse(readFileSync(result.manifestPath, "utf8"));
  assert.equal(manifest.runtimeVersion, "V8");
  assert.deepEqual(manifest.oauthScopes ?? [], []);
  assert.equal(manifest.addOns.common.homepageTrigger.runFunction, "showDxCommandCenter");

  const code = readFileSync(result.codePath, "utf8");
  assert.match(code, /function showDxCommandCenter\(e\)/);
  assert.match(code, /return \[buildDxWorkspaceCard_\(DX_HOME_CARD_\)\];/);
  assert.match(code, /function handleDxWorkspaceAction\(e\)/);
  assert.match(code, /return CardService\.newActionResponseBuilder\(\)/);
  assert.match(code, /\.setNavigation\(CardService\.newNavigation\(\)\.updateCard\(card\)\)/);
  assert.match(code, /\.build\(\);/);
  assert.match(code, /CardService\.newCardBuilder\(\)/);
  assert.match(code, /CardService\.newCardHeader\(\)\.setTitle\(model\.title\)/);
  assert.match(code, /CardService\.newCardSection\(\)/);
  assert.match(code, /CardService\.newTextParagraph\(\)\.setText\(model\.body\)/);
  assert.match(code, /CardService\.newTextButton\(\)\.setText\(action\.label\)/);
  assert.match(code, /CardService\.newAction\(\)\.setFunctionName\("handleDxWorkspaceAction"\)/);
  assert.match(code, /setParameters\(\{ action: action\.action \}\)/);
  assert.match(code, /DX_GOOGLE_WORKSPACE_COMMAND_PLANS_/);
  assert.match(code, /"operation": "dx.status"/);
  assert.match(code, /"operation": "dx.assets.search"/);
  assert.match(code, /"operation": "receipt.showPath"/);
  assert.match(code, /"transport": "cloud-service"/);
  assert.match(code, /"requiresRuntimeProof": true/);
  assert.match(code, /"mutatesWorkspaceFile": false/);
  assert.match(code, /DX cloud-service proof is required before this command can run/);
  assert.doesNotMatch(code, /return buildDxWorkspaceCard_/);

  const forbiddenRuntimePattern =
    /DriveApp|GmailApp|DocumentApp|SlidesApp|SpreadsheetApp|UrlFetchApp|PropertiesService|ScriptApp\.newTrigger|Utilities\.sleep|eval\(|Function\(|fetch\(|XMLHttpRequest|WebSocket|localhost|127\.0\.0\.1|PowerShell|cmd\.exe|bash|sh -c/i;
  assert.doesNotMatch(code, forbiddenRuntimePattern);
} finally {
  rmSync(outputRoot, { recursive: true, force: true });
}

console.log("Google Workspace Apps Script output verified");
