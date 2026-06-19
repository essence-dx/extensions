import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

import { validateGeneratedOutputIgnore } from "../validate-generated-output-ignore.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-generated-output-ignore-"));
const contracts = [
  {
    ignoredPath: "hosts/example/dist/main.js",
    trackedPathspec: ":(glob)hosts/example/dist/**"
  },
  {
    ignoredPath: "hosts/example/plugin.js",
    trackedPathspec: "hosts/example/plugin.js"
  }
];

try {
  writeWorkspaceFile(".gitignore", "**/dist/\nhosts/example/plugin.js\n");
  runGit("init");

  assert.deepEqual(
    validateGeneratedOutputIgnore(workspaceRoot, contracts),
    [],
    "ignored and untracked generated outputs should pass"
  );

  writeWorkspaceFile("hosts/example/unignored.js", "export const output = true;\n");
  assertMessages(
    validateGeneratedOutputIgnore(workspaceRoot, [
      {
        ignoredPath: "hosts/example/unignored.js",
        trackedPathspec: "hosts/example/unignored.js"
      }
    ]),
    ["hosts/example/unignored.js must be ignored generated output"]
  );

  writeWorkspaceFile("hosts/example/plugin.js", "export const plugin = true;\n");
  runGit("add", "-f", "hosts/example/plugin.js");
  assertMessages(validateGeneratedOutputIgnore(workspaceRoot, contracts), [
    "hosts/example/plugin.js must not be tracked generated output"
  ]);
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("generated output ignore policy verified");

function assertMessages(actualMessages: string[], expectedMessages: string[]): void {
  for (const message of expectedMessages) {
    assert.ok(
      actualMessages.includes(message),
      `expected validation message: ${message}\nactual: ${actualMessages.join("\n")}`
    );
  }
}

function writeWorkspaceFile(relativePath: string, source: string): void {
  const absolutePath = join(workspaceRoot, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);
}

function runGit(...args: string[]): void {
  const result = spawnSync("git", args, {
    cwd: workspaceRoot,
    encoding: "utf8",
    windowsHide: true
  });

  assert.equal(result.status, 0, `${result.stderr}${result.stdout}`);
}
