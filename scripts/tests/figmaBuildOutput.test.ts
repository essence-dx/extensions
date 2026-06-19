import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildFigmaPlugin } from "../build-figma-plugin.ts";

const root = process.cwd();
const adapterRoot = join(root, "hosts", "figma", "dx-figma");
const outputRoot = mkdtempSync(join(tmpdir(), "dx-figma-build-output-"));

try {
  const result = await buildFigmaPlugin({
    adapterRoot,
    outputRoot
  });

  assert.equal(result.adapterRoot, adapterRoot);
  assert.equal(result.outputPath, join(outputRoot, "main.js"));
  assert.equal(result.sourceMapPath, join(outputRoot, "main.js.map"));
  assert.deepEqual(result.externalModules, []);
  assert.deepEqual(
    result.inputs,
    ["src/commandPlans.ts", "src/main.ts", "src/messages.ts"],
    "Figma bundle should include only the plugin entrypoint and typed command modules"
  );

  assert.equal(existsSync(result.outputPath), true, "main.js should be emitted");
  assert.equal(existsSync(result.sourceMapPath), true, "main.js.map should be emitted");

  const outputSource = readFileSync(result.outputPath, "utf8");
  assert.match(outputSource, /figma\.showUI\(__html__/);
  assert.match(outputSource, /figma\.ui\.onmessage/);
  assert.match(outputSource, /isDxFigmaUiMessage/);
  assert.match(outputSource, /DX_FIGMA_COMMAND_PLANS/);
  assert.match(outputSource, /DX Figma message is invalid/);
  assert.match(outputSource, /DX service connection is not configured for this host/);
  assert.doesNotMatch(outputSource, /local-service proof|loaded-host proof|metadata only|scaffold/i);
  assert.doesNotMatch(outputSource, /fetch\(|XMLHttpRequest|child_process|spawn\(|exec\(|execFile\(|PowerShell|cmd\.exe|bash|sh -c|shell/i);
} finally {
  rmSync(outputRoot, { recursive: true, force: true });
}

console.log("Figma build output verified");
