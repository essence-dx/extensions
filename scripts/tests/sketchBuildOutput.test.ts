import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildSketchPlugin } from "../build-sketch-plugin.ts";

const root = process.cwd();
const adapterRoot = join(root, "hosts", "sketch", "dx-sketch");
const outputRoot = mkdtempSync(join(tmpdir(), "dx-sketch-build-output-"));

try {
  const result = await buildSketchPlugin({
    adapterRoot,
    outputRoot
  });

  const bundleRoot = join(outputRoot, "dx-sketch.sketchplugin");
  const sketchRoot = join(bundleRoot, "Contents", "Sketch");
  const bundledManifestPath = join(sketchRoot, "manifest.json");

  assert.equal(result.adapterRoot, adapterRoot);
  assert.equal(result.bundleRoot, bundleRoot);
  assert.equal(result.manifestPath, bundledManifestPath);
  assert.equal(result.outputPath, join(sketchRoot, "index.js"));
  assert.equal(result.sourceMapPath, join(sketchRoot, "index.js.map"));
  assert.deepEqual(result.externalModules, []);
  assert.deepEqual(
    result.inputs,
    ["src/commandPlans.ts", "src/index.ts", "src/messages.ts"],
    "Sketch bundle should include only the command entrypoint and typed command modules"
  );

  assert.equal(existsSync(result.manifestPath), true, "manifest.json should be emitted");
  assert.equal(existsSync(result.outputPath), true, "index.js should be emitted");
  assert.equal(existsSync(result.sourceMapPath), true, "index.js.map should be emitted");

  const bundledManifest = JSON.parse(readFileSync(result.manifestPath, "utf8"));
  assert.deepEqual(
    bundledManifest.commands.map((command) => [command.identifier, command.script, command.handler]),
    [
      ["show-status", "index.js", "showDxStatus"],
      ["search-assets", "index.js", "searchDxAssets"],
      ["show-receipts", "index.js", "showDxReceipts"]
    ]
  );
  assert.equal(bundledManifest.disableCocoaScriptPreprocessor, true);
  assert.equal(bundledManifest.appcast, undefined);

  const outputSource = readFileSync(result.outputPath, "utf8");
  assert.match(outputSource, /DXSketchCommandCenter/);
  assert.match(outputSource, /function showDxStatus\(context\)/);
  assert.match(outputSource, /function searchDxAssets\(context\)/);
  assert.match(outputSource, /function showDxReceipts\(context\)/);
  assert.match(outputSource, /DX service connection is not configured for this host/);
  assert.match(outputSource, /DX receipt path is available in this host/);
  assert.doesNotMatch(outputSource, /local-service proof|loaded-host proof|metadata only|scaffold/i);
  assert.match(outputSource, /DX_SKETCH_COMMAND_PLANS/);
  assert.doesNotMatch(outputSource, /fetch\(|XMLHttpRequest|WebSocket|EventSource|localhost|127\.0\.0\.1|0\.0\.0\.0|http:\/\/|https:\/\/|ws:\/\/|wss:\/\/|child_process|spawn\(|exec\(|execFile\(|PowerShell|cmd\.exe|bash|sh -c|shell|NSTask|NSWorkspace|osascript/i);
  assert.doesNotMatch(outputSource, /require\(["']sketch["']\)|from\s+["']sketch["']|getSelectedDocument|getDocuments|selectedDocument|selectedLayers|context\.document|context\.selection|\.export\(|\.save\(|\.remove\(|\.duplicate\(|\.move\(|\.resize\(/i);
} finally {
  rmSync(outputRoot, { recursive: true, force: true });
}

console.log("Sketch build output verified");
