import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const workspaceRoot = join(import.meta.dirname, "..", "..");
const wrapperPath = "scripts/package-browser-native-host-j1.ps1";
const wrapperSource = readFileSync(join(workspaceRoot, wrapperPath), "utf8");

const preflightIndex = wrapperSource.indexOf("Resolve-BrowserExtensionIdCapture");
const cargoBuildIndex = wrapperSource.indexOf('Invoke-DxCommand "cargo" @("build", "-j", "1", "--release"');

assert.notEqual(preflightIndex, -1, `${wrapperPath} must validate captured browser extension IDs.`);
assert.notEqual(cargoBuildIndex, -1, `${wrapperPath} must keep the native-host release build explicit.`);
assert.ok(
  preflightIndex < cargoBuildIndex,
  `${wrapperPath} must validate Chrome and Edge extension ID capture before the release Cargo build.`
);
assert.match(
  wrapperSource,
  /complete Chrome and Edge extension-ID capture/,
  `${wrapperPath} must explain how to unblock missing extension ID capture.`
);
assert.doesNotMatch(
  wrapperSource,
  /\[Parameter\(Mandatory = \$true\)\]\s*\r?\n\s*\[string\] \$ChromeExtensionId/,
  `${wrapperPath} must allow ChromeExtensionId to be resolved from capture receipts.`
);
assert.doesNotMatch(
  wrapperSource,
  /\[Parameter\(Mandatory = \$true\)\]\s*\r?\n\s*\[string\] \$EdgeExtensionId/,
  `${wrapperPath} must allow EdgeExtensionId to be resolved from capture receipts.`
);
assert.match(
  wrapperSource,
  /function Resolve-BrowserExtensionIdCapture/,
  `${wrapperPath} must resolve extension IDs from the capture receipt before packaging.`
);
assert.match(
  wrapperSource,
  /complete Chrome and Edge extension-ID capture/,
  `${wrapperPath} must reject partial browser extension ID capture.`
);
assert.match(
  wrapperSource,
  /\$resolvedExtensionIds\.ChromeExtensionId/,
  `${wrapperPath} must pass the resolved Chrome extension ID into manifest packaging.`
);
assert.match(
  wrapperSource,
  /\$resolvedExtensionIds\.EdgeExtensionId/,
  `${wrapperPath} must pass the resolved Edge extension ID into manifest packaging.`
);
assert.match(
  wrapperSource,
  /target\s+-eq\s+"chrome"/,
  `${wrapperPath} must inspect the Chrome capture entry.`
);
assert.match(
  wrapperSource,
  /target\s+-eq\s+"edge"/,
  `${wrapperPath} must inspect the Edge capture entry.`
);

console.log("Browser native-host package preflight verified");
