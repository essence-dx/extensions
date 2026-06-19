import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = fileURLToPath(new URL("../src", import.meta.url));
const sourceFiles = collectTypeScriptFiles(sourceRoot);

for (const file of sourceFiles) {
  const relativePath = normalize(relative(sourceRoot, file));
  const source = readFileSync(file, "utf8");

  assert.doesNotMatch(source, /node:child_process/, `${relativePath} must not import child_process`);
  assert.doesNotMatch(source, /\bexec(File)?\s*\(/, `${relativePath} must not use exec`);
  assert.doesNotMatch(source, /\bspawn(Sync)?\s*\(/, `${relativePath} must not spawn processes`);
  assert.doesNotMatch(source, /\bprocess\.argv\b/, `${relativePath} must not read process argv`);
  assert.doesNotMatch(source, /\bshell:\s*true\b/, `${relativePath} must not enable shell execution`);
  assert.doesNotMatch(source, /\bchrome\.storage\b/, `${relativePath} must not use chrome.storage`);
  assert.doesNotMatch(source, /\bbrowser\.storage\b/, `${relativePath} must not use browser.storage`);
  assert.doesNotMatch(source, /\blocalStorage\b/, `${relativePath} must not use localStorage`);
  assert.doesNotMatch(source, /\bsessionStorage\b/, `${relativePath} must not use sessionStorage`);
  assert.doesNotMatch(source, /\bindexedDB\b/, `${relativePath} must not use indexedDB`);
}

const protocolSource = readFileSync(
  new URL("../src/runtime/protocol.ts", import.meta.url),
  "utf8"
);

assert.doesNotMatch(
  protocolSource,
  /\b(argv|stdout|stderr|payload|secret|secrets)\s*:/,
  "browser native-host protocol must not expose raw process output or secret fields"
);

assert.match(
  protocolSource,
  /command: copyNativeCommand\(input\.plan\.nativeCommand\)/,
  "browser native-host protocol must carry only copied typed DX command plans"
);

const nativeApiUsers = sourceFiles
  .filter((file) => {
    const source = readFileSync(file, "utf8");
    return /\b(sendNativeMessage|connectNative)\b/.test(source);
  })
  .map((file) => normalize(relative(sourceRoot, file)));

assert.deepEqual(
  nativeApiUsers,
  ["runtime/nativeHostTransport.ts"],
  "native messaging calls must stay inside the dedicated typed transport module"
);

const nativeTransportSource = readFileSync(
  new URL("../src/runtime/nativeHostTransport.ts", import.meta.url),
  "utf8"
);

assert.match(
  nativeTransportSource,
  /createNativeHostRequest/,
  "native transport must construct typed protocol requests"
);

assert.match(
  nativeTransportSource,
  /parseNativeHostResponse/,
  "native transport must parse typed protocol responses"
);

console.log("browser native execution surface verified");

function collectTypeScriptFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTypeScriptFiles(path));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(path);
    }
  }

  return files;
}

function normalize(path) {
  return path.replaceAll("\\", "/");
}
