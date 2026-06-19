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

interface AffinityContentManifest {
  name: string;
  supportedHosts: string[];
  supportedContentTypes: Array<{ type: string; extensions: string[] }>;
  photoshopFilterCompatibility: {
    host: string;
    compatiblePluginType: string;
    dxNativeFilterPlugin: string;
  };
}

const adapterRoot = "hosts/affinity/dx-affinity-content";
const dxManifestPath = `${adapterRoot}/dx.extension.toml`;
const contentManifestPath = `${adapterRoot}/affinity-content-manifest.json`;
const contentPlansPath = `${adapterRoot}/src/contentPlans.ts`;
const importGuidePath = `${adapterRoot}/src/importGuide.ts`;
const readmePath = `${adapterRoot}/README.md`;
const starterGuidePath = "docs/affinity-content-addon-starter.md";

requireWorkspacePaths([
  "hosts/affinity/README.md",
  dxManifestPath,
  contentManifestPath,
  contentPlansPath,
  importGuidePath,
  `${adapterRoot}/.gitignore`,
  readmePath,
  starterGuidePath
]);

assertRegistryEntry({
  id: "dx.affinity-content.bridge",
  path: adapterRoot,
  manifest: dxManifestPath,
  professionalTarget: "affinity.content-addons"
});
assertPackageScript(
  "test:affinity-content-addon-adapter",
  "scripts/tests/affinityContentAddonAdapter.test.ts"
);
assertJ1Script("test:affinity-content-addon-adapter");

assertDxManifest(readDxManifest(dxManifestPath), {
  id: "dx.affinity-content.bridge",
  name: "DX Affinity Content Bridge",
  hosts: ["affinity-photo", "affinity-designer", "affinity-publisher"],
  sandbox: "affinity-content-addon",
  network: "deny-by-default",
  entrypointTransport: "host_script",
  entrypointCommand: "manual-affinity-import",
  capabilities: [
    "affinity.content.assets",
    "affinity.content.fonts",
    "affinity.content.swatches",
    "receipts.read"
  ],
  hostActions: [
    "dx.affinity-content.prepare_assets",
    "dx.affinity-content.prepare_fonts",
    "dx.affinity-content.show_receipts"
  ],
  receiptPath:
    ".dx/receipts/extensions/dx.affinity-content.bridge/host-action-index-latest.json"
});
const dxManifestSource = readWorkspaceText(dxManifestPath);
assert.doesNotMatch(dxManifestSource, /scaffold|loaded-host proof|local-service proof/i);

const contentManifest = readWorkspaceJson<AffinityContentManifest>(contentManifestPath);
assert.equal(contentManifest.name, "DX Affinity Content Bridge");
assert.deepEqual(contentManifest.supportedHosts, [
  "Affinity Photo 2",
  "Affinity Designer 2",
  "Affinity Publisher 2"
]);
assert.deepEqual(
  contentManifest.supportedContentTypes.map((contentType) => contentType.type),
  ["assets", "fonts", "swatches", "styles", "templates"]
);
assert.equal(contentManifest.photoshopFilterCompatibility.host, "Affinity Photo 2");
assert.match(
  contentManifest.photoshopFilterCompatibility.compatiblePluginType,
  /64-bit Photoshop-compatible filter plugins/i
);
assert.equal(contentManifest.photoshopFilterCompatibility.dxNativeFilterPlugin, "deferred");

const contentPlansSource = readWorkspaceText(contentPlansPath);
assert.match(contentPlansSource, /DX_AFFINITY_CONTENT_PLANS/);
assert.match(contentPlansSource, /operation: "dx\.assets\.exportAffinityPack"/);
assert.match(contentPlansSource, /operation: "dx\.fonts\.exportAffinityPack"/);
assert.match(contentPlansSource, /operation: "receipt\.showPath"/);
assert.match(contentPlansSource, /transport: "manual-import"/);
assert.match(contentPlansSource, /requiresRuntimeProof: true/);
assert.match(contentPlansSource, /mutatesAffinityDocument: false/);

const importGuideSource = readWorkspaceText(importGuidePath);
assert.match(importGuideSource, /AFFINITY_IMPORT_GUIDE/);
assert.match(importGuideSource, /\.afassets/);
assert.match(importGuideSource, /\.affont/);
assert.match(importGuideSource, /\.afpalette/);
assert.match(importGuideSource, /manual import proof remains deferred/i);

const forbiddenRuntimePattern =
  /ProcessBuilder|System\.Diagnostics\.Process|child_process|spawn\(|exec\(|UrlFetchApp|fetch\(|XMLHttpRequest|WebSocket|localhost|127\.0\.0\.1|PhotoshopPluginMain|FilterRecord|FilterProc|SPBasicSuite|osascript|AutoHotkey|PowerShell|cmd\.exe|bash|sh -c/i;
assertSourceDoesNotMatch(contentPlansPath, forbiddenRuntimePattern);
assertSourceDoesNotMatch(importGuidePath, forbiddenRuntimePattern);

const readmeSource = readWorkspaceText(readmePath);
assert.match(readmeSource, /source-level only/i);
assert.match(readmeSource, /not a native Affinity SDK plugin/i);
assert.match(readmeSource, /manual import proof remains deferred/i);
assert.match(readmeSource, /Photoshop-compatible filter plugin proof remains deferred/i);
assert.doesNotMatch(readmeSource, /release[- ]ready|published|installable/i);

const starterGuideSource = readWorkspaceText(starterGuidePath);
assert.match(starterGuideSource, /https:\/\/affinity\.help\/designer2\/English\.lproj\/pages\/Addons\/aboutAddons\.html/);
assert.match(starterGuideSource, /https:\/\/affinity\.help\/photo2\/English\.lproj\/pages\/Introduction\/keyFeatures\.html/);
assert.match(starterGuideSource, /Photoshop-compatible filter/i);
assert.match(starterGuideSource, /manual import proof remains deferred/i);

console.log("Affinity content add-on adapter verified");
