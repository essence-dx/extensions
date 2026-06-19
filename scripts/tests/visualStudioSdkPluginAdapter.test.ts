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

const adapterRoot = "hosts/visual-studio/dx-visual-studio";
const dxManifestPath = `${adapterRoot}/dx.extension.toml`;
const vsixManifestPath = `${adapterRoot}/source.extension.vsixmanifest`;
const projectPath = `${adapterRoot}/Dx.VisualStudio.CommandCenter.csproj`;
const packagePath = `${adapterRoot}/src/DxVisualStudioPackage.cs`;
const commandPlansPath = `${adapterRoot}/src/CommandPlans/DxCommandPlans.cs`;
const commandIdsPath = `${adapterRoot}/src/Commands/CommandIds.cs`;
const registerCommandsPath = `${adapterRoot}/src/Commands/RegisterDxCommands.cs`;
const boundaryPath = `${adapterRoot}/src/Services/DxLocalServiceBoundary.cs`;
const receiptsPath = `${adapterRoot}/src/Receipts/ReceiptPaths.cs`;
const vsctPath = `${adapterRoot}/Resources/DxCommandCenter.vsct`;
const readmePath = `${adapterRoot}/README.md`;
const starterGuidePath = "docs/visual-studio-sdk-plugin-starter.md";

requireWorkspacePaths([
  "hosts/visual-studio/README.md",
  dxManifestPath,
  vsixManifestPath,
  projectPath,
  packagePath,
  commandPlansPath,
  commandIdsPath,
  registerCommandsPath,
  boundaryPath,
  receiptsPath,
  vsctPath,
  `${adapterRoot}/.gitignore`,
  readmePath,
  starterGuidePath
]);

assertRegistryEntry({
  id: "dx.visual-studio.command-center",
  path: adapterRoot,
  manifest: dxManifestPath,
  professionalTarget: "visual-studio.sdk"
});
assertPackageScript(
  "test:visual-studio-sdk-plugin-adapter",
  "scripts/tests/visualStudioSdkPluginAdapter.test.ts"
);
assertJ1Script("test:visual-studio-sdk-plugin-adapter");

assertDxManifest(readDxManifest(dxManifestPath), {
  id: "dx.visual-studio.command-center",
  name: "DX Visual Studio Command Center",
  hosts: ["visual-studio"],
  sandbox: "visual-studio-sdk-extension",
  network: "deny-by-default",
  capabilities: [
    "visualstudio.command",
    "visualstudio.solution.read",
    "local_service.connect",
    "receipts.read"
  ],
  hostActions: [
    "dx.visual-studio.show_status",
    "dx.visual-studio.search_assets",
    "dx.visual-studio.show_receipts"
  ],
  receiptPath:
    ".dx/receipts/extensions/dx.visual-studio.command-center/host-action-index-latest.json"
});
const dxManifestSource = readWorkspaceText(dxManifestPath);
assert.doesNotMatch(
  dxManifestSource,
  /scaffold|Experimental Instance proof|loaded-host proof|local-service proof/i
);

const vsixManifestSource = readWorkspaceText(vsixManifestPath);
assert.match(vsixManifestSource, /<Identity Id="dev\.dx\.visual-studio\.command-center"/);
assert.match(vsixManifestSource, /Version="0\.1\.0"/);
assert.match(vsixManifestSource, /Publisher="DX"/);
assert.match(vsixManifestSource, /<DisplayName>DX Visual Studio Command Center<\/DisplayName>/);
assert.match(vsixManifestSource, /<InstallationTarget Id="Microsoft\.VisualStudio\.Community"/);
assert.match(vsixManifestSource, /Version="\[17\.0,18\.0\)"/);
assert.match(vsixManifestSource, /Type="Microsoft\.VisualStudio\.VsPackage"/);
assert.doesNotMatch(vsixManifestSource, /scaffold/i);

const projectSource = readWorkspaceText(projectPath);
assert.match(projectSource, /Microsoft\.VisualStudio\.SDK/);
assert.match(projectSource, /VSSDK/);

const commandPlansSource = readWorkspaceText(commandPlansPath);
assert.match(commandPlansSource, /internal static class DxCommandPlans/);
assert.match(commandPlansSource, /Operation:\s*"dx\.status"/);
assert.match(commandPlansSource, /Operation:\s*"dx\.assets\.search"/);
assert.match(commandPlansSource, /Operation:\s*"receipt\.showPath"/);
assert.match(commandPlansSource, /Operation:\s*"dx\.status"[\s\S]*RequiresRuntimeProof:\s*true/);
assert.match(commandPlansSource, /Operation:\s*"dx\.assets\.search"[\s\S]*RequiresRuntimeProof:\s*true/);
assert.match(
  commandPlansSource,
  /Operation:\s*"receipt\.showPath"[\s\S]*Transport:\s*"host-ui"[\s\S]*RequiresRuntimeProof:\s*false/
);
assert.match(commandPlansSource, /MutatesSolution:\s*false/);

const packageSource = readWorkspaceText(packagePath);
assert.match(packageSource, /sealed class DxCommandCenterPackage/);
assert.match(packageSource, /AsyncPackage/);
assert.match(packageSource, /ProvideMenuResource\("Menus\.ctmenu",\s*1\)/);
assert.doesNotMatch(packageSource, /scaffold/i);
assert.match(readWorkspaceText(registerCommandsPath), /DxCommandPlans\.ForCommand/);
const registerCommandsSource = readWorkspaceText(registerCommandsPath);
assert.match(registerCommandsSource, /DX service connection is not configured for this host/);
assert.doesNotMatch(registerCommandsSource, /metadata only|scaffold/i);

const forbiddenRuntimePattern =
  /System\.Diagnostics\.Process|ProcessStartInfo|Process\.Start|HttpClient|WebClient|Socket|File\.Write|Directory\.CreateDirectory|IVsSolutionBuildManager|PowerShell|cmd\.exe|bash|sh -c/i;
assertSourceDoesNotMatch(commandPlansPath, forbiddenRuntimePattern);
assertSourceDoesNotMatch(packagePath, forbiddenRuntimePattern);
assertSourceDoesNotMatch(registerCommandsPath, forbiddenRuntimePattern);
assertSourceDoesNotMatch(boundaryPath, forbiddenRuntimePattern);
const boundarySource = readWorkspaceText(boundaryPath);
assert.match(boundarySource, /CreateMetadataRequest\(\s*string operation,\s*string transport,\s*bool requiresRuntimeProof\)/);
assert.match(boundarySource, /RequiresRuntimeProof:\s*requiresRuntimeProof/);
assert.doesNotMatch(boundarySource, /CreateProofGate\(|RequiresRuntimeProof:\s*true/);

const readmeSource = readWorkspaceText(readmePath);
assert.match(readmeSource, /source-level only/i);
assert.match(readmeSource, /Experimental Instance smoke/i);
assert.match(readmeSource, /local-service proof remains deferred/i);
assert.match(readmeSource, /Marketplace readiness remains deferred/i);
assert.doesNotMatch(readmeSource, /release[- ]ready|published|installable/i);

const starterGuideSource = readWorkspaceText(starterGuidePath);
assert.match(starterGuideSource, /https:\/\/learn\.microsoft\.com\/en-us\/visualstudio\/extensibility\/visual-studio-sdk/);
assert.match(starterGuideSource, /VSIX/i);
assert.match(starterGuideSource, /local-service proof remains deferred/i);

console.log("Visual Studio SDK plugin adapter verified");
