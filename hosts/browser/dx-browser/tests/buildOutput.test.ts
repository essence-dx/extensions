import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const entrypoints = [
  "dist/browser/chromium/js/background/chromium.js",
  "dist/browser/chromium/js/ui/popup.js",
  "dist/browser/chromium/js/ui/sidepanel.js",
  "dist/browser/edge/js/background/chromium.js",
  "dist/browser/edge/js/ui/popup.js",
  "dist/browser/edge/js/ui/sidepanel.js",
  "dist/browser/edge/js/ui/options.js",
  "dist/browser/firefox/js/background/firefox.js",
  "dist/browser/firefox/js/ui/sidebar.js",
  "dist/browser/firefox/js/ui/options.js"
];

for (const manifestPath of [
  "dist/browser/chromium/manifest.json",
  "dist/browser/edge/manifest.json",
  "dist/browser/firefox/manifest.json"
]) {
  assert.equal(
    existsSync(new URL(`../${manifestPath}`, import.meta.url)),
    true,
    `${manifestPath} should exist`
  );
}

for (const entrypoint of entrypoints) {
  const url = new URL(`../${entrypoint}`, import.meta.url);

  assert.equal(existsSync(url), true, `${entrypoint} should exist`);

  const source = readFileSync(url, "utf8");
  assert.doesNotMatch(
    source,
    /\bfrom\s+["']\.\.?\//,
    `${entrypoint} should be bundled without relative ESM imports`
  );
}

console.log("browser build output verified");
