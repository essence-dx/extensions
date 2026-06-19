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

interface UnrealPluginDescriptor {
  FileVersion: number;
  Version: number;
  VersionName: string;
  FriendlyName: string;
  EnabledByDefault: boolean;
  CanContainContent: boolean;
  IsBetaVersion: boolean;
  Modules: Array<{ Name: string; Type: string; LoadingPhase: string }>;
}

const adapterRoot = "hosts/unreal/dx-unreal-engine";
const dxManifestPath = `${adapterRoot}/dx.extension.toml`;
const pluginDescriptorPath = `${adapterRoot}/DXUnrealCommandCenter.uplugin`;
const buildRulesPath =
  `${adapterRoot}/Source/DXUnrealCommandCenterEditor/DXUnrealCommandCenterEditor.Build.cs`;
const commandPlansHeaderPath =
  `${adapterRoot}/Source/DXUnrealCommandCenterEditor/Public/DXUnrealCommandPlans.h`;
const commandPlansSourcePath =
  `${adapterRoot}/Source/DXUnrealCommandCenterEditor/Private/DXUnrealCommandPlans.cpp`;
const moduleSourcePath =
  `${adapterRoot}/Source/DXUnrealCommandCenterEditor/Private/DXUnrealCommandCenterEditorModule.cpp`;
const readmePath = `${adapterRoot}/README.md`;
const starterGuidePath = "docs/unreal-engine-plugin-starter.md";

requireWorkspacePaths([
  "hosts/unreal/README.md",
  dxManifestPath,
  pluginDescriptorPath,
  buildRulesPath,
  commandPlansHeaderPath,
  commandPlansSourcePath,
  moduleSourcePath,
  `${adapterRoot}/.gitignore`,
  readmePath,
  starterGuidePath
]);

assertRegistryEntry({
  id: "dx.unreal-engine.command-center",
  path: adapterRoot,
  manifest: dxManifestPath,
  professionalTarget: "unreal-engine.plugins"
});
assertPackageScript(
  "test:unreal-engine-plugin-adapter",
  "scripts/tests/unrealEnginePluginAdapter.test.ts"
);
assertJ1Script("test:unreal-engine-plugin-adapter");

assertDxManifest(readDxManifest(dxManifestPath), {
  id: "dx.unreal-engine.command-center",
  name: "DX Unreal Engine Command Center",
  hosts: ["unreal-engine"],
  sandbox: "unreal-editor-plugin",
  network: "deny-by-default",
  capabilities: [
    "unreal.editor.plugin",
    "unreal.project.read",
    "local_service.connect",
    "receipts.read"
  ],
  hostActions: [
    "dx.unreal-engine.show_status",
    "dx.unreal-engine.search_assets",
    "dx.unreal-engine.show_receipts"
  ],
  receiptPath:
    ".dx/receipts/extensions/dx.unreal-engine.command-center/host-action-index-latest.json"
});
const dxManifestSource = readWorkspaceText(dxManifestPath);
assert.doesNotMatch(dxManifestSource, /scaffold|loaded-host proof|local-service proof/i);

const descriptor = readWorkspaceJson<UnrealPluginDescriptor>(pluginDescriptorPath);
assert.equal(descriptor.FileVersion, 3);
assert.equal(descriptor.Version, 1);
assert.equal(descriptor.VersionName, "0.1.0");
assert.equal(descriptor.FriendlyName, "DX Unreal Engine Command Center");
assert.equal(descriptor.EnabledByDefault, false);
assert.equal(descriptor.CanContainContent, false);
assert.equal(descriptor.IsBetaVersion, true);
assert.deepEqual(descriptor.Modules, [
  {
    Name: "DXUnrealCommandCenterEditor",
    Type: "Editor",
    LoadingPhase: "Default"
  }
]);
assert.doesNotMatch(readWorkspaceText(pluginDescriptorPath), /scaffold/i);

const buildRulesSource = readWorkspaceText(buildRulesPath);
assert.match(buildRulesSource, /class DXUnrealCommandCenterEditor/);
assert.match(buildRulesSource, /"Core"/);
assert.match(buildRulesSource, /"CoreUObject"/);
assert.match(buildRulesSource, /"Engine"/);
assert.match(buildRulesSource, /"UnrealEd"/);
assert.match(buildRulesSource, /"ToolMenus"/);
assert.match(buildRulesSource, /"Slate"/);
assert.match(buildRulesSource, /"SlateCore"/);
assert.doesNotMatch(buildRulesSource, /HTTP|Sockets|Networking|AssetTools/i);

const commandPlansSource = readWorkspaceText(commandPlansHeaderPath) +
  readWorkspaceText(commandPlansSourcePath);
assert.match(commandPlansSource, /FDXUnrealCommandPlan/);
assert.match(commandPlansSource, /FindCommand\(FName CommandId\)/);
assert.match(commandPlansSource, /TEXT\("dx\.status"\)/);
assert.match(commandPlansSource, /TEXT\("dx\.assets\.search"\)/);
assert.match(commandPlansSource, /TEXT\("receipt\.showPath"\)/);
assert.match(commandPlansSource, /bRequiresRuntimeProof = true/);
assert.match(commandPlansSource, /bMutatesProject = false/);
assert.match(commandPlansSource, /return nullptr;/);
assert.doesNotMatch(commandPlansSource, /return ShowReceiptsPlan;\s*\}/);

const moduleSource = readWorkspaceText(moduleSourcePath);
assert.match(moduleSource, /class FDXUnrealCommandCenterEditorModule/);
assert.match(moduleSource, /UToolMenus/);
assert.match(moduleSource, /Plan == nullptr/);
assert.match(moduleSource, /host-action-index-latest\.json/);
assert.match(moduleSource, /DX service connection is not configured for this host/);
assert.doesNotMatch(moduleSource, /metadata only|scaffold/i);

const forbiddenRuntimePattern =
  /FPlatformProcess|CreateProc|Exec\(|system\(|FHttpModule|FSocket|ISocketSubsystem|IFileManager::Delete|SavePackage|ImportAssets|AssetTools|PythonScript|PowerShell|cmd\.exe|bash|sh -c/i;
assertSourceDoesNotMatch(buildRulesPath, forbiddenRuntimePattern);
assertSourceDoesNotMatch(commandPlansHeaderPath, forbiddenRuntimePattern);
assertSourceDoesNotMatch(commandPlansSourcePath, forbiddenRuntimePattern);
assertSourceDoesNotMatch(moduleSourcePath, forbiddenRuntimePattern);

const readmeSource = readWorkspaceText(readmePath);
assert.match(readmeSource, /source-level only/i);
assert.match(readmeSource, /sample-project smoke/i);
assert.match(readmeSource, /local-service proof remains deferred/i);
assert.match(readmeSource, /Fab\/Marketplace readiness remains deferred/i);
assert.doesNotMatch(readmeSource, /release[- ]ready|published|installable/i);

const starterGuideSource = readWorkspaceText(starterGuidePath);
assert.match(starterGuideSource, /https:\/\/dev\.epicgames\.com\/documentation\/en-us\/unreal-engine\/plugins-in-unreal-engine/);
assert.match(starterGuideSource, /editor-only module/i);
assert.match(starterGuideSource, /local-service proof remains deferred/i);

console.log("Unreal Engine plugin adapter verified");
