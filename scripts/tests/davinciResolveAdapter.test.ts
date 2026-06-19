import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parseTomlDocument } from "../lib/toml-lite.ts";

const root = process.cwd();
const blackmagicBoundaryPath = join(root, "hosts", "blackmagic", "README.md");
const adapterRoot = join(root, "hosts", "blackmagic", "dx-davinci-resolve");
const dxManifestPath = join(adapterRoot, "dx.extension.toml");
const commandPlansPath = join(adapterRoot, "command-plans.json");
const pythonScriptPath = join(adapterRoot, "scripts", "dx_command_center.py");
const luaScriptPath = join(adapterRoot, "scripts", "dx_command_center.lua");
const gitignorePath = join(adapterRoot, ".gitignore");
const readmePath = join(adapterRoot, "README.md");
const starterGuidePath = join(root, "docs", "davinci-resolve-scripting-starter.md");

for (const path of [
  blackmagicBoundaryPath,
  dxManifestPath,
  commandPlansPath,
  pythonScriptPath,
  luaScriptPath,
  gitignorePath,
  readmePath,
  starterGuidePath
]) {
  assert.equal(existsSync(path), true, `${path} should exist`);
}

const registrySource = readFileSync(join(root, "registry", "official-extensions.toml"), "utf8");
assert.match(registrySource, /id = "dx\.davinci-resolve\.command-center"/);
assert.match(registrySource, /path = "hosts\/blackmagic\/dx-davinci-resolve"/);
assert.match(registrySource, /manifest = "hosts\/blackmagic\/dx-davinci-resolve\/dx\.extension\.toml"/);
assert.match(registrySource, /status = "experimental"/);

const packageSource = readFileSync(join(root, "package.json"), "utf8");
assert.match(packageSource, /"test:davinci-resolve-adapter": "node --experimental-strip-types scripts\/tests\/davinciResolveAdapter\.test\.ts"/);
const packageJson = JSON.parse(packageSource);
assert.equal(packageJson.workspaces.includes("hosts/blackmagic/dx-davinci-resolve"), false);
assert.equal(existsSync(join(adapterRoot, "package.json")), false);

const testJ1Source = readFileSync(join(root, "scripts", "test-j1.ps1"), "utf8");
assert.match(testJ1Source, /Invoke-DxCommand "npm" @\("run", "test:davinci-resolve-adapter"\)/);

const dxManifestSource = readFileSync(dxManifestPath, "utf8");
const dxManifest = parseTomlDocument(dxManifestSource);
assert.doesNotMatch(dxManifestSource, /scaffold|loaded-host proof|local-service proof/i);
assert.equal(dxManifest.sections.extension.id, "dx.davinci-resolve.command-center");
assert.equal(dxManifest.sections.extension.name, "DX DaVinci Resolve Command Center");
assert.equal(dxManifest.sections.extension.official, true);
assert.deepEqual(dxManifest.sections.compatibility.hosts, ["davinci-resolve"]);
assert.equal(dxManifest.sections.entrypoint.transport, "host_script");
assert.equal(dxManifest.sections.entrypoint.command, "resolve-scripting");
assert.notEqual(dxManifest.sections.entrypoint.transport, "http");
assert.notEqual(dxManifest.sections.entrypoint.transport, "native_messaging");
assert.notEqual(dxManifest.sections.entrypoint.transport, "named_pipe");
assert.deepEqual(dxManifest.sections.entrypoint.args, []);
assert.equal(dxManifest.sections.security.signature, "development-unsigned");
assert.equal(dxManifest.sections.security.sandbox, "resolve-scripting");
assert.equal(dxManifest.sections.security.network, "deny-by-default");
assert.equal(dxManifest.sections.security.stores_payloads, false);
assert.equal(dxManifest.sections.security.stores_process_output, false);

const capabilityIds = (dxManifest.arrays.capabilities ?? []).map((capability) => capability.id);
assert.deepEqual(capabilityIds, [
  "blackmagic.resolve.scripts",
  "blackmagic.resolve.project.read",
  "receipts.read"
]);
assert.equal(capabilityIds.includes("process.spawn"), false);
assert.equal(capabilityIds.includes("process.exec"), false);
assert.equal(capabilityIds.includes("filesystem.write"), false);
assert.equal(capabilityIds.includes("resolve.project.write"), false);
assert.equal(capabilityIds.includes("local_service.connect"), false);

const hostActions = dxManifest.arrays.host_actions ?? [];
assert.deepEqual(hostActions.map((action) => action.id), [
  "dx.davinci-resolve.show_status",
  "dx.davinci-resolve.inspect_project",
  "dx.davinci-resolve.show_receipts"
]);
assert.ok(hostActions.every((action) => action.transport !== "process"));
assert.ok(hostActions.every((action) => action.writes_receipts === false));

const receipt = dxManifest.arrays.receipts?.[0];
assert.equal(
  receipt.latest_path,
  ".dx/receipts/extensions/dx.davinci-resolve.command-center/host-action-index-latest.json"
);
assert.equal(receipt.metadata_only, true);

const commandPlans = JSON.parse(readFileSync(commandPlansPath, "utf8"));
assert.deepEqual(
  commandPlans.commands.map((command) => command.id),
  [
    "dx.davinci-resolve.show_status",
    "dx.davinci-resolve.inspect_project",
    "dx.davinci-resolve.show_receipts"
  ]
);
assert.deepEqual(
  commandPlans.commands.map((command) => command.operation),
  ["dx.status", "resolve.project.inspect", "receipt.showPath"]
);
assert.ok(
  commandPlans.commands
    .filter((command) => command.transport === "resolve-script")
    .every((command) => command.requiresRuntimeProof === true)
);
assert.equal(
  commandPlans.commands.find((command) => command.operation === "receipt.showPath")
    ?.requiresRuntimeProof,
  false
);
assert.ok(commandPlans.commands.every((command) => command.mutatesResolveProject === false));
assert.ok(commandPlans.commands.every((command) => command.transport !== "process"));

const forbiddenResolveRootsPattern =
  /\b(?:DaVinciResolveScript|bmd\.scriptapp|scriptapp\s*\(|BlackmagicFusion|fusionscript|FusionScript|GetResolve|GetProjectManager|GetCurrentProject|GetMediaPool|GetCurrentTimeline|RESOLVE_SCRIPT_API|RESOLVE_SCRIPT_LIB|LUA_PATH|LUA_CPATH|PYTHONPATH)\b/i;
const forbiddenRuntimePattern =
  /\b(?:StartRendering|StopRendering|IsRenderingInProgress|AddRenderJob|DeleteRenderJob|DeleteAllRenderJobs|SetRenderSettings|LoadRenderPreset|SaveAsNewRenderPreset|DeleteRenderPreset|ImportRenderPreset|ExportRenderPreset|RenderWithQuickExport|QuickExport|Render|CreateProject|DeleteProject|LoadProject|CloseProject|SaveProject|SaveProjectAs|ArchiveProject|RestoreProject|ImportProject|ExportProject|SetCurrentProject|CreateFolder|DeleteFolder|SetProjectSetting|SetSetting|SetName|SetPreset|ImportBurnInPreset|ExportBurnInPreset|ImportMedia|AddItemListToMediaPool|AddSubFolder|DeleteFolders|DeleteClips|MoveClips|MoveFolders|SetCurrentFolder|RefreshFolders|RelinkClips|UnlinkClips|LinkProxyMedia|UnlinkProxyMedia|ReplaceClip|TranscribeAudio|ClearTranscription|SetMetadata|SetClipProperty|SetClipColor|ClearClipColor|UpdateSidecar|SetCurrentTimeline|CreateTimeline|CreateEmptyTimeline|CreateTimelineFromClips|DeleteTimeline|DeleteTimelines|DuplicateTimeline|ImportTimelineFromFile|ImportIntoTimeline|AppendToTimeline|Insert(?:Fusion)?(?:Title|Generator|Composition|OFXGenerator)?IntoTimeline|AddTrack|DeleteTrack|SetTrack|AddMarker|UpdateMarkerCustomData|DeleteMarker|DeleteMarkersByColor|SetMarkInOut|ClearMarkInOut|SetStartTimecode|SetCurrentTimecode|SetClipsLinked|InsertAudioToCurrentTrackAtPlayhead|GrabStill|ApplyGradeFromDRX|ResetAllGrades|SetNodeCacheMode|SetLUT|SetCDL|SetProperty|Export|Transcribe|Generate|Analyze)\b/i;
const forbiddenBridgePattern =
  /\b(?:fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|socket|requests|urllib|http\.client|aiohttp|asyncio\.open_connection|localhost|127\.0\.0\.1|0\.0\.0\.0|::1|http:\/\/|https:\/\/|ws:\/\/|wss:\/\/|named_pipe|native_messaging|stdio_json_rpc|local_service\.connect|Workflow Integration enabled|subprocess|os\.system|os\.popen|os\.spawn|child_process|spawn\s*\(|exec\s*\(|execFile\s*\(|Command::new|std::process|PowerShell|powershell\.exe|cmd\.exe|bash|sh\s+-c|shell\s*=\s*True|shell:\s*true|Start[-]Process|resolve\.exe|DaVinci Resolve\.exe|Resolve\.app|--nogui|-nogui)\b/i;
const forbiddenFilePattern = /open\(|Path\(|shutil|tempfile|io\.open|dofile|loadfile|require\(["']socket["']\)|os\.execute/i;

const pythonSource = readFileSync(pythonScriptPath, "utf8");
assert.match(pythonSource, /DX_DAVINCI_RESOLVE_COMMAND_PLANS/);
assert.match(pythonSource, /"operation": "dx\.status"/);
assert.match(pythonSource, /"operation": "resolve\.project\.inspect"/);
assert.match(pythonSource, /"operation": "receipt\.showPath"/);
assert.match(pythonSource, /"requires_runtime_proof": True/);
assert.match(pythonSource, /"operation": "receipt\.showPath"[\s\S]*"requires_runtime_proof": False/);
assert.match(pythonSource, /"mutates_resolve_project": False/);
assert.match(pythonSource, /DX service connection is not configured for this host/);
assert.match(pythonSource, /DX receipt path is available in this host/);
assert.doesNotMatch(pythonSource, /local-service proof|loaded-host proof|host UI metadata|metadata only|scaffold/i);
assert.doesNotMatch(pythonSource, forbiddenResolveRootsPattern);
assert.doesNotMatch(pythonSource, forbiddenRuntimePattern);
assert.doesNotMatch(pythonSource, forbiddenBridgePattern);
assert.doesNotMatch(pythonSource, forbiddenFilePattern);

const luaSource = readFileSync(luaScriptPath, "utf8");
assert.match(luaSource, /DX_DAVINCI_RESOLVE_COMMAND_PLANS/);
assert.match(luaSource, /operation = "dx\.status"/);
assert.match(luaSource, /operation = "resolve\.project\.inspect"/);
assert.match(luaSource, /operation = "receipt\.showPath"/);
assert.match(luaSource, /requires_runtime_proof = true/);
assert.match(luaSource, /operation = "receipt\.showPath"[\s\S]*requires_runtime_proof = false/);
assert.match(luaSource, /mutates_resolve_project = false/);
assert.match(luaSource, /DX service connection is not configured for this host/);
assert.match(luaSource, /DX receipt path is available in this host/);
assert.doesNotMatch(luaSource, /local-service proof|loaded-host proof|host UI metadata|metadata only|scaffold/i);
assert.doesNotMatch(luaSource, forbiddenResolveRootsPattern);
assert.doesNotMatch(luaSource, forbiddenRuntimePattern);
assert.doesNotMatch(luaSource, forbiddenBridgePattern);
assert.doesNotMatch(luaSource, forbiddenFilePattern);

const gitignoreSource = readFileSync(gitignorePath, "utf8");
assert.match(gitignoreSource, /^\/dist\//m);
assert.match(gitignoreSource, /^\/receipts\//m);
assert.match(gitignoreSource, /^\/\.resolve-local\//m);

const readmeSource = readFileSync(readmePath, "utf8");
assert.match(readmeSource, /source-level only/i);
assert.match(readmeSource, /loaded DaVinci Resolve smoke/i);
assert.match(readmeSource, /local-service proof remains deferred/i);
assert.match(readmeSource, /signing[\s\S]*checksum[\s\S]*remain deferred/i);
assert.doesNotMatch(readmeSource, /release[- ]ready|marketplace[- ]ready|production[- ]ready|installed|published|Workflow Integration enabled/i);

const boundarySource = readFileSync(blackmagicBoundaryPath, "utf8");
assert.match(boundarySource, /DaVinci Resolve scripting/i);
assert.match(boundarySource, /must not render projects/i);
assert.match(boundarySource, /must not mutate timelines/i);
assert.match(boundarySource, /must not open local network scripting/i);

const starterGuideSource = readFileSync(starterGuidePath, "utf8");
assert.match(starterGuideSource, /https:\/\/www\.blackmagicdesign\.com\/products\/davinciresolve\/fusion/);
assert.match(starterGuideSource, /https:\/\/www\.blackmagicdesign\.com\/support/);
assert.match(starterGuideSource, /Python and Lua/i);
assert.match(starterGuideSource, /bundled Developer documentation/i);
assert.match(starterGuideSource, /local-service proof remains deferred/i);
assert.match(starterGuideSource, /Workflow Integration proof remains deferred/i);

console.log("DaVinci Resolve adapter verified");
