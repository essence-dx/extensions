import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildAdobeUxpPackage } from "../build-adobe-uxp-package.ts";

const root = process.cwd();
const outputRoot = mkdtempSync(join(tmpdir(), "dx-adobe-uxp-package-output-"));
const adapters = [
  {
    name: "Photoshop",
    folder: "dx-photoshop-uxp",
    globalName: "dxPhotoshopMessages",
    commandPlansName: "DX_PHOTOSHOP_COMMAND_PLANS",
    requiredMessage: "dx.photoshop.show_status"
  },
  {
    name: "Premiere Pro",
    folder: "dx-premiere-pro-uxp",
    globalName: "dxPremiereMessages",
    commandPlansName: "DX_PREMIERE_COMMAND_PLANS",
    requiredMessage: "dx.premiere-pro.show_status"
  },
  {
    name: "InDesign",
    folder: "dx-indesign-uxp",
    globalName: "dxInDesignMessages",
    commandPlansName: "DX_INDESIGN_COMMAND_PLANS",
    requiredMessage: "dx.indesign.show_status"
  }
];

try {
  for (const adapter of adapters) {
    const adapterRoot = join(root, "hosts", "adobe", adapter.folder);
    const result = await buildAdobeUxpPackage({
      adapterRoot,
      outputRoot: join(outputRoot, adapter.folder)
    });

    assert.equal(result.adapterRoot, adapterRoot);
    assert.equal(result.packageRoot, join(outputRoot, adapter.folder, "dist"));
    assert.equal(result.manifestPath, join(result.packageRoot, "manifest.json"));
    assert.equal(result.htmlPath, join(result.packageRoot, "index.html"));
    assert.equal(result.outputPath, join(result.packageRoot, "index.js"));
    assert.equal(result.sourceMapPath, join(result.packageRoot, "index.js.map"));
    assert.deepEqual(result.externalModules, ["uxp"]);
    assert.deepEqual(
      result.inputs,
      ["src/messages.ts", "src/commandPlans.ts", "src/index.ts"],
      `${adapter.name} package should include only the UXP panel scripts`
    );

    assert.equal(existsSync(result.manifestPath), true, `${adapter.name} manifest should be copied`);
    assert.equal(existsSync(result.htmlPath), true, `${adapter.name} index.html should be emitted`);
    assert.equal(existsSync(result.outputPath), true, `${adapter.name} index.js should be emitted`);
    assert.equal(
      existsSync(result.sourceMapPath),
      true,
      `${adapter.name} index.js.map should be emitted`
    );

    const manifest = JSON.parse(readFileSync(result.manifestPath, "utf8"));
    assert.equal(manifest.main, "index.html");
    assert.deepEqual(manifest.requiredPermissions ?? {}, {});

    const html = readFileSync(result.htmlPath, "utf8");
    assert.match(html, /<script src="\.\/index\.js"><\/script>/);
    assert.doesNotMatch(html, /src\/messages\.ts|src\/commandPlans\.ts|src\/index\.ts/);
    assert.doesNotMatch(html, /fetch\(|XMLHttpRequest|webview|iframe/i);

    const outputSource = readFileSync(result.outputPath, "utf8");
    assert.match(outputSource, /require\("uxp"\)/);
    assert.match(outputSource, new RegExp(adapter.globalName));
    assert.match(outputSource, new RegExp(adapter.commandPlansName));
    assert.match(outputSource, new RegExp(escapeRegExp(adapter.requiredMessage)));
    assert.match(outputSource, /entrypoints\.setup/);
    assert.match(outputSource, /DX service connection is not configured for this host/);
    assert.match(outputSource, /DX receipt path is available in this host/);
    assert.doesNotMatch(outputSource, /local-service proof|loaded-host proof|No DX proof|metadata only|scaffold/i);
    assert.doesNotMatch(outputSource, /fetch\(|XMLHttpRequest|WebSocket|EventSource|child_process|spawn\(|exec\(|execFile\(|PowerShell|cmd\.exe|bash|sh -c|shell\.openPath|shell\.openExternal/i);
    assert.doesNotMatch(outputSource, /batchPlay|executeAsModal|require\(["']photoshop["']\)|createDocument|activeDocument|project\.create|sequence\.create|app\.activeDocument|saveAs|delete\(/i);
  }
} finally {
  rmSync(outputRoot, { recursive: true, force: true });
}

console.log("Adobe UXP package output verified");

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
