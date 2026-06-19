import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildCanvaApp } from "../build-canva-app.ts";

const root = process.cwd();
const adapterRoot = join(root, "hosts", "canva", "dx-canva");
const outputRoot = mkdtempSync(join(tmpdir(), "dx-canva-build-output-"));

try {
  const result = await buildCanvaApp({
    adapterRoot,
    outputRoot
  });

  assert.equal(result.adapterRoot, adapterRoot);
  assert.equal(result.outputPath, join(outputRoot, "app.js"));
  assert.equal(result.sourceMapPath, join(outputRoot, "app.js.map"));
  assert.deepEqual(result.externalModules, []);
  assert.deepEqual(
    result.inputs,
    ["src/app.tsx", "src/commandPlans.ts", "src/messages.ts"],
    "Canva bundle should include only the app entrypoint and typed command modules"
  );

  assert.equal(existsSync(result.outputPath), true, "app.js should be emitted");
  assert.equal(existsSync(result.sourceMapPath), true, "app.js.map should be emitted");

  const outputSource = readFileSync(result.outputPath, "utf8");
  assert.match(outputSource, /DX service connection is not configured for this host/);
  assert.doesNotMatch(outputSource, /local-service proof|loaded-host proof|metadata only|scaffold/i);
  assert.match(outputSource, /DX_CANVA_COMMAND_PLANS/);
  assert.match(outputSource, /data-command/);
  assert.doesNotMatch(outputSource, /fetch\(|XMLHttpRequest|WebSocket|EventSource|window\.open|requestOpenExternalUrl|child_process|spawn\(|exec\(|execFile\(|PowerShell|cmd\.exe|bash|sh -c|shell/i);
  assert.doesNotMatch(outputSource, /addElementAtCursor|addElementAtPoint|addNativeElement|addPage|upload\(|getTemporaryUrl|requestExport|canva:design:content:write/i);
} finally {
  rmSync(outputRoot, { recursive: true, force: true });
}

console.log("Canva build output verified");
