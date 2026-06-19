import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const workspaceRoot = join(import.meta.dirname, "..", "..");
const guardCommand = "node --experimental-strip-types ../../../scripts/require-root-j1-wrapper.ts && ";

const hostPackages = [
  {
    path: "hosts/browser/dx-browser/package.json",
    publicScripts: {
      check: "npm --prefix ../../.. run check:browser:j1",
      "build:artifacts": "npm --prefix ../../.. run build:browser:j1",
      build: "npm --prefix ../../.. run build:browser:j1"
    },
    internalScripts: ["internal:check", "internal:build:artifacts"],
    forbiddenScripts: ["check:local", "build:artifacts:local", "package:local"]
  },
  {
    path: "hosts/vscode/dx-vscode/package.json",
    publicScripts: {
      check: "npm --prefix ../../.. run check:vscode:j1",
      package: "npm --prefix ../../.. run package:vscode:j1"
    },
    internalScripts: ["internal:check"],
    forbiddenScripts: ["check:local", "build:artifacts:local", "package:local"]
  }
];

for (const hostPackage of hostPackages) {
  const manifest = readJson(join(workspaceRoot, hostPackage.path));
  const scripts = manifest.scripts ?? {};

  for (const [name, command] of Object.entries(hostPackage.publicScripts)) {
    assert.equal(
      scripts[name],
      command,
      `${hostPackage.path} script ${name} must delegate to the root j1 wrapper`
    );
  }

  for (const name of hostPackage.internalScripts) {
    assert.ok(scripts[name], `${hostPackage.path} must define ${name}`);
    assert.ok(
      scripts[name].startsWith(guardCommand),
      `${hostPackage.path} script ${name} must require the root j1 wrapper guard`
    );
  }

  for (const name of hostPackage.forbiddenScripts) {
    assert.equal(scripts[name], undefined, `${hostPackage.path} must not expose ${name}`);
  }
}

assertGuardScriptRejectsDirectRuns();
assertGuardScriptAllowsRootWrapperRuns();

console.log("host package script policy verified");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function assertGuardScriptRejectsDirectRuns() {
  const result = runGuardScript({});

  assert.notEqual(result.status, 0, "root wrapper guard must reject direct host script runs");
  assert.match(combinedOutput(result), /Use the root j1 wrapper for heavy workspace scripts\./);
}

function assertGuardScriptAllowsRootWrapperRuns() {
  const result = runGuardScript({ DX_EXTENSIONS_J1_WRAPPER: "1" });

  assert.equal(
    result.status,
    0,
    `root wrapper guard must pass when the wrapper marker is present: ${combinedOutput(result)}`
  );
}

function runGuardScript(env) {
  const childEnv = { ...process.env };
  delete childEnv.DX_EXTENSIONS_J1_WRAPPER;

  return spawnSync(
    process.execPath,
    ["--experimental-strip-types", "scripts/require-root-j1-wrapper.ts"],
    {
      cwd: workspaceRoot,
      encoding: "utf8",
      env: { ...childEnv, ...env },
      windowsHide: true
    }
  );
}

function combinedOutput(result) {
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}
