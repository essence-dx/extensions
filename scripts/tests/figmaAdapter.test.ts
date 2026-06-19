import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parseTomlDocument } from "../lib/toml-lite.ts";

const root = process.cwd();
const adapterRoot = join(root, "hosts", "figma", "dx-figma");
const dxManifestPath = join(adapterRoot, "dx.extension.toml");
const figmaManifestPath = join(adapterRoot, "manifest.json");
const messagesPath = join(adapterRoot, "src", "messages.ts");
const commandPlansPath = join(adapterRoot, "src", "commandPlans.ts");
const pluginPath = join(adapterRoot, "src", "main.ts");
const uiPath = join(adapterRoot, "ui.html");
const gitignorePath = join(adapterRoot, ".gitignore");
const readmePath = join(adapterRoot, "README.md");
const starterGuidePath = join(root, "docs", "figma-plugin-starter.md");

for (const path of [
  dxManifestPath,
  figmaManifestPath,
  messagesPath,
  commandPlansPath,
  pluginPath,
  uiPath,
  gitignorePath,
  readmePath,
  starterGuidePath
]) {
  assert.equal(existsSync(path), true, `${path} should exist`);
}

const registrySource = readFileSync(join(root, "registry", "official-extensions.toml"), "utf8");
assert.match(registrySource, /id = "dx\.figma\.command-center"/);
assert.match(registrySource, /path = "hosts\/figma\/dx-figma"/);
assert.match(registrySource, /manifest = "hosts\/figma\/dx-figma\/dx\.extension\.toml"/);
assert.match(registrySource, /status = "experimental"/);

const dxManifestSource = readFileSync(dxManifestPath, "utf8");
const dxManifest = parseTomlDocument(dxManifestSource);
assert.doesNotMatch(dxManifestSource, /scaffold|loaded-host proof|local-service proof/i);
assert.equal(dxManifest.sections.extension.id, "dx.figma.command-center");
assert.equal(dxManifest.sections.extension.name, "DX Figma Command Center");
assert.equal(dxManifest.sections.extension.official, true);
assert.deepEqual(dxManifest.sections.compatibility.hosts, ["figma"]);
assert.equal(dxManifest.sections.entrypoint.transport, "http");
assert.equal(dxManifest.sections.entrypoint.command, "dx-local-service");
assert.deepEqual(dxManifest.sections.entrypoint.args, []);
assert.equal(dxManifest.sections.security.signature, "development-unsigned");
assert.equal(dxManifest.sections.security.sandbox, "figma-plugin-sandbox");
assert.equal(dxManifest.sections.security.network, "deny-by-default");
assert.equal(dxManifest.sections.security.stores_payloads, false);
assert.equal(dxManifest.sections.security.stores_process_output, false);

const capabilityIds = (dxManifest.arrays.capabilities ?? []).map((capability) => capability.id);
assert.deepEqual(capabilityIds, ["figma.ui", "local_service.connect", "receipts.read"]);

const hostActionIds = (dxManifest.arrays.host_actions ?? []).map((action) => action.id);
assert.deepEqual(hostActionIds, [
  "dx.figma.show_status",
  "dx.figma.search_assets",
  "dx.figma.copy_receipts_path"
]);
assert.ok(
  (dxManifest.arrays.host_actions ?? []).every((action) => action.transport !== "process"),
  "Figma host actions must not use process transport"
);

const receipt = dxManifest.arrays.receipts?.[0];
assert.equal(
  receipt.latest_path,
  ".dx/receipts/extensions/dx.figma.command-center/host-action-index-latest.json"
);
assert.equal(receipt.metadata_only, true);

const figmaManifest = JSON.parse(readFileSync(figmaManifestPath, "utf8"));
assert.equal(figmaManifest.name, "DX Command Center");
assert.equal(figmaManifest.id, "dx-figma-command-center-development");
assert.equal(figmaManifest.api, "1.0.0");
assert.deepEqual(figmaManifest.editorType, ["figma"]);
assert.equal(figmaManifest.main, "main.js");
assert.equal(figmaManifest.ui, "ui.html");
assert.equal(figmaManifest.documentAccess, "dynamic-page");
assert.deepEqual(figmaManifest.networkAccess.allowedDomains, ["none"]);
assert.deepEqual(figmaManifest.networkAccess.devAllowedDomains, []);
assert.equal(Array.isArray(figmaManifest.menu), true);
assert.deepEqual(
  figmaManifest.menu.filter((item) => item.command).map((item) => item.command),
  ["show-status", "search-assets", "copy-receipts-path"]
);
assert.equal(
  figmaManifest.menu.some((item) => item.separator === true),
  true
);
assert.equal(figmaManifest.enableProposedApi, undefined);
assert.equal(figmaManifest.enablePrivatePluginApi, undefined);
assert.equal(figmaManifest.build, undefined);

const forbiddenManifestText = JSON.stringify(figmaManifest);
assert.doesNotMatch(forbiddenManifestText, /currentuser|activeusers|fileusers|payments|teamlibrary/i);
assert.doesNotMatch(forbiddenManifestText, /"\*"/);
assert.doesNotMatch(forbiddenManifestText, /localhost/i);

const messagesSource = readFileSync(messagesPath, "utf8");
assert.match(messagesSource, /DX_FIGMA_MESSAGES[\s\S]*showStatus:\s*"dx\.figma\.show_status"/);
assert.match(messagesSource, /searchAssets:\s*"dx\.figma\.search_assets"/);
assert.match(messagesSource, /copyReceiptsPath:\s*"dx\.figma\.copy_receipts_path"/);
assert.match(messagesSource, /DX_FIGMA_MENU_COMMANDS[\s\S]*showStatus:\s*"show-status"/);
assert.match(messagesSource, /messageTypeForMenuCommand/);
assert.match(messagesSource, /isDxFigmaUiMessage\(value:\s*unknown\):\s*value is DxFigmaMessage/);
assert.match(messagesSource, /typeof message\.query !== "string"/);

const commandPlansSource = readFileSync(commandPlansPath, "utf8");
assert.match(commandPlansSource, /operation:\s*"dx\.status"/);
assert.match(commandPlansSource, /operation:\s*"dx\.assets\.search"/);
assert.match(commandPlansSource, /operation:\s*"receipt\.copyPath"/);
assert.match(commandPlansSource, /requiresRuntimeProof:\s*true/);
assert.match(
  commandPlansSource,
  /copyReceiptsPath:\s*{[\s\S]*transport:\s*"host-ui"[\s\S]*requiresRuntimeProof:\s*false[\s\S]*}/
);
assert.doesNotMatch(commandPlansSource, /fetch\(/);
assert.doesNotMatch(commandPlansSource, /child_process|spawn\(|exec\(|execFile\(|Deno\.Command|Bun\.spawn|PowerShell|cmd\.exe|bash|sh -c|shell/i);

const pluginSource = readFileSync(pluginPath, "utf8");
assert.match(pluginSource, /figma\.showUI\(__html__/);
assert.match(pluginSource, /figma\.ui\.onmessage/);
assert.match(pluginSource, /figma\.ui\.onmessage\s*=\s*\(message:\s*unknown\)/);
assert.match(pluginSource, /isDxFigmaUiMessage\(message\)/);
assert.doesNotMatch(pluginSource, /onmessage\s*=\s*\(message:\s*DxFigmaMessage\)/);
assert.match(pluginSource, /figma\.command/);
assert.match(pluginSource, /messageTypeForMenuCommand\(figma\.command\)/);
assert.match(pluginSource, /figma\.notify/);
assert.match(pluginSource, /DX service connection is not configured for this host/);
assert.doesNotMatch(pluginSource, /local-service proof|loaded-host proof|metadata only|scaffold/i);
assert.doesNotMatch(pluginSource, /fetch\(/);
assert.doesNotMatch(pluginSource, /XMLHttpRequest/);
assert.doesNotMatch(pluginSource, /child_process|spawn\(|exec\(|execFile\(|Deno\.Command|Bun\.spawn|PowerShell|cmd\.exe|bash|sh -c|shell/i);

const uiSource = readFileSync(uiPath, "utf8");
assert.match(uiSource, /parent\.postMessage/);
assert.match(uiSource, /dx\.figma\.show_status/);
assert.match(uiSource, /dx\.figma\.search_assets/);
assert.match(uiSource, /dx\.figma\.copy_receipts_path/);
assert.doesNotMatch(uiSource, /fetch\(/);
assert.doesNotMatch(uiSource, /XMLHttpRequest/);

const gitignoreSource = readFileSync(gitignorePath, "utf8");
assert.match(gitignoreSource, /^\/main\.js$/m);
assert.match(gitignoreSource, /^\/main\.js\.map$/m);

const readmeSource = readFileSync(readmePath, "utf8");
assert.match(readmeSource, /source-level only/i);
assert.match(readmeSource, /loaded\s+Figma desktop smoke/i);
assert.match(readmeSource, /local-service proof/i);
assert.match(readmeSource, /signing[\s\S]*checksum[\s\S]*remain deferred/i);
assert.doesNotMatch(readmeSource, /release[- ]ready|marketplace[- ]ready|production[- ]ready|community approved|published/i);

const starterGuideSource = readFileSync(starterGuidePath, "utf8");
assert.match(starterGuideSource, /https:\/\/developers\.figma\.com\/docs\/plugins\/manifest\//);
assert.match(starterGuideSource, /documentAccess: "dynamic-page"/);
assert.match(starterGuideSource, /allowedDomains: \["none"\]/);
assert.match(starterGuideSource, /local-service\s+proof remains deferred/i);
assert.match(starterGuideSource, /Community review remains\s+deferred/i);

console.log("Figma adapter verified");
