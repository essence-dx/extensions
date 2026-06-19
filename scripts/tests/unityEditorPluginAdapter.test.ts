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

interface AssemblyDefinition {
  name: string;
  includePlatforms: string[];
  references: string[];
}

const adapterRoot = "hosts/unity/dx-unity-editor";
const dxManifestPath = `${adapterRoot}/dx.extension.toml`;
const packageManifestPath = `${adapterRoot}/package.json`;
const assemblyPath = `${adapterRoot}/Editor/DX.Unity.Editor.asmdef`;
const testAssemblyPath = `${adapterRoot}/Tests/Editor/DX.Unity.Editor.Tests.asmdef`;
const menuPath = `${adapterRoot}/Editor/DxUnityMenu.cs`;
const windowPath = `${adapterRoot}/Editor/DxUnityCommandCenterWindow.cs`;
const commandPlansPath = `${adapterRoot}/Editor/DxUnityCommandPlans.cs`;
const boundaryPath = `${adapterRoot}/Editor/DxUnityLocalServiceBoundary.cs`;
const readmePath = `${adapterRoot}/README.md`;
const starterGuidePath = "docs/unity-editor-plugin-starter.md";

requireWorkspacePaths([
  "hosts/unity/README.md",
  dxManifestPath,
  packageManifestPath,
  assemblyPath,
  testAssemblyPath,
  menuPath,
  windowPath,
  commandPlansPath,
  boundaryPath,
  `${adapterRoot}/.gitignore`,
  readmePath,
  starterGuidePath
]);

assertRegistryEntry({
  id: "dx.unity-editor.command-center",
  path: adapterRoot,
  manifest: dxManifestPath,
  professionalTarget: "unity.editor-extensions"
});
assertPackageScript(
  "test:unity-editor-plugin-adapter",
  "scripts/tests/unityEditorPluginAdapter.test.ts"
);
assertJ1Script("test:unity-editor-plugin-adapter");

assertDxManifest(readDxManifest(dxManifestPath), {
  id: "dx.unity-editor.command-center",
  name: "DX Unity Editor Command Center",
  hosts: ["unity-editor"],
  sandbox: "unity-editor-extension",
  network: "deny-by-default",
  capabilities: [
    "unity.editor.menu",
    "unity.project.read",
    "local_service.connect",
    "receipts.read"
  ],
  hostActions: [
    "dx.unity-editor.show_status",
    "dx.unity-editor.search_assets",
    "dx.unity-editor.show_receipts"
  ],
  receiptPath:
    ".dx/receipts/extensions/dx.unity-editor.command-center/host-action-index-latest.json"
});
const dxManifestSource = readWorkspaceText(dxManifestPath);
assert.doesNotMatch(dxManifestSource, /scaffold|loaded-host proof|local-service proof/i);

const assemblyDefinition = readWorkspaceJson<AssemblyDefinition>(assemblyPath);
assert.equal(assemblyDefinition.name, "DX.Unity.Editor");
assert.deepEqual(assemblyDefinition.includePlatforms, ["Editor"]);
assert.deepEqual(assemblyDefinition.references, []);

const testAssemblyDefinition = readWorkspaceJson<AssemblyDefinition>(testAssemblyPath);
assert.equal(testAssemblyDefinition.name, "DX.Unity.Editor.Tests");
assert.deepEqual(testAssemblyDefinition.includePlatforms, ["Editor"]);
assert.deepEqual(testAssemblyDefinition.references, ["DX.Unity.Editor"]);

const packageManifest = readWorkspaceJson<{
  name: string;
  displayName: string;
  version: string;
  unity: string;
  scripts?: Record<string, string>;
}>(packageManifestPath);
assert.equal(packageManifest.name, "dev.dx.unity-command-center");
assert.equal(packageManifest.displayName, "DX Unity Editor Command Center");
assert.equal(packageManifest.version, "0.1.0");
assert.equal(packageManifest.unity, "2022.3");
assert.equal(packageManifest.scripts, undefined);
assert.doesNotMatch(readWorkspaceText(packageManifestPath), /scaffold/i);

const commandPlansSource = readWorkspaceText(commandPlansPath);
assert.match(commandPlansSource, /internal static class DxUnityCommandPlans/);
assert.match(commandPlansSource, /Operation:\s*"dx\.status"/);
assert.match(commandPlansSource, /Operation:\s*"dx\.assets\.search"/);
assert.match(commandPlansSource, /Operation:\s*"receipt\.showPath"/);
assert.match(commandPlansSource, /Operation:\s*"dx\.status"[\s\S]*RequiresRuntimeProof:\s*true/);
assert.match(commandPlansSource, /Operation:\s*"dx\.assets\.search"[\s\S]*RequiresRuntimeProof:\s*true/);
assert.match(
  commandPlansSource,
  /Operation:\s*"receipt\.showPath"[\s\S]*Transport:\s*"host-ui"[\s\S]*RequiresRuntimeProof:\s*false/
);
assert.match(commandPlansSource, /MutatesProject:\s*false/);

const windowSource = readWorkspaceText(windowPath);
assert.match(windowSource, /class DxUnityCommandCenterWindow : EditorWindow/);
assert.match(readWorkspaceText(menuPath), /\[MenuItem\("Window\/DX\/Command Center"\)\]/);
assert.match(windowSource, /DxUnityCommandPlans\.ForCommand/);
assert.match(windowSource, /DX service connection is not configured for this host/);
assert.doesNotMatch(windowSource, /metadata only|scaffold/i);

const forbiddenRuntimePattern =
  /System\.Diagnostics\.Process|ProcessStartInfo|Process\.Start|UnityWebRequest|HttpClient|Socket|AssetDatabase\.ImportAsset|CreateAsset|SaveAssets|File\.Write|Directory\.CreateDirectory|EditorUtility\.OpenFilePanel|PowerShell|cmd\.exe|bash|sh -c/i;
assertSourceDoesNotMatch(commandPlansPath, forbiddenRuntimePattern);
assertSourceDoesNotMatch(menuPath, forbiddenRuntimePattern);
assertSourceDoesNotMatch(windowPath, forbiddenRuntimePattern);
assertSourceDoesNotMatch(boundaryPath, forbiddenRuntimePattern);

const readmeSource = readWorkspaceText(readmePath);
assert.match(readmeSource, /source-level only/i);
assert.match(readmeSource, /test project smoke/i);
assert.match(readmeSource, /local-service proof remains deferred/i);
assert.match(readmeSource, /Asset Store readiness remains deferred/i);
assert.doesNotMatch(readmeSource, /release[- ]ready|published|installable/i);

const starterGuideSource = readWorkspaceText(starterGuidePath);
assert.match(starterGuideSource, /https:\/\/docs\.unity3d\.com\/Manual\/ExtendingTheEditor\.html/);
assert.match(starterGuideSource, /EditorWindow/i);
assert.match(starterGuideSource, /local-service proof remains deferred/i);

console.log("Unity Editor plugin adapter verified");
