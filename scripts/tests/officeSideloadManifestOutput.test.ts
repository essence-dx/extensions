import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildOfficeSideloadManifestOutput } from "../build-office-sideload-manifests.ts";

const root = process.cwd();
const outputRoot = mkdtempSync(join(tmpdir(), "dx-office-sideload-manifests-"));
const baseUrl = "https://localhost:3979";
const adapters = [
  { name: "Excel", folder: "dx-excel", route: "excel", host: "Workbook" },
  { name: "PowerPoint", folder: "dx-powerpoint", route: "powerpoint", host: "Presentation" },
  { name: "Word", folder: "dx-word", route: "word", host: "Document" }
];

try {
  for (const adapter of adapters) {
    const adapterRoot = join(root, "hosts", "office", adapter.folder);
    const result = buildOfficeSideloadManifestOutput({
      adapterRoot,
      outputRoot: join(outputRoot, adapter.folder),
      baseUrl
    });

    assert.equal(result.adapterRoot, adapterRoot);
    assert.equal(result.outputPath, join(outputRoot, adapter.folder, "manifest.xml"));
    assert.equal(result.baseUrl, baseUrl);
    assert.equal(result.taskpaneUrl, `${baseUrl}/${adapter.route}/taskpane.html`);
    assert.deepEqual(result.replacedOrigins, ["https://dx-office.example.invalid"]);

    assert.equal(existsSync(result.outputPath), true, `${adapter.name} manifest should be emitted`);

    const manifest = readFileSync(result.outputPath, "utf8");
    assert.match(manifest, new RegExp(`<Host Name="${adapter.host}"\\/>`));
    assert.match(manifest, new RegExp(`<AppDomain>${escapeRegExp(baseUrl)}</AppDomain>`));
    assert.match(
      manifest,
      new RegExp(`<SourceLocation DefaultValue="${escapeRegExp(result.taskpaneUrl)}"\\/>`)
    );
    assert.match(
      manifest,
      new RegExp(
        `<bt:Url id="Dx${adapter.name}TaskpaneUrl" DefaultValue="${escapeRegExp(result.taskpaneUrl)}"\\/>`
      )
    );
    assert.match(manifest, new RegExp(`DefaultValue="${escapeRegExp(baseUrl)}/assets/icon-16.png"`));
    assert.match(manifest, new RegExp(`DefaultValue="${escapeRegExp(baseUrl)}/assets/icon-32.png"`));
    assert.match(manifest, new RegExp(`DefaultValue="${escapeRegExp(baseUrl)}/assets/icon-64.png"`));
    assert.match(manifest, new RegExp(`DefaultValue="${escapeRegExp(baseUrl)}/assets/icon-80.png"`));
    assert.match(manifest, new RegExp(`DefaultValue="${escapeRegExp(baseUrl)}/support"`));
    assert.match(manifest, /<Permissions>ReadDocument<\/Permissions>/);
    assert.doesNotMatch(manifest, /dx-office\.example\.invalid/);
    assert.doesNotMatch(manifest, /ReadWriteDocument|ReadAllDocument|WriteDocument/);

    for (const declaredUrl of readDeclaredUrls(manifest)) {
      assert.match(declaredUrl, /^https:\/\//);
      assert.doesNotMatch(declaredUrl, /localhost:3979\/\//);
    }
  }
} finally {
  rmSync(outputRoot, { recursive: true, force: true });
}

console.log("Office sideload manifest output verified");

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readDeclaredUrls(manifest: string): string[] {
  const urlValues = [...manifest.matchAll(/DefaultValue="(https?:\/\/[^"]+|wss?:\/\/[^"]+)"/g)].map(
    (match) => match[1]
  );
  const appDomains = [...manifest.matchAll(/<AppDomain>(https?:\/\/[^<]+|wss?:\/\/[^<]+)<\/AppDomain>/g)].map(
    (match) => match[1]
  );

  return [...urlValues, ...appDomains];
}
