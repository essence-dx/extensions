import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const workspaceRoot = join(import.meta.dirname, "..", "..");
const wrapperSource = readFileSync(
  join(workspaceRoot, "scripts", "smoke-davinci-resolve-developer-docs-j1.ps1"),
  "utf8"
);

const serialIndex = wrapperSource.indexOf("Set-DxSerialBuildEnvironment");
const guardIndex = wrapperSource.indexOf("Assert-NoCompetingHeavyProcess");
const pushLocationIndex = wrapperSource.indexOf("Push-Location");
const testIndex = wrapperSource.indexOf('Invoke-DxCommand "npm" @("run", "test:davinci-resolve-developer-docs-receipt")');
const writerIndex = wrapperSource.indexOf(
  'Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-davinci-resolve-developer-docs-receipt.ts")'
);
const ignoreCheckIndex = wrapperSource.indexOf('Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")');

assert.notEqual(serialIndex, -1, "DaVinci developer-docs wrapper must set the serial build environment.");
assert.notEqual(guardIndex, -1, "DaVinci developer-docs wrapper must reject competing heavy processes.");
assert.notEqual(pushLocationIndex, -1, "DaVinci developer-docs wrapper must enter the workspace explicitly.");
assert.ok(
  serialIndex < guardIndex && guardIndex < pushLocationIndex,
  "DaVinci developer-docs wrapper must run the process guard before entering the workspace."
);
assert.notEqual(testIndex, -1, "DaVinci developer-docs wrapper must test the receipt writer before writing.");
assert.notEqual(writerIndex, -1, "DaVinci developer-docs wrapper must invoke the receipt writer.");
assert.notEqual(ignoreCheckIndex, -1, "DaVinci developer-docs wrapper must verify generated-output ignore policy.");
assert.ok(
  testIndex < writerIndex && writerIndex < ignoreCheckIndex,
  "DaVinci developer-docs wrapper must test, write, then verify generated-output ignore policy."
);

console.log("DaVinci developer-docs wrapper verified");
