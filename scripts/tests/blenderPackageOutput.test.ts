import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildBlenderPackageOutput } from "../build-blender-package-output.ts";

const root = process.cwd();
const adapterRoot = join(root, "hosts", "blender", "dx-blender");
const outputRoot = mkdtempSync(join(tmpdir(), "dx-blender-package-output-"));

try {
  const result = buildBlenderPackageOutput({
    adapterRoot,
    outputRoot
  });

  assert.equal(result.adapterRoot, adapterRoot);
  assert.equal(result.outputRoot, outputRoot);
  assert.equal(result.manifestPath, join(outputRoot, "blender_manifest.toml"));
  assert.equal(result.addonPath, join(outputRoot, "__init__.py"));
  assert.deepEqual(result.inputs, ["__init__.py", "blender_manifest.toml"]);

  assert.equal(existsSync(result.manifestPath), true, "Blender manifest should be emitted");
  assert.equal(existsSync(result.addonPath), true, "Blender add-on entrypoint should be emitted");

  const manifest = readFileSync(result.manifestPath, "utf8");
  assert.match(manifest, /id = "dx_blender_command_center"/);
  assert.match(manifest, /type = "add-on"/);
  assert.match(manifest, /blender_version_min = "4\.2\.0"/);

  const addonSource = readFileSync(result.addonPath, "utf8");
  assert.match(addonSource, /class DX_OT_show_status/);
  assert.match(addonSource, /class DX_OT_run_doctor/);
  assert.match(addonSource, /class DX_OT_open_receipts/);
  assert.match(addonSource, /shell=False/);
  assert.doesNotMatch(addonSource, /shell=True|os\.system|subprocess\.(Popen|call|check_call|check_output)/);
} finally {
  rmSync(outputRoot, { recursive: true, force: true });
}

console.log("Blender package output verified");
