import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parseTomlDocument } from "../lib/toml-lite.ts";

const root = process.cwd();
const adapterRoot = join(root, "hosts", "blender", "dx-blender");
const dxManifestPath = join(adapterRoot, "dx.extension.toml");
const blenderManifestPath = join(adapterRoot, "blender_manifest.toml");
const addonPath = join(adapterRoot, "__init__.py");
const readmePath = join(adapterRoot, "README.md");

for (const path of [dxManifestPath, blenderManifestPath, addonPath, readmePath]) {
  assert.equal(existsSync(path), true, `${path} should exist`);
}

const registrySource = readFileSync(join(root, "registry", "official-extensions.toml"), "utf8");
assert.match(registrySource, /id = "dx\.blender\.command-center"/);
assert.match(registrySource, /path = "hosts\/blender\/dx-blender"/);
assert.match(registrySource, /manifest = "hosts\/blender\/dx-blender\/dx\.extension\.toml"/);
assert.match(registrySource, /status = "experimental"/);

const dxManifest = parseTomlDocument(readFileSync(dxManifestPath, "utf8"));
assert.equal(dxManifest.sections.extension.id, "dx.blender.command-center");
assert.equal(dxManifest.sections.extension.name, "DX Blender Command Center");
assert.equal(dxManifest.sections.extension.official, true);
assert.deepEqual(dxManifest.sections.compatibility.hosts, ["blender"]);
assert.equal(dxManifest.sections.entrypoint.command, "dx");
assert.deepEqual(dxManifest.sections.entrypoint.args, []);
assert.equal(dxManifest.sections.security.signature, "development-unsigned");
assert.equal(dxManifest.sections.security.stores_payloads, false);
assert.equal(dxManifest.sections.security.stores_process_output, false);

const hostActionIds = (dxManifest.arrays.host_actions ?? []).map((action) => action.id);
assert.deepEqual(hostActionIds, [
  "dx.blender.show_status",
  "dx.blender.run_doctor",
  "dx.blender.open_receipts"
]);

const receipt = dxManifest.arrays.receipts?.[0];
assert.equal(
  receipt.latest_path,
  ".dx/receipts/extensions/dx.blender.command-center/host-action-index-latest.json"
);
assert.equal(receipt.metadata_only, true);

const blenderManifest = parseTomlDocument(readFileSync(blenderManifestPath, "utf8"));
assert.equal(blenderManifest.root.schema_version, "1.0.0");
assert.equal(blenderManifest.root.id, "dx_blender_command_center");
assert.equal(blenderManifest.root.type, "add-on");
assert.equal(blenderManifest.root.blender_version_min, "4.2.0");

const addonSource = readFileSync(addonPath, "utf8");
assert.match(addonSource, /class DX_OT_show_status/);
assert.match(addonSource, /class DX_OT_run_doctor/);
assert.match(addonSource, /class DX_OT_open_receipts/);
assert.match(addonSource, /def register\(\):/);
assert.match(addonSource, /def unregister\(\):/);
assert.match(
  addonSource,
  /DX_COMMANDS\s*=\s*{[\s\S]*"status":\s*\("dx",\s*"status"\)[\s\S]*"doctor":\s*\("dx",\s*"doctor"\)/
);
assert.match(addonSource, /subprocess\.run\(/);
assert.match(addonSource, /shell=False/);
assert.match(addonSource, /stdout=subprocess\.DEVNULL/);
assert.match(addonSource, /stderr=subprocess\.DEVNULL/);
assert.doesNotMatch(addonSource, /shell=True/);
assert.doesNotMatch(addonSource, /os\.system/);
assert.doesNotMatch(addonSource, /subprocess\.(Popen|call|check_call|check_output)/);

console.log("Blender adapter verified");
