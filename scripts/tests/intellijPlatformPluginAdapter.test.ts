import assert from "node:assert/strict";

import {
  assertDxManifest,
  assertJ1Script,
  assertPackageScript,
  assertRegistryEntry,
  assertSourceDoesNotMatch,
  readDxManifest,
  readWorkspaceText,
  requireWorkspacePaths
} from "./hostPluginScaffoldAssertions.ts";

const adapterRoot = "hosts/jetbrains/dx-intellij-platform";
const dxManifestPath = `${adapterRoot}/dx.extension.toml`;
const pluginXmlPath = `${adapterRoot}/src/main/resources/META-INF/plugin.xml`;
const commandPlansPath = `${adapterRoot}/src/main/kotlin/dev/dx/intellij/commands/DxCommandPlans.kt`;
const actionPath = `${adapterRoot}/src/main/kotlin/dev/dx/intellij/actions/DxCommandCenterAction.kt`;
const readmePath = `${adapterRoot}/README.md`;
const starterGuidePath = "docs/intellij-platform-plugin-starter.md";

requireWorkspacePaths([
  "hosts/jetbrains/README.md",
  dxManifestPath,
  `${adapterRoot}/settings.gradle.kts`,
  `${adapterRoot}/build.gradle.kts`,
  `${adapterRoot}/gradle.properties`,
  pluginXmlPath,
  `${adapterRoot}/src/main/resources/icons/dx.svg`,
  commandPlansPath,
  actionPath,
  `${adapterRoot}/.gitignore`,
  readmePath,
  starterGuidePath
]);

assertRegistryEntry({
  id: "dx.intellij-platform.command-center",
  path: adapterRoot,
  manifest: dxManifestPath,
  professionalTarget: "jetbrains.intellij-platform"
});
assertPackageScript(
  "test:intellij-platform-plugin-adapter",
  "scripts/tests/intellijPlatformPluginAdapter.test.ts"
);
assertJ1Script("test:intellij-platform-plugin-adapter");

assertDxManifest(readDxManifest(dxManifestPath), {
  id: "dx.intellij-platform.command-center",
  name: "DX IntelliJ Platform Command Center",
  hosts: ["intellij-platform"],
  sandbox: "intellij-platform-plugin",
  network: "deny-by-default",
  capabilities: [
    "jetbrains.intellij.action",
    "jetbrains.project.read",
    "local_service.connect",
    "receipts.read"
  ],
  hostActions: [
    "dx.intellij-platform.show_status",
    "dx.intellij-platform.search_assets",
    "dx.intellij-platform.show_receipts"
  ],
  receiptPath:
    ".dx/receipts/extensions/dx.intellij-platform.command-center/host-action-index-latest.json"
});
const dxManifestSource = readWorkspaceText(dxManifestPath);
assert.doesNotMatch(dxManifestSource, /scaffold|sandbox IDE proof|loaded-host proof|local-service proof/i);

const pluginXmlSource = readWorkspaceText(pluginXmlPath);
assert.match(pluginXmlSource, /<id>dev\.dx\.intellij-platform\.command-center<\/id>/);
assert.match(pluginXmlSource, /<name>DX IntelliJ Platform Command Center<\/name>/);
assert.match(pluginXmlSource, /<vendor email="support@dx\.dev">DX<\/vendor>/);
assert.match(pluginXmlSource, /<depends>com\.intellij\.modules\.platform<\/depends>/);
assert.match(pluginXmlSource, /class="dev\.dx\.intellij\.actions\.DxCommandCenterAction"/);
assert.match(pluginXmlSource, /id="dev\.dx\.intellij\.showStatus"/);
assert.match(pluginXmlSource, /id="dev\.dx\.intellij\.searchAssets"/);
assert.match(pluginXmlSource, /id="dev\.dx\.intellij\.showReceipts"/);
assert.match(pluginXmlSource, /factoryClass="dev\.dx\.intellij\.toolwindow\.DxToolWindowFactory"/);
assert.match(pluginXmlSource, /serviceImplementation="dev\.dx\.intellij\.services\.DxCommandPlanService"/);
assert.doesNotMatch(pluginXmlSource, /localInspection|globalInspection/i);
assert.doesNotMatch(pluginXmlSource, /scaffold/i);

const commandPlansSource = readWorkspaceText(commandPlansPath);
assert.match(commandPlansSource, /object DxCommandPlans/);
assert.match(commandPlansSource, /operation = "dx\.status"/);
assert.match(commandPlansSource, /operation = "dx\.assets\.search"/);
assert.match(commandPlansSource, /operation = "receipt\.showPath"/);
assert.match(commandPlansSource, /operation = "dx\.status"[\s\S]*requiresRuntimeProof = true/);
assert.match(commandPlansSource, /operation = "dx\.assets\.search"[\s\S]*requiresRuntimeProof = true/);
assert.match(
  commandPlansSource,
  /operation = "receipt\.showPath"[\s\S]*transport = "host-ui"[\s\S]*requiresRuntimeProof = false/
);
assert.match(commandPlansSource, /mutatesProject = false/);

const actionSource = readWorkspaceText(actionPath);
assert.match(actionSource, /class DxCommandCenterAction/);
assert.match(actionSource, /:\s*AnAction\(\)/);
assert.match(actionSource, /DxCommandPlanService/);
assert.match(actionSource, /DX service connection is not configured for this host/);
assert.doesNotMatch(actionSource, /metadata only|scaffold/i);

const forbiddenRuntimePattern =
  /ProcessBuilder|Runtime\.getRuntime|java\.net|HttpClient|Socket|Files\.write|FileOutputStream|LocalFileSystem|VirtualFileManager|runWriteAction|PowerShell|cmd\.exe|bash|sh -c/i;
assertSourceDoesNotMatch(commandPlansPath, forbiddenRuntimePattern);
assertSourceDoesNotMatch(actionPath, forbiddenRuntimePattern);

const readmeSource = readWorkspaceText(readmePath);
assert.match(readmeSource, /source-level only/i);
assert.match(readmeSource, /sandbox IDE smoke/i);
assert.match(readmeSource, /local-service proof remains deferred/i);
assert.match(readmeSource, /Marketplace readiness remains deferred/i);
assert.doesNotMatch(readmeSource, /release[- ]ready|published|installable/i);

const starterGuideSource = readWorkspaceText(starterGuidePath);
assert.match(starterGuideSource, /https:\/\/plugins\.jetbrains\.com\/docs\/intellij\/welcome\.html/);
assert.match(starterGuideSource, /sandbox IDE/i);
assert.match(starterGuideSource, /local-service proof remains deferred/i);

console.log("IntelliJ Platform plugin adapter verified");
