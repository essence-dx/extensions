import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const chromiumManifest = readJson("manifests/manifest.chromium.json");
const edgeManifest = readJson("manifests/manifest.edge.json");
const firefoxManifest = readJson("manifests/manifest.firefox.json");
const expectedPermissions = {
  chromium: ["activeTab", "nativeMessaging", "sidePanel"],
  edge: ["activeTab", "nativeMessaging", "sidePanel"],
  firefox: ["activeTab", "nativeMessaging"]
};

for (const [name, manifest] of [
  ["chromium", chromiumManifest],
  ["edge", edgeManifest],
  ["firefox", firefoxManifest]
]) {
  assert.equal(manifest.manifest_version, 3, `${name} manifest should use MV3`);
  assert.equal(manifest.name, "DX Browser Command Center");
  assert.equal(manifest.version, "0.1.0");
  assert.deepEqual(
    manifest.host_permissions ?? [],
    [],
    `${name} manifest should not request broad host permissions`
  );
  assert.deepEqual(
    manifest.permissions,
    expectedPermissions[name],
    `${name} manifest should keep an exact permission allowlist`
  );
  assert.deepEqual(
    manifest.icons,
    {
      "16": "static/dx.svg",
      "48": "static/dx.svg",
      "128": "static/dx.svg"
    },
    `${name} manifest should use the branded DX icon asset`
  );
  assert.deepEqual(
    manifest.action.default_icon,
    {
      "16": "static/dx.svg",
      "48": "static/dx.svg",
      "128": "static/dx.svg"
    },
    `${name} action should use the branded DX icon asset`
  );
  assert.doesNotMatch(
    JSON.stringify(manifest),
    /placeholder/i,
    `${name} manifest must not reference placeholder assets`
  );

  for (const forbidden of [
    "content_scripts",
    "externally_connectable",
    "optional_host_permissions",
    "optional_permissions"
  ]) {
    assert.equal(
      Object.hasOwn(manifest, forbidden),
      false,
      `${name} manifest must not declare ${forbidden}`
    );
  }
}

assert.equal(
  chromiumManifest.background.service_worker,
  "js/background/chromium.js",
  "Chromium manifest should point to the compiled background worker"
);

assert.equal(
  edgeManifest.background.service_worker,
  "js/background/chromium.js",
  "Edge manifest should reuse the compiled Chromium background worker"
);

assert.equal(
  edgeManifest.description,
  "Official Microsoft Edge command-center bridge for DX tools and receipts.",
  "Edge manifest should have Edge-specific store-facing description"
);

assert.equal(
  firefoxManifest.background.scripts[0],
  "js/background/firefox.js",
  "Firefox manifest should point to the compiled background script"
);

assert.deepEqual(
  firefoxManifest.sidebar_action.default_icon,
  {
    "48": "static/dx.svg"
  },
  "Firefox sidebar should use the branded DX icon asset"
);

console.log("browser manifest policy verified");

function readJson(path) {
  return JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
}
