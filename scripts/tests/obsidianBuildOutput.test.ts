import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildObsidianPlugin } from "../build-obsidian-plugin.ts";

const root = process.cwd();
const adapterRoot = join(root, "hosts", "obsidian", "dx-command-center");
const outputRoot = mkdtempSync(join(tmpdir(), "dx-obsidian-build-output-"));

try {
  const result = await buildObsidianPlugin({
    adapterRoot,
    outputRoot
  });

  assert.equal(result.adapterRoot, adapterRoot);
  assert.equal(result.outputPath, join(outputRoot, "main.js"));
  assert.equal(result.sourceMapPath, join(outputRoot, "main.js.map"));
  assert.deepEqual(result.externalModules, ["obsidian"]);
  assert.deepEqual(
    result.inputs,
    ["src/dxCommandRunner.ts", "src/main.ts"],
    "Obsidian bundle should include only the source entrypoint and command runner"
  );

  assert.equal(existsSync(result.outputPath), true, "main.js should be emitted");
  assert.equal(
    existsSync(result.sourceMapPath),
    true,
    "main.js.map should be emitted"
  );

  const outputSource = readFileSync(result.outputPath, "utf8");
  assert.match(outputSource, /require\("obsidian"\)/);
  assert.match(outputSource, /DxObsidianCommandCenter/);
  assert.match(outputSource, /DX_COMMANDS/);
  assert.doesNotMatch(
    outputSource,
    /require\("\.\/dxCommandRunner"\)/,
    "command runner should be bundled into the plugin output"
  );
} finally {
  rmSync(outputRoot, { recursive: true, force: true });
}

console.log("obsidian build output verified");
