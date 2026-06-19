import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

import { validateTypescriptSourceExtensions } from "../validate-typescript-source-extensions.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-typescript-source-policy-"));

try {
  writeWorkspaceFile("src/neighbor.ts", "export const value = 1;\n");
  writeWorkspaceFile(
    "src/clean.ts",
    'import { value } from "./neighbor.ts";\nexport const clean = value;\n'
  );
  writeWorkspaceFile(
    "src/view.tsx",
    'import { value } from "./neighbor.ts";\nexport function View() { return <div>{value}</div>;\n}\n'
  );
  writeWorkspaceFile("dist/generated.js", "export const generated = true;\n");
  writeWorkspaceFile(
    "tests/generatedOutput.test.ts",
    'const output = await import("../dist/generated.js");\nassert.ok(output);\n'
  );

  assert.deepEqual(
    validateTypescriptSourceExtensions(workspaceRoot),
    [],
    "TypeScript source and generated JavaScript output references should pass"
  );

  writeWorkspaceFile("package.json", "{}\n");
  writeWorkspaceFile("package-lock.json", "{}\n");
  writeWorkspaceFile("hosts/browser/dx-browser/package.json", "{}\n");
  writeWorkspaceFile("hosts/unity/dx-unity-editor/package.json", "{}\n");
  writeWorkspaceFile("hosts/vscode/dx-vscode/package.json", "{}\n");
  writeWorkspaceFile("hosts/vscode/dx-vscode/tests/package.json", "{}\n");
  assert.deepEqual(
    validateTypescriptSourceExtensions(workspaceRoot),
    [],
    "approved package metadata boundaries should pass"
  );

  writeWorkspaceFile("hosts/adobe/dx-photoshop-uxp/package.json", "{}\n");
  writeWorkspaceFile("hosts/adobe/dx-photoshop-uxp/package-lock.json", "{}\n");
  assertMessages(validateTypescriptSourceExtensions(workspaceRoot), [
    "hosts/adobe/dx-photoshop-uxp/package.json is package metadata outside an approved npm package boundary",
    "hosts/adobe/dx-photoshop-uxp/package-lock.json is package metadata outside an approved npm package boundary"
  ]);

  rmSync(join(workspaceRoot, "hosts", "adobe", "dx-photoshop-uxp", "package.json"));
  rmSync(join(workspaceRoot, "hosts", "adobe", "dx-photoshop-uxp", "package-lock.json"));

  writeWorkspaceFile("src/legacy.js", "export const legacy = true;\n");
  assertMessages(validateTypescriptSourceExtensions(workspaceRoot), [
    "src/legacy.js must be converted to TypeScript"
  ]);

  rmSync(join(workspaceRoot, "src", "legacy.js"));
  writeWorkspaceFile("src/module.mjs", "export const moduleValue = true;\n");
  assertMessages(validateTypescriptSourceExtensions(workspaceRoot), [
    "src/module.mjs must be converted to TypeScript"
  ]);

  rmSync(join(workspaceRoot, "src", "module.mjs"));
  writeWorkspaceFile("src/common.cjs", "exports.commonValue = true;\n");
  assertMessages(validateTypescriptSourceExtensions(workspaceRoot), [
    "src/common.cjs must be converted to TypeScript"
  ]);

  rmSync(join(workspaceRoot, "src", "common.cjs"));
  writeWorkspaceFile("src/component.jsx", "export function Component() { return null; }\n");
  assertMessages(validateTypescriptSourceExtensions(workspaceRoot), [
    "src/component.jsx must be converted to TypeScript"
  ]);

  rmSync(join(workspaceRoot, "src", "component.jsx"));
  writeWorkspaceFile("src/module.mts", "export const moduleValue = true;\n");
  assertMessages(validateTypescriptSourceExtensions(workspaceRoot), [
    "src/module.mts must use .ts or .tsx for TypeScript source"
  ]);

  rmSync(join(workspaceRoot, "src", "module.mts"));
  writeWorkspaceFile("src/common.cts", "export const commonValue = true;\n");
  assertMessages(validateTypescriptSourceExtensions(workspaceRoot), [
    "src/common.cts must use .ts or .tsx for TypeScript source"
  ]);

  rmSync(join(workspaceRoot, "src", "common.cts"));
  writeWorkspaceFile(
    "src/legacyImport.ts",
    'import { value } from "./neighbor.js";\nexport const legacyImport = value;\n'
  );
  assertMessages(validateTypescriptSourceExtensions(workspaceRoot), [
    'src/legacyImport.ts imports "./neighbor.js"; source imports must use the TypeScript extension'
  ]);

  const gitWorkspaceRoot = mkdtempSync(join(tmpdir(), "dx-typescript-source-git-policy-"));
  try {
    writeWorkspaceFileAt(gitWorkspaceRoot, "dist/generated.js", "export const generated = true;\n");
    runGit(gitWorkspaceRoot, "init");
    runGit(gitWorkspaceRoot, "add", "dist/generated.js");
    assertMessages(validateTypescriptSourceExtensions(gitWorkspaceRoot), [
      "dist/generated.js is generated JavaScript output that must stay untracked and ignored"
    ]);
  } finally {
    rmSync(gitWorkspaceRoot, { recursive: true, force: true });
  }
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("TypeScript source extension policy verified");

function assertMessages(actualMessages: string[], expectedMessages: string[]): void {
  for (const message of expectedMessages) {
    assert.ok(
      actualMessages.includes(message),
      `expected validation message: ${message}\nactual: ${actualMessages.join("\n")}`
    );
  }
}

function writeWorkspaceFile(relativePath: string, source: string): void {
  writeWorkspaceFileAt(workspaceRoot, relativePath, source);
}

function writeWorkspaceFileAt(root: string, relativePath: string, source: string): void {
  const absolutePath = join(root, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);
}

function runGit(root: string, ...args: string[]): void {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true
  });

  assert.equal(result.status, 0, `${result.stderr}${result.stdout}`);
}
