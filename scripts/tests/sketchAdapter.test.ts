import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parseTomlDocument } from "../lib/toml-lite.ts";

const root = process.cwd();
const boundaryPath = join(root, "hosts", "sketch", "README.md");
const adapterRoot = join(root, "hosts", "sketch", "dx-sketch");
const dxManifestPath = join(adapterRoot, "dx.extension.toml");
const sketchManifestPath = join(adapterRoot, "manifest.json");
const messagesPath = join(adapterRoot, "src", "messages.ts");
const commandPlansPath = join(adapterRoot, "src", "commandPlans.ts");
const pluginPath = join(adapterRoot, "src", "index.ts");
const gitignorePath = join(adapterRoot, ".gitignore");
const readmePath = join(adapterRoot, "README.md");
const starterGuidePath = join(root, "docs", "sketch-plugin-starter.md");

const forbiddenRuntimePattern =
  /fetch\(|XMLHttpRequest|WebSocket|EventSource|localhost|127\.0\.0\.1|0\.0\.0\.0|http:\/\/|https:\/\/|ws:\/\/|wss:\/\/|child_process|spawn\(|exec\(|execFile\(|PowerShell|powershell\.exe|cmd\.exe|bash|sh -c|shell|sketchtool|NSTask|NSWorkspace|osascript|AppleScript|from\s+["'](?:node:)?fs["']|require\(["'](?:node:)?fs["']\)|readFile|writeFile|unlink|mkdir|rmdir|rm\(/i;
const forbiddenSketchMutationPattern =
  /require\(["']sketch["']\)|from\s+["']sketch["']|getSelectedDocument|getDocuments|selectedDocument|selectedLayers|context\.document|context\.selection|\b(document|documents|page|pages|artboard|artboards|layer|layers|shape|shapes|text|texts|symbol|symbols|style|styles)\s*\.\s*(create|add|remove|delete|duplicate|move|resize|transform|export|import|insert|set|replace)|\.export\(|\.save\(|\.remove\(|\.duplicate\(|\.move\(|\.resize\(/i;

for (const path of [
  boundaryPath,
  dxManifestPath,
  sketchManifestPath,
  messagesPath,
  commandPlansPath,
  pluginPath,
  gitignorePath,
  readmePath,
  starterGuidePath
]) {
  assert.equal(existsSync(path), true, `${path} should exist`);
}

const registrySource = readFileSync(join(root, "registry", "official-extensions.toml"), "utf8");
assert.match(registrySource, /id = "dx\.sketch\.command-center"/);
assert.match(registrySource, /name = "DX Sketch Command Center"/);
assert.match(registrySource, /path = "hosts\/sketch\/dx-sketch"/);
assert.match(registrySource, /manifest = "hosts\/sketch\/dx-sketch\/dx\.extension\.toml"/);
assert.match(registrySource, /status = "experimental"/);

const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
assert.equal(
  packageJson.scripts["test:sketch-adapter"],
  "node --experimental-strip-types scripts/tests/sketchAdapter.test.ts"
);
assert.equal(
  (packageJson.workspaces ?? []).includes("hosts/sketch/dx-sketch"),
  false,
  "Sketch adapter must stay a root-tested source adapter, not an npm workspace"
);
assert.equal(existsSync(join(adapterRoot, "package.json")), false);
assert.equal(existsSync(join(adapterRoot, "package-lock.json")), false);
assert.equal(existsSync(join(adapterRoot, "node_modules")), false);

const lockfile = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
const lockedWorkspaces = lockfile.packages?.[""]?.workspaces ?? [];
assert.equal(lockedWorkspaces.includes("hosts/sketch/dx-sketch"), false);
assert.equal(
  Object.keys(lockfile.packages ?? {}).some((path) => path.includes("dx-sketch")),
  false
);

const testJ1Source = readFileSync(join(root, "scripts", "test-j1.ps1"), "utf8");
assert.match(testJ1Source, /Invoke-DxCommand "npm" @\("run", "test:sketch-adapter"\)/);

const dxManifestSource = readFileSync(dxManifestPath, "utf8");
const dxManifest = parseTomlDocument(dxManifestSource);
assert.doesNotMatch(dxManifestSource, /scaffold|loaded-host proof|local-service proof/i);
assert.equal(dxManifest.sections.extension.id, "dx.sketch.command-center");
assert.equal(dxManifest.sections.extension.name, "DX Sketch Command Center");
assert.equal(dxManifest.sections.extension.official, true);
assert.deepEqual(dxManifest.sections.compatibility.hosts, ["sketch"]);
assert.equal(dxManifest.sections.entrypoint.transport, "http");
assert.equal(dxManifest.sections.entrypoint.command, "dx-local-service");
assert.deepEqual(dxManifest.sections.entrypoint.args, []);
assert.equal(dxManifest.sections.security.signature, "development-unsigned");
assert.equal(dxManifest.sections.security.sandbox, "sketch-plugin-command");
assert.equal(dxManifest.sections.security.network, "deny-by-default");
assert.equal(dxManifest.sections.security.stores_payloads, false);
assert.equal(dxManifest.sections.security.stores_process_output, false);

const capabilityIds = (dxManifest.arrays.capabilities ?? []).map((capability) => capability.id);
assert.deepEqual(capabilityIds, [
  "sketch.plugin.command",
  "sketch.document.read",
  "local_service.connect",
  "receipts.read"
]);
assert.equal(capabilityIds.includes("process.spawn"), false);
assert.equal(capabilityIds.includes("process.exec"), false);
assert.equal(capabilityIds.includes("filesystem.write"), false);
assert.equal(capabilityIds.includes("sketch.document.write"), false);

const hostActions = dxManifest.arrays.host_actions ?? [];
assert.deepEqual(hostActions.map((action) => action.id), [
  "dx.sketch.show_status",
  "dx.sketch.search_assets",
  "dx.sketch.show_receipts"
]);
assert.ok(hostActions.every((action) => action.transport !== "process"));
assert.ok(hostActions.every((action) => action.writes_receipts === false));

const receipt = dxManifest.arrays.receipts?.[0];
assert.equal(
  receipt.latest_path,
  ".dx/receipts/extensions/dx.sketch.command-center/host-action-index-latest.json"
);
assert.equal(receipt.metadata_only, true);

const sketchManifest = JSON.parse(readFileSync(sketchManifestPath, "utf8"));
assert.equal(sketchManifest.name, "DX Command Center");
assert.equal(sketchManifest.identifier, "dev.dx.sketch.command-center");
assert.equal(sketchManifest.version, "0.1.0");
assert.equal(sketchManifest.author, "DX");
assert.equal(sketchManifest.icon, "icon.png");
assert.equal(sketchManifest.compatibleVersion, "52.1");
assert.equal(sketchManifest.scope, "application");
assert.equal(sketchManifest.disableCocoaScriptPreprocessor, true);
assert.deepEqual(
  sketchManifest.commands.map((command) => [command.identifier, command.script, command.handler]),
  [
    ["show-status", "src/index.ts", "showDxStatus"],
    ["search-assets", "src/index.ts", "searchDxAssets"],
    ["show-receipts", "src/index.ts", "showDxReceipts"]
  ]
);
assert.deepEqual(sketchManifest.menu.items, [
  "show-status",
  "search-assets",
  "-",
  "show-receipts"
]);
assert.equal(sketchManifest.appcast, undefined);

const forbiddenManifestText = JSON.stringify(sketchManifest);
assert.doesNotMatch(forbiddenManifestText, /localhost|127\.0\.0\.1|0\.0\.0\.0|"\*"|"all"/i);
assert.doesNotMatch(forbiddenManifestText, /sketchtool|node_modules|\.node|native|appcast/i);

const messagesSource = readFileSync(messagesPath, "utf8");
assert.match(messagesSource, /DX_SKETCH_MESSAGES[\s\S]*showStatus:\s*"dx\.sketch\.show_status"/);
assert.match(messagesSource, /searchAssets:\s*"dx\.sketch\.search_assets"/);
assert.match(messagesSource, /showReceipts:\s*"dx\.sketch\.show_receipts"/);
assert.match(messagesSource, /DX_SKETCH_MENU_COMMANDS[\s\S]*showStatus:\s*"show-status"/);
assert.match(messagesSource, /messageTypeForMenuCommand/);

const commandPlansSource = readFileSync(commandPlansPath, "utf8");
assert.match(commandPlansSource, /operation:\s*"dx\.status"/);
assert.match(commandPlansSource, /operation:\s*"dx\.assets\.search"/);
assert.match(commandPlansSource, /operation:\s*"receipt\.showPath"/);
assert.match(commandPlansSource, /requiresRuntimeProof:\s*true/);
assert.match(commandPlansSource, /mutatesSketchDocument:\s*false/);
assert.doesNotMatch(commandPlansSource, forbiddenRuntimePattern);

const pluginSource = readFileSync(pluginPath, "utf8");
assert.match(pluginSource, /showDxStatus/);
assert.match(pluginSource, /searchDxAssets/);
assert.match(pluginSource, /showDxReceipts/);
assert.match(pluginSource, /DX_SKETCH_COMMAND_PLANS/);
assert.match(pluginSource, /DX service connection is not configured for this host/);
assert.match(pluginSource, /DX receipt path is available in this host/);
assert.doesNotMatch(pluginSource, /local-service proof|loaded-host proof|metadata only|scaffold/i);
assert.doesNotMatch(pluginSource, forbiddenRuntimePattern);
assert.doesNotMatch(pluginSource, forbiddenSketchMutationPattern);

const gitignoreSource = readFileSync(gitignorePath, "utf8");
assert.match(gitignoreSource, /^\/dist\//m);
assert.match(gitignoreSource, /^\/\*.sketchplugin\/$/m);
assert.match(gitignoreSource, /^\/\*.sketchplugin\.zip$/m);
assert.match(gitignoreSource, /^\/node_modules\//m);

const readmeSource = readFileSync(readmePath, "utf8");
assert.match(readmeSource, /temp-directory[\s\S]*build-output proof/i);
assert.match(readmeSource, /ignored `\.sketchplugin` bundle/i);
assert.match(readmeSource, /loaded Sketch\s+plugin smoke/i);
assert.match(readmeSource, /sketchtool run proof remains deferred/i);
assert.match(readmeSource, /local-service proof remains deferred/i);
assert.match(readmeSource, /package proof remains deferred/i);
assert.match(readmeSource, /signing[\s\S]*checksum[\s\S]*remain deferred/i);
assert.doesNotMatch(readmeSource, /release[- ]ready|marketplace[- ]ready|production[- ]ready|published|installable|notarized/i);

const boundarySource = readFileSync(boundaryPath, "utf8");
assert.match(boundarySource, /Sketch plugins/i);
assert.match(boundarySource, /must not launch local processes/i);
assert.match(boundarySource, /Sketch owns document, layer, artboard, and symbol behavior/i);

const starterGuideSource = readFileSync(starterGuidePath, "utf8");
assert.match(starterGuideSource, /https:\/\/developer\.sketch\.com\/plugins\/plugin-manifest/);
assert.match(starterGuideSource, /https:\/\/developer\.sketch\.com\/plugins\/plugin-bundle/);
assert.match(starterGuideSource, /https:\/\/developer\.sketch\.com\/cli\/run-plugin/);
assert.match(starterGuideSource, /identifier.*reverse-domain/i);
assert.match(starterGuideSource, /commands.*script.*handler/is);
assert.match(starterGuideSource, /build proof rewrites bundled command scripts to[\s\S]*`index\.js`/i);
assert.match(starterGuideSource, /local-service proof remains deferred/i);
assert.match(starterGuideSource, /plugin listing proof remains deferred/i);

const professionalTargetsSource = readFileSync(
  join(root, "registry", "professional-host-targets.toml"),
  "utf8"
);
assert.match(professionalTargetsSource, /id = "sketch\.plugins"[\s\S]*recommended_priority = "active-scaffold"/);
assert.match(professionalTargetsSource, /id = "sketch\.plugins"[\s\S]*loaded-host smoke receipt/);

console.log("Sketch adapter verified");
