import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = fileURLToPath(new URL("../src", import.meta.url));
const sourceFiles = collectTypeScriptFiles(sourceRoot);

const childProcessImporters = sourceFiles
  .filter((file) => readFileSync(file, "utf8").includes("node:child_process"))
  .map((file) => normalize(relative(sourceRoot, file)));

assert.deepEqual(
  childProcessImporters,
  ["dx/cli.ts"],
  "only the DX CLI bridge may import node:child_process"
);

for (const file of sourceFiles) {
  const relativePath = normalize(relative(sourceRoot, file));
  const source = readFileSync(file, "utf8");

  assert.doesNotMatch(source, /\bexec(File)?\s*\(/, `${relativePath} must not use exec`);
  assert.doesNotMatch(source, /\bspawnSync\s*\(/, `${relativePath} must not use spawnSync`);
  assert.doesNotMatch(source, /createTerminal\s*\(/, `${relativePath} must not create terminals`);
  assert.doesNotMatch(source, /shell:\s*true/, `${relativePath} must not enable shell execution`);
  assert.doesNotMatch(source, /cli\.run\s*\(\s*\[/, `${relativePath} must not pass raw argv to cli.run`);
  assert.doesNotMatch(
    source,
    /runTrustedCommand\s*\([^)]*\[[^\)]*\)/s,
    `${relativePath} must pass command plans to runTrustedCommand`
  );
}

const registerCommandsSource = readFileSync(
  new URL("../src/commands/registerCommands.ts", import.meta.url),
  "utf8"
);
assert.doesNotMatch(
  registerCommandsSource,
  /openReceiptsFolder\s*\(/,
  "registered commands should dispatch host-UI actions through command plans"
);
assert.doesNotMatch(
  registerCommandsSource,
  /copyReceiptsPath\s*\(/,
  "registered commands should dispatch copy-receipts host-UI actions through command plans"
);

const commandCenterSource = readFileSync(
  new URL("../src/commands/commandCenter.ts", import.meta.url),
  "utf8"
);
assert.doesNotMatch(
  commandCenterSource,
  /await\s+openReceiptsFolder\s*\(/,
  "command center should dispatch host-UI actions through command plans"
);
assert.doesNotMatch(
  commandCenterSource,
  /await\s+copyReceiptsPath\s*\(/,
  "command center should dispatch copy-receipts host-UI actions through command plans"
);
assert.doesNotMatch(
  commandCenterSource,
  /plan\.id\s*===\s*"searchIcons"/,
  "command center should route input commands through command-plan input metadata"
);

const cliSource = readFileSync(new URL("../src/dx/cli.ts", import.meta.url), "utf8");
assert.match(
  cliSource,
  /async run\s*\(\s*plan:\s*DxCliCommandPlan/,
  "DxCli.run must accept CLI command plans instead of raw argv or host-UI plans"
);

assert.match(
  cliSource,
  /plan\.input !== "none"/,
  "DxCli.run must reject command plans that still need host-side input"
);

console.log("command execution surface verified");

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
