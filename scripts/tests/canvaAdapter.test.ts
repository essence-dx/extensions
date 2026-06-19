import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parseTomlDocument } from "../lib/toml-lite.ts";

const root = process.cwd();
const boundaryPath = join(root, "hosts", "canva", "README.md");
const adapterRoot = join(root, "hosts", "canva", "dx-canva");
const dxManifestPath = join(adapterRoot, "dx.extension.toml");
const canvaConfigPath = join(adapterRoot, "canva-app.json");
const messagesPath = join(adapterRoot, "src", "messages.ts");
const commandPlansPath = join(adapterRoot, "src", "commandPlans.ts");
const appPath = join(adapterRoot, "src", "app.tsx");
const gitignorePath = join(adapterRoot, ".gitignore");
const readmePath = join(adapterRoot, "README.md");
const starterGuidePath = join(root, "docs", "canva-app-starter.md");

const forbiddenRuntimePattern =
  /fetch\(|XMLHttpRequest|WebSocket|EventSource|window\.open|requestOpenExternalUrl|localhost|127\.0\.0\.1|0\.0\.0\.0|http:\/\/|ws:\/\/|wss:\/\/|child_process|spawn\(|exec\(|execFile\(|PowerShell|powershell\.exe|cmd\.exe|bash|sh -c|shell/i;
const forbiddenDesignMutationPattern =
  /addElementAtCursor|addElementAtPoint|addNativeElement|addPage|upload\(|getTemporaryUrl|requestExport|selection\.registerOnChange|initAppElement|canva:design:content:write|canva:asset:private:write/i;

for (const path of [
  boundaryPath,
  dxManifestPath,
  canvaConfigPath,
  messagesPath,
  commandPlansPath,
  appPath,
  gitignorePath,
  readmePath,
  starterGuidePath
]) {
  assert.equal(existsSync(path), true, `${path} should exist`);
}

const registrySource = readFileSync(join(root, "registry", "official-extensions.toml"), "utf8");
assert.match(registrySource, /id = "dx\.canva\.command-center"/);
assert.match(registrySource, /name = "DX Canva Command Center"/);
assert.match(registrySource, /path = "hosts\/canva\/dx-canva"/);
assert.match(registrySource, /manifest = "hosts\/canva\/dx-canva\/dx\.extension\.toml"/);
assert.match(registrySource, /status = "experimental"/);

const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
assert.equal(
  packageJson.scripts["test:canva-adapter"],
  "node --experimental-strip-types scripts/tests/canvaAdapter.test.ts"
);
assert.equal(
  (packageJson.workspaces ?? []).includes("hosts/canva/dx-canva"),
  false,
  "Canva adapter must stay a root-tested source adapter, not an npm workspace"
);
assert.equal(existsSync(join(adapterRoot, "package.json")), false);
assert.equal(existsSync(join(adapterRoot, "package-lock.json")), false);
assert.equal(existsSync(join(adapterRoot, "node_modules")), false);

const testJ1Source = readFileSync(join(root, "scripts", "test-j1.ps1"), "utf8");
assert.match(testJ1Source, /Invoke-DxCommand "npm" @\("run", "test:canva-adapter"\)/);

const dxManifestSource = readFileSync(dxManifestPath, "utf8");
const dxManifest = parseTomlDocument(dxManifestSource);
assert.doesNotMatch(dxManifestSource, /scaffold|loaded-host proof|local-service proof/i);
assert.equal(dxManifest.sections.extension.id, "dx.canva.command-center");
assert.equal(dxManifest.sections.extension.name, "DX Canva Command Center");
assert.equal(dxManifest.sections.extension.official, true);
assert.deepEqual(dxManifest.sections.compatibility.hosts, ["canva"]);
assert.equal(dxManifest.sections.entrypoint.transport, "http");
assert.equal(dxManifest.sections.entrypoint.command, "dx-local-service");
assert.deepEqual(dxManifest.sections.entrypoint.args, []);
assert.equal(dxManifest.sections.security.signature, "development-unsigned");
assert.equal(dxManifest.sections.security.sandbox, "canva-app-iframe");
assert.equal(dxManifest.sections.security.network, "deny-by-default");
assert.equal(dxManifest.sections.security.stores_payloads, false);
assert.equal(dxManifest.sections.security.stores_process_output, false);

const capabilityIds = (dxManifest.arrays.capabilities ?? []).map((capability) => capability.id);
assert.deepEqual(capabilityIds, [
  "canva.app.iframe",
  "canva.design_editor",
  "local_service.connect",
  "receipts.read"
]);
assert.equal(capabilityIds.includes("process.spawn"), false);
assert.equal(capabilityIds.includes("filesystem.write"), false);
assert.equal(capabilityIds.includes("canva.design.write"), false);

const hostActions = dxManifest.arrays.host_actions ?? [];
assert.deepEqual(hostActions.map((action) => action.id), [
  "dx.canva.show_status",
  "dx.canva.search_assets",
  "dx.canva.copy_receipts_path"
]);
assert.ok(hostActions.every((action) => action.transport !== "process"));
assert.ok(hostActions.every((action) => action.writes_receipts === false));

const receipt = dxManifest.arrays.receipts?.[0];
assert.equal(
  receipt.latest_path,
  ".dx/receipts/extensions/dx.canva.command-center/host-action-index-latest.json"
);
assert.equal(receipt.metadata_only, true);

const canvaConfig = JSON.parse(readFileSync(canvaConfigPath, "utf8"));
assert.equal(canvaConfig.$schema, "https://www.canva.dev/schemas/app/v1/manifest-schema.json");
assert.equal(canvaConfig.manifest_schema_version, 1);
assert.deepEqual(canvaConfig.runtime.permissions, []);
assert.deepEqual(canvaConfig.intent.design_editor, { enrolled: true });
assert.equal(canvaConfig.intent.data_connector, undefined);
assert.equal(canvaConfig.intent.content_publisher, undefined);
assert.doesNotMatch(JSON.stringify(canvaConfig), forbiddenDesignMutationPattern);

const messagesSource = readFileSync(messagesPath, "utf8");
assert.match(messagesSource, /DX_CANVA_MESSAGES[\s\S]*showStatus:\s*"dx\.canva\.show_status"/);
assert.match(messagesSource, /searchAssets:\s*"dx\.canva\.search_assets"/);
assert.match(messagesSource, /copyReceiptsPath:\s*"dx\.canva\.copy_receipts_path"/);
assert.match(messagesSource, /isDxCanvaMessageType/);

const commandPlansSource = readFileSync(commandPlansPath, "utf8");
assert.match(commandPlansSource, /operation:\s*"dx\.status"/);
assert.match(commandPlansSource, /operation:\s*"dx\.assets\.search"/);
assert.match(commandPlansSource, /operation:\s*"receipt\.copyPath"/);
assert.match(commandPlansSource, /requiresRuntimeProof:\s*true/);
assert.match(
  commandPlansSource,
  /copyReceiptsPath:\s*{[\s\S]*transport:\s*"host-ui"[\s\S]*requiresRuntimeProof:\s*false[\s\S]*}/
);
assert.match(commandPlansSource, /mutatesCanvaDesign:\s*false/);
assert.doesNotMatch(commandPlansSource, forbiddenRuntimePattern);
assert.doesNotMatch(commandPlansSource, forbiddenDesignMutationPattern);

const appSource = readFileSync(appPath, "utf8");
assert.match(appSource, /DX_CANVA_COMMAND_PLANS/);
assert.match(appSource, /DX service connection is not configured for this host/);
assert.doesNotMatch(appSource, /local-service proof|loaded-host proof|metadata only|scaffold/i);
assert.match(appSource, /data-command/);
assert.doesNotMatch(appSource, forbiddenRuntimePattern);
assert.doesNotMatch(appSource, forbiddenDesignMutationPattern);

const gitignoreSource = readFileSync(gitignorePath, "utf8");
assert.match(gitignoreSource, /^\/dist\//m);
assert.match(gitignoreSource, /^\/app\.js$/m);
assert.match(gitignoreSource, /^\/node_modules\//m);

const readmeSource = readFileSync(readmePath, "utf8");
assert.match(readmeSource, /source-level only/i);
assert.match(readmeSource, /development Canva app smoke/i);
assert.match(readmeSource, /test:canva-build-output/);
assert.match(readmeSource, /ignored `app\.js` bundle/i);
assert.match(readmeSource, /Canva review remains deferred/i);
assert.match(readmeSource, /live\s+local-service proof remains deferred/i);
assert.match(readmeSource, /signing[\s\S]*checksum[\s\S]*remain deferred/i);
assert.doesNotMatch(readmeSource, /release[- ]ready|marketplace[- ]ready|production[- ]ready|published|installable|review approved/i);

const boundarySource = readFileSync(boundaryPath, "utf8");
assert.match(boundarySource, /Canva Apps SDK/i);
assert.match(boundarySource, /must not spawn local processes/i);
assert.match(boundarySource, /must not mutate Canva designs/i);

const starterGuideSource = readFileSync(starterGuidePath, "utf8");
assert.match(starterGuideSource, /https:\/\/www\.canva\.dev\/docs\/apps\/app-configuration\/canva-app-json\//);
assert.match(starterGuideSource, /https:\/\/www\.canva\.dev\/docs\/apps\/integrating-canva\//);
assert.match(starterGuideSource, /https:\/\/www\.canva\.dev\/docs\/apps\/bundling-apps\//);
assert.match(starterGuideSource, /manifest_schema_version/);
assert.match(starterGuideSource, /runtime\.permissions/);
assert.match(starterGuideSource, /local-service proof remains deferred/i);
assert.match(starterGuideSource, /Canva review remains deferred/i);

const professionalTargetsSource = readFileSync(
  join(root, "registry", "professional-host-targets.toml"),
  "utf8"
);
assert.match(professionalTargetsSource, /id = "canva\.apps-sdk"[\s\S]*recommended_priority = "active-scaffold"/);
assert.match(professionalTargetsSource, /id = "canva\.apps-sdk"[\s\S]*loaded-host smoke receipt/);

console.log("Canva adapter verified");
