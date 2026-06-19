import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parseTomlDocument } from "../lib/toml-lite.ts";

const root = process.cwd();
const adobeBoundaryPath = join(root, "hosts", "adobe", "README.md");
const adapterRoot = join(root, "hosts", "adobe", "dx-premiere-pro-uxp");
const dxManifestPath = join(adapterRoot, "dx.extension.toml");
const uxpManifestPath = join(adapterRoot, "manifest.json");
const messagesPath = join(adapterRoot, "src", "messages.ts");
const commandPlansPath = join(adapterRoot, "src", "commandPlans.ts");
const pluginPath = join(adapterRoot, "src", "index.ts");
const indexPath = join(adapterRoot, "index.html");
const gitignorePath = join(adapterRoot, ".gitignore");
const readmePath = join(adapterRoot, "README.md");
const starterGuidePath = join(root, "docs", "premiere-pro-uxp-plugin-starter.md");
const forbiddenRuntimePattern =
  /fetch\(|XMLHttpRequest|WebSocket|EventSource|require\(["']uxp["']\)\.shell|child_process|spawn\(|exec\(|execFile\(|PowerShell|powershell\.exe|cmd\.exe|bash|sh -c|shell|localhost|127\.0\.0\.1|0\.0\.0\.0|http:\/\/|https:\/\/|ws:\/\/|wss:\/\//i;
const forbiddenPremiereMutationPattern =
  /require\(["']premierepro["']\)|\bapp\.project\b|ProjectItem|TrackItem|Sequence|createSequence|deleteSequence|importFiles|importAEComps|createBin|deleteBin|setSelected|overwriteClip|insertClip|setInPoint|setOutPoint|addMarker|deleteMarker|export|encoder|render|transcode|hybrid|native|require\(["'][^"']+\.node["']\)|addon/i;

for (const path of [
  adobeBoundaryPath,
  dxManifestPath,
  uxpManifestPath,
  messagesPath,
  commandPlansPath,
  pluginPath,
  indexPath,
  gitignorePath,
  readmePath,
  starterGuidePath
]) {
  assert.equal(existsSync(path), true, `${path} should exist`);
}

const registrySource = readFileSync(join(root, "registry", "official-extensions.toml"), "utf8");
assert.match(registrySource, /id = "dx\.premiere-pro\.command-center"/);
assert.match(registrySource, /path = "hosts\/adobe\/dx-premiere-pro-uxp"/);
assert.match(registrySource, /manifest = "hosts\/adobe\/dx-premiere-pro-uxp\/dx\.extension\.toml"/);
assert.match(registrySource, /status = "experimental"/);

const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
assert.equal(
  packageJson.scripts["test:premiere-pro-adapter"],
  "node --experimental-strip-types scripts/tests/premiereProAdapter.test.ts"
);
assert.equal(
  (packageJson.workspaces ?? []).includes("hosts/adobe/dx-premiere-pro-uxp"),
  false,
  "Premiere Pro adapter must stay a root-tested source adapter, not an npm workspace"
);
assert.equal(
  existsSync(join(adapterRoot, "package.json")),
  false,
  "Premiere Pro source adapter must not add package metadata or lockfile churn"
);

const testJ1Source = readFileSync(join(root, "scripts", "test-j1.ps1"), "utf8");
assert.match(testJ1Source, /Invoke-DxCommand "npm" @\("run", "test:premiere-pro-adapter"\)/);

const dxManifestSource = readFileSync(dxManifestPath, "utf8");
const dxManifest = parseTomlDocument(dxManifestSource);
assert.doesNotMatch(dxManifestSource, /scaffold|loaded-host proof|local-service proof/i);
assert.equal(dxManifest.sections.extension.id, "dx.premiere-pro.command-center");
assert.equal(dxManifest.sections.extension.name, "DX Premiere Pro Command Center");
assert.equal(dxManifest.sections.extension.official, true);
assert.deepEqual(dxManifest.sections.compatibility.hosts, ["premiere-pro"]);
assert.equal(dxManifest.sections.entrypoint.transport, "http");
assert.equal(dxManifest.sections.entrypoint.command, "dx-local-service");
assert.deepEqual(dxManifest.sections.entrypoint.args, []);
assert.equal(dxManifest.sections.security.signature, "development-unsigned");
assert.equal(dxManifest.sections.security.sandbox, "adobe-uxp-plugin");
assert.equal(dxManifest.sections.security.network, "deny-by-default");
assert.equal(dxManifest.sections.security.stores_payloads, false);
assert.equal(dxManifest.sections.security.stores_process_output, false);

const capabilityIds = (dxManifest.arrays.capabilities ?? []).map((capability) => capability.id);
assert.deepEqual(capabilityIds, [
  "adobe.uxp.panel",
  "adobe.premiere.project.read",
  "local_service.connect",
  "receipts.read"
]);
assert.equal(capabilityIds.includes("process.spawn"), false);
assert.equal(capabilityIds.includes("process.exec"), false);
assert.equal(capabilityIds.includes("filesystem.write"), false);
assert.equal(capabilityIds.includes("adobe.premiere.project.write"), false);

const hostActions = dxManifest.arrays.host_actions ?? [];
assert.deepEqual(hostActions.map((action) => action.id), [
  "dx.premiere-pro.show_status",
  "dx.premiere-pro.search_media_assets",
  "dx.premiere-pro.show_receipts"
]);
assert.ok(hostActions.every((action) => action.transport !== "process"));
assert.ok(hostActions.every((action) => action.writes_receipts === false));

const receipt = dxManifest.arrays.receipts?.[0];
assert.equal(
  receipt.latest_path,
  ".dx/receipts/extensions/dx.premiere-pro.command-center/host-action-index-latest.json"
);
assert.equal(receipt.metadata_only, true);

const uxpManifest = JSON.parse(readFileSync(uxpManifestPath, "utf8"));
assert.equal(uxpManifest.manifestVersion, 5);
assert.equal(uxpManifest.id, "dx.premiere-pro.command-center.development");
assert.equal(uxpManifest.name, "DX Command Center");
assert.equal(uxpManifest.version, "0.1.0");
assert.equal(uxpManifest.main, "index.html");
assert.deepEqual(uxpManifest.host, { app: "premierepro", minVersion: "25.6.0" });
assert.deepEqual(
  uxpManifest.entrypoints.map((entrypoint) => [entrypoint.type, entrypoint.id]),
  [
    ["panel", "dxCommandCenterPanel"],
    ["command", "dxShowStatus"],
    ["command", "dxShowReceipts"]
  ]
);
assert.deepEqual(uxpManifest.requiredPermissions ?? {}, {});
assert.equal(uxpManifest.requiredPermissions?.network, undefined);
assert.equal(uxpManifest.requiredPermissions?.launchProcess, undefined);
assert.equal(uxpManifest.requiredPermissions?.localFileSystem, undefined);
assert.equal(uxpManifest.requiredPermissions?.clipboard, undefined);
assert.equal(uxpManifest.requiredPermissions?.webview, undefined);
assert.equal(uxpManifest.addon, undefined);

const forbiddenManifestText = JSON.stringify(uxpManifest);
assert.doesNotMatch(forbiddenManifestText, /localhost|127\.0\.0\.1|0\.0\.0\.0|"\*"|"all"/i);
assert.doesNotMatch(forbiddenManifestText, /launchProcess|openExternal|openPath|localFileSystem|webview|clipboard|enableUserInfo|ipc|native/i);

const messagesSource = readFileSync(messagesPath, "utf8");
assert.match(messagesSource, /DX_PREMIERE_MESSAGES[\s\S]*showStatus:\s*"dx\.premiere-pro\.show_status"/);
assert.match(messagesSource, /searchMediaAssets:\s*"dx\.premiere-pro\.search_media_assets"/);
assert.match(messagesSource, /showReceipts:\s*"dx\.premiere-pro\.show_receipts"/);
assert.match(messagesSource, /DX_PREMIERE_ENTRYPOINTS[\s\S]*panel:\s*"dxCommandCenterPanel"/);
assert.match(messagesSource, /messageTypeForEntrypoint/);

const commandPlansSource = readFileSync(commandPlansPath, "utf8");
assert.match(commandPlansSource, /operation:\s*"dx\.status"/);
assert.match(commandPlansSource, /operation:\s*"dx\.media\.search"/);
assert.match(commandPlansSource, /operation:\s*"receipt\.showPath"/);
assert.match(commandPlansSource, /requiresRuntimeProof:\s*true/);
assert.match(commandPlansSource, /showStatus:[\s\S]*?transport:\s*"local-service"[\s\S]*?requiresRuntimeProof:\s*true/);
assert.match(commandPlansSource, /searchMediaAssets:[\s\S]*?transport:\s*"local-service"[\s\S]*?requiresRuntimeProof:\s*true/);
assert.match(commandPlansSource, /showReceipts:[\s\S]*?transport:\s*"host-ui"[\s\S]*?requiresRuntimeProof:\s*false/);
assert.match(commandPlansSource, /showReceipts:[\s\S]*?requiresLoadedHostProof:\s*true/);
assert.match(commandPlansSource, /mutatesPremiereProject:\s*false/);
assert.doesNotMatch(commandPlansSource, forbiddenRuntimePattern);

const pluginSource = readFileSync(pluginPath, "utf8");
assert.match(pluginSource, /entrypoints\.setup/);
assert.match(pluginSource, /dxShowStatus/);
assert.match(pluginSource, /dxShowReceipts/);
assert.match(pluginSource, /DX_PREMIERE_COMMAND_PLANS/);
assert.match(pluginSource, /DX service connection is not configured for this host/);
assert.match(pluginSource, /DX receipt path is available in this host/);
assert.match(pluginSource, /requiresRuntimeProof/);
assert.match(pluginSource, /requiresLoadedHostProof/);
assert.doesNotMatch(pluginSource, /local-service proof|loaded-host proof|No DX proof|metadata only|scaffold/i);
assert.doesNotMatch(pluginSource, forbiddenRuntimePattern);
assert.doesNotMatch(pluginSource, forbiddenPremiereMutationPattern);

const indexSource = readFileSync(indexPath, "utf8");
assert.match(indexSource, /src\/messages\.ts/);
assert.match(indexSource, /src\/commandPlans\.ts/);
assert.match(indexSource, /src\/index\.ts/);
assert.match(indexSource, /data-command="dx\.premiere-pro\.show_status"/);
assert.match(indexSource, /data-command="dx\.premiere-pro\.search_media_assets"/);
assert.match(indexSource, /data-command="dx\.premiere-pro\.show_receipts"/);
assert.doesNotMatch(indexSource, /fetch\(|XMLHttpRequest|webview|iframe/i);

const gitignoreSource = readFileSync(gitignorePath, "utf8");
assert.match(gitignoreSource, /^\/dist\//m);
assert.match(gitignoreSource, /^\/\.uxp-dev-tool\//m);
assert.match(gitignoreSource, /^\/\*.ccx$/m);

const readmeSource = readFileSync(readmePath, "utf8");
assert.match(readmeSource, /package-layout\s+build proof/i);
assert.match(readmeSource, /generated `index\.js`/i);
assert.match(readmeSource, /loaded Premiere Pro\s+UXP smoke/i);
assert.match(readmeSource, /local-service proof remains deferred/i);
assert.match(readmeSource, /hybrid plugin proof remains deferred/i);
assert.match(readmeSource, /signing[\s\S]*checksum[\s\S]*remain deferred/i);
assert.doesNotMatch(readmeSource, /release[- ]ready|marketplace[- ]ready|production[- ]ready|Creative Cloud approved|published|installable/i);

const adobeBoundarySource = readFileSync(adobeBoundaryPath, "utf8");
assert.match(adobeBoundarySource, /Adobe UXP plugins/i);
assert.match(adobeBoundarySource, /must not launch\s+local processes/i);
assert.match(adobeBoundarySource, /Premiere Pro owns timeline and project\s+behavior/i);

const starterGuideSource = readFileSync(starterGuidePath, "utf8");
assert.match(starterGuideSource, /https:\/\/developer\.adobe\.com\/premiere-pro\/uxp\/plugins\//);
assert.match(starterGuideSource, /https:\/\/developer\.adobe\.com\/premiere-pro\/uxp\/plugins\/concepts\/manifest\//);
assert.match(starterGuideSource, /https:\/\/developer\.adobe\.com\/premiere-pro\/uxp\/plugins\/concepts\/entrypoints\//);
assert.match(starterGuideSource, /host\.app.*premierepro/i);
assert.match(starterGuideSource, /minVersion.*25\.6\.0/i);
assert.match(starterGuideSource, /local-service proof remains deferred/i);
assert.match(starterGuideSource, /Creative\s+Cloud distribution\s+remains deferred/i);

const professionalTargetsSource = readFileSync(
  join(root, "registry", "professional-host-targets.toml"),
  "utf8"
);
assert.match(professionalTargetsSource, /id = "adobe\.premiere-pro\.uxp"[\s\S]*recommended_priority = "active-scaffold"/);
assert.match(professionalTargetsSource, /id = "adobe\.premiere-pro\.uxp"[\s\S]*loaded-host smoke receipt/);

console.log("Premiere Pro adapter verified");
