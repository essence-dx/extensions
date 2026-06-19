import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildOfficeTaskpaneAssets } from "../build-office-taskpane-assets.ts";

const root = process.cwd();
const outputRoot = mkdtempSync(join(tmpdir(), "dx-office-taskpane-assets-"));
const adapters = [
  {
    name: "Excel",
    folder: "dx-excel",
    sourceUrl: "https://dx-office.example.invalid/excel/taskpane.html",
    commandPlansName: "DX_EXCEL_COMMAND_PLANS",
    requiredMessage: "dx.excel.show_status"
  },
  {
    name: "PowerPoint",
    folder: "dx-powerpoint",
    sourceUrl: "https://dx-office.example.invalid/powerpoint/taskpane.html",
    commandPlansName: "DX_POWERPOINT_COMMAND_PLANS",
    requiredMessage: "dx.powerpoint.show_status"
  },
  {
    name: "Word",
    folder: "dx-word",
    sourceUrl: "https://dx-office.example.invalid/word/taskpane.html",
    commandPlansName: "DX_WORD_COMMAND_PLANS",
    requiredMessage: "dx.word.show_status"
  }
];

try {
  for (const adapter of adapters) {
    const adapterRoot = join(root, "hosts", "office", adapter.folder);
    const result = await buildOfficeTaskpaneAssets({
      adapterRoot,
      outputRoot: join(outputRoot, adapter.folder)
    });

    assert.equal(result.adapterRoot, adapterRoot);
    assert.equal(result.outputRoot, join(outputRoot, adapter.folder));
    assert.equal(result.htmlPath, join(result.outputRoot, "taskpane.html"));
    assert.equal(result.outputPath, join(result.outputRoot, "taskpane.js"));
    assert.equal(result.sourceMapPath, join(result.outputRoot, "taskpane.js.map"));
    assert.equal(result.manifestTaskpaneUrl, adapter.sourceUrl);
    assert.deepEqual(result.externalModules, []);
    assert.deepEqual(
      result.inputs,
      ["../shared/localServiceBoundary.ts", "src/commandPlans.ts", "src/messages.ts", "src/taskpane.ts"],
      `${adapter.name} taskpane bundle should include the taskpane source and shared boundary`
    );

    assert.equal(existsSync(result.htmlPath), true, `${adapter.name} taskpane.html should be emitted`);
    assert.equal(existsSync(result.outputPath), true, `${adapter.name} taskpane.js should be emitted`);
    assert.equal(
      existsSync(result.sourceMapPath),
      true,
      `${adapter.name} taskpane.js.map should be emitted`
    );

    const html = readFileSync(result.htmlPath, "utf8");
    assert.match(html, /https:\/\/appsforoffice\.microsoft\.com\/lib\/1\/hosted\/office\.js/);
    assert.match(html, /<script src="\.\/taskpane\.js"><\/script>/);
    assert.doesNotMatch(html, /\.\.\/src\/taskpane\.ts/);
    assert.doesNotMatch(html, /fetch\(|XMLHttpRequest|child_process|spawn\(|exec\(|execFile\(/i);

    const outputSource = readFileSync(result.outputPath, "utf8");
    assert.match(outputSource, /Office\.onReady/);
    assert.match(outputSource, new RegExp(adapter.commandPlansName));
    assert.match(outputSource, new RegExp(escapeRegExp(adapter.requiredMessage)));
    assert.match(outputSource, /createDxOfficeLocalServiceRequest/);
    assert.match(outputSource, /describeDxOfficeServiceConnectionNotice/);
    assert.match(outputSource, /DX service connection is not configured for/);
    assert.doesNotMatch(outputSource, /describeDxOfficeLocalServiceProofBlock|local-service proof|scaffold/i);
    assert.doesNotMatch(outputSource, /fetch\(|XMLHttpRequest|WebSocket|EventSource|child_process|spawn\(|exec\(|execFile\(|PowerShell|cmd\.exe|bash|sh -c|shell/i);
    assert.doesNotMatch(outputSource, /OfficeRuntime\.auth\.getAccessToken|ReadWriteDocument|ReadAllDocument|WriteDocument/i);
  }
} finally {
  rmSync(outputRoot, { recursive: true, force: true });
}

console.log("Office taskpane asset output verified");

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
