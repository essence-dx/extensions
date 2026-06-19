import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parseTomlDocument } from "../lib/toml-lite.ts";

const root = process.cwd();
const adapterRoot = join(root, "hosts", "office", "dx-word");
const dxManifestPath = join(adapterRoot, "dx.extension.toml");
const officeManifestPath = join(adapterRoot, "manifest.xml");
const messagesPath = join(adapterRoot, "src", "messages.ts");
const commandPlansPath = join(adapterRoot, "src", "commandPlans.ts");
const taskpanePath = join(adapterRoot, "src", "taskpane.ts");
const taskpaneHtmlPath = join(adapterRoot, "static", "taskpane.html");
const gitignorePath = join(adapterRoot, ".gitignore");
const readmePath = join(adapterRoot, "README.md");
const officeBoundaryPath = join(root, "hosts", "office", "README.md");
const starterGuidePath = join(root, "docs", "office-word-addin-starter.md");

for (const path of [
  officeBoundaryPath,
  dxManifestPath,
  officeManifestPath,
  messagesPath,
  commandPlansPath,
  taskpanePath,
  taskpaneHtmlPath,
  gitignorePath,
  readmePath,
  starterGuidePath
]) {
  assert.equal(existsSync(path), true, `${path} should exist`);
}

const registrySource = readFileSync(join(root, "registry", "official-extensions.toml"), "utf8");
assert.match(registrySource, /id = "dx\.word\.command-center"/);
assert.match(registrySource, /path = "hosts\/office\/dx-word"/);
assert.match(registrySource, /manifest = "hosts\/office\/dx-word\/dx\.extension\.toml"/);
assert.match(registrySource, /status = "experimental"/);

const packageSource = readFileSync(join(root, "package.json"), "utf8");
assert.match(packageSource, /"test:word-adapter": "node --experimental-strip-types scripts\/tests\/wordAdapter\.test\.ts"/);

const testJ1Source = readFileSync(join(root, "scripts", "test-j1.ps1"), "utf8");
assert.match(testJ1Source, /Invoke-DxCommand "npm" @\("run", "test:word-adapter"\)/);

const dxManifestSource = readFileSync(dxManifestPath, "utf8");
const dxManifest = parseTomlDocument(dxManifestSource);
assert.doesNotMatch(dxManifestSource, /scaffold|sideload proof|local-service proof/i);
assert.equal(dxManifest.sections.extension.id, "dx.word.command-center");
assert.equal(dxManifest.sections.extension.name, "DX Word Command Center");
assert.equal(dxManifest.sections.extension.official, true);
assert.deepEqual(dxManifest.sections.compatibility.hosts, ["word"]);
assert.equal(dxManifest.sections.entrypoint.transport, "http");
assert.equal(dxManifest.sections.entrypoint.command, "dx-local-service");
assert.deepEqual(dxManifest.sections.entrypoint.args, []);
assert.equal(dxManifest.sections.security.signature, "development-unsigned");
assert.equal(dxManifest.sections.security.sandbox, "office-web-addin");
assert.equal(dxManifest.sections.security.network, "restricted-to-valid-domains");
assert.equal(dxManifest.sections.security.stores_payloads, false);
assert.equal(dxManifest.sections.security.stores_process_output, false);

const capabilityIds = (dxManifest.arrays.capabilities ?? []).map((capability) => capability.id);
assert.deepEqual(capabilityIds, [
  "office.taskpane",
  "office.document.read",
  "local_service.connect",
  "receipts.read"
]);
assert.equal(capabilityIds.includes("process.spawn"), false);

const hostActions = dxManifest.arrays.host_actions ?? [];
assert.deepEqual(hostActions.map((action) => action.id), [
  "dx.word.show_status",
  "dx.word.search_assets",
  "dx.word.copy_receipts_path"
]);
assert.ok(hostActions.every((action) => action.transport !== "process"));

const receipt = dxManifest.arrays.receipts?.[0];
assert.equal(
  receipt.latest_path,
  ".dx/receipts/extensions/dx.word.command-center/host-action-index-latest.json"
);
assert.equal(receipt.metadata_only, true);

const officeManifest = readFileSync(officeManifestPath, "utf8");
assert.match(officeManifest, /<OfficeApp[\s\S]*xsi:type="TaskPaneApp"/);
assert.match(officeManifest, /<Id>2f4a1d72-6b41-4e8e-8e33-7cd2610f2a01<\/Id>/);
assert.match(officeManifest, /<DisplayName DefaultValue="DX Command Center"\/>/);
assert.match(officeManifest, /<Host Name="Document"\/>/);
assert.match(officeManifest, /<Requirements>[\s\S]*<Sets DefaultMinVersion="1\.1">[\s\S]*<Set Name="WordApi" MinVersion="1\.1"\/>[\s\S]*<\/Sets>[\s\S]*<\/Requirements>/);
assert.match(officeManifest, /<SourceLocation DefaultValue="https:\/\/dx-office\.example\.invalid\/word\/taskpane\.html"\/>/);
assert.match(officeManifest, /<AppDomain>https:\/\/dx-office\.example\.invalid<\/AppDomain>/);
assert.match(officeManifest, /<Permissions>ReadDocument<\/Permissions>/);
assert.match(officeManifest, /<VersionOverrides[\s\S]*<Host xsi:type="Document">[\s\S]*<Control xsi:type="Button" id="DxWordCommandCenterButton">[\s\S]*<Action xsi:type="ShowTaskpane">/);
assert.match(officeManifest, /<bt:Url id="DxWordTaskpaneUrl" DefaultValue="https:\/\/dx-office\.example\.invalid\/word\/taskpane\.html"\/>/);
assert.doesNotMatch(officeManifest, /<Host Name="Workbook"\/>|<Host Name="Presentation"\/>/);
const officeManifestUrls = [
  ...Array.from(officeManifest.matchAll(/DefaultValue="([^"]+)"/g), (match) => match[1]),
  ...Array.from(officeManifest.matchAll(/<AppDomain>([^<]+)<\/AppDomain>/g), (match) => match[1])
].join("\n");
assert.doesNotMatch(officeManifestUrls, /http:\/\/|file:|0\.0\.0\.0|\*|localhost|127\.0\.0\.1|ngrok|trycloudflare|\.\*/i);
assert.doesNotMatch(officeManifest, /<Permissions>\s*(ReadWriteDocument|ReadAllDocument|WriteDocument)\s*<\/Permissions>/i);

const messagesSource = readFileSync(messagesPath, "utf8");
assert.match(messagesSource, /DX_WORD_MESSAGES[\s\S]*showStatus:\s*"dx\.word\.show_status"/);
assert.match(messagesSource, /searchAssets:\s*"dx\.word\.search_assets"/);
assert.match(messagesSource, /copyReceiptsPath:\s*"dx\.word\.copy_receipts_path"/);

const commandPlansSource = readFileSync(commandPlansPath, "utf8");
assert.match(commandPlansSource, /operation:\s*"dx\.status"/);
assert.match(commandPlansSource, /operation:\s*"dx\.assets\.search"/);
assert.match(commandPlansSource, /operation:\s*"receipt\.copyPath"/);
assert.match(commandPlansSource, /requiresRuntimeProof:\s*true/);
assert.match(
  commandPlansSource,
  /copyReceiptsPath:\s*{[\s\S]*transport:\s*"host-ui"[\s\S]*requiresRuntimeProof:\s*false[\s\S]*}/
);
assert.doesNotMatch(commandPlansSource, /fetch\(|XMLHttpRequest|child_process|spawn\(|exec\(|execFile\(|PowerShell|cmd\.exe|bash|sh -c|shell/i);

const taskpaneSource = readFileSync(taskpanePath, "utf8");
assert.match(taskpaneSource, /Office\.onReady/);
assert.match(taskpaneSource, /Office\.HostType\.Word/);
assert.match(taskpaneSource, /WordApi/);
assert.match(taskpaneSource, /DX_WORD_MESSAGES/);
assert.match(taskpaneSource, /describeDxOfficeServiceConnectionNotice/);
assert.doesNotMatch(taskpaneSource, /describeDxOfficeLocalServiceProofBlock|local-service proof/i);
assert.doesNotMatch(taskpaneSource, /fetch\(|XMLHttpRequest|child_process|spawn\(|exec\(|execFile\(|PowerShell|cmd\.exe|bash|sh -c|shell/i);
assert.doesNotMatch(taskpaneSource, /OfficeRuntime\.auth\.getAccessToken/i);
assert.doesNotMatch(taskpaneSource, /insertText|insertFile|setSelectedDataAsync|Word\.InsertLocation|delete\(/i);
assert.doesNotMatch(
  taskpaneSource,
  /\b(?:insertHtml|insertOoxml|insertFileFromBase64|insertInlinePictureFromBase64|insertParagraph|insertTable|insertBreak|insertContentControl|getSelectedDataAsync|getHtml|getOoxml|clear)\b|\.delete\s*\(|font\.set|styleBuiltIn\s*=|style\s*=|document\.body\.text|body\.search|contentControls/i
);

const taskpaneHtml = readFileSync(taskpaneHtmlPath, "utf8");
assert.match(taskpaneHtml, /https:\/\/appsforoffice\.microsoft\.com\/lib\/1\/hosted\/office\.js/);
assert.match(taskpaneHtml, /<script type="module" src="\.\.\/src\/taskpane\.ts"><\/script>/);
assert.match(taskpaneHtml, /data-command="dx\.word\.show_status"/);
assert.match(taskpaneHtml, /data-command="dx\.word\.search_assets"/);
assert.match(taskpaneHtml, /data-command="dx\.word\.copy_receipts_path"/);
assert.doesNotMatch(taskpaneHtml, /fetch\(|XMLHttpRequest|child_process|spawn\(|exec\(|execFile\(|PowerShell|cmd\.exe|bash|sh -c|shell/i);

const readmeSource = readFileSync(readmePath, "utf8");
assert.match(readmeSource, /hosted task-pane asset proof/i);
assert.match(readmeSource, /taskpane\.js/i);
assert.match(readmeSource, /sideloaded Word smoke/i);
assert.match(readmeSource, /local-service proof remains deferred/i);
assert.match(readmeSource, /signing[\s\S]*checksum[\s\S]*remain deferred/i);
assert.doesNotMatch(readmeSource, /release[- ]ready|marketplace[- ]ready|production[- ]ready|AppSource approved|published|installable/i);

const officeBoundarySource = readFileSync(officeBoundaryPath, "utf8");
assert.match(officeBoundarySource, /Office Add-ins are web add-ins/i);
assert.match(officeBoundarySource, /must not spawn local processes/i);
assert.match(officeBoundarySource, /Excel, PowerPoint, and Word/i);
assert.match(officeBoundarySource, /Word owns document behavior/i);

const gitignoreSource = readFileSync(gitignorePath, "utf8");
assert.match(gitignoreSource, /^\/dist\//m);
assert.match(gitignoreSource, /^\/static\/taskpane\.js$/m);
assert.match(gitignoreSource, /^\/static\/taskpane\.js\.map$/m);

const starterGuideSource = readFileSync(starterGuidePath, "utf8");
assert.match(starterGuideSource, /https:\/\/learn\.microsoft\.com\/en-us\/office\/dev\/add-ins\/word\/word-add-ins-programming-overview/);
assert.match(starterGuideSource, /TaskPaneApp/);
assert.match(starterGuideSource, /Document/);
assert.match(starterGuideSource, /WordApi/);
assert.match(starterGuideSource, /local-service proof remains deferred/i);
assert.match(starterGuideSource, /AppSource approval remains deferred/i);

console.log("Word adapter verified");
