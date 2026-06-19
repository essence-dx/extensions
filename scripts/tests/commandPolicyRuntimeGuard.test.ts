import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const policyPath = fileURLToPath(new URL("../command-policy.ps1", import.meta.url));

assertPolicyRejects(
  "cargo",
  ["test", "--workspace"],
  "Cargo heavy commands must include -j 1"
);
assertPolicyAllows("cargo", ["test", "-j", "1", "--workspace"]);
assertPolicyRejects(
  "npm",
  ["--workspaces", "run", "build"],
  "npm workspace fan-out is not allowed for heavy commands"
);
assertPolicyRejects(
  "npm",
  ["--workspace", "dx-browser", "run", "check:local"],
  "Use the root j1 wrapper for heavy workspace scripts."
);
assertPolicyAllows("npm", ["--workspace", "dx-browser", "run", "internal:check"]);
assertPolicyAllows("npm", ["run", "check:browser:j1"]);
assertPolicyAllows("npm", ["run", "check:vscode:j1"]);
assertPolicyAllows("npm", ["run", "build:browser:j1"]);
assertPolicyAllows("npm", ["run", "package:vscode:j1"]);

console.log("runtime command policy guard verified");

function assertPolicyAllows(filePath, args) {
  const result = runPolicy(filePath, args);

  assert.equal(
    result.status,
    0,
    `expected ${formatCommand(filePath, args)} to pass policy, got: ${combinedOutput(result)}`
  );
}

function assertPolicyRejects(filePath, args, expectedMessage) {
  const result = runPolicy(filePath, args);

  assert.notEqual(result.status, 0, `${formatCommand(filePath, args)} should be rejected`);
  assert.match(combinedOutput(result), new RegExp(escapeRegExp(expectedMessage)));
}

function runPolicy(filePath, args) {
  const command = [
    `. ${powerShellString(policyPath)}`,
    `Assert-DxCommandPolicy -FilePath ${powerShellString(filePath)} -Arguments ${powerShellArray(args)}`
  ].join("; ");

  return spawnSync(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
    {
      cwd: root,
      encoding: "utf8",
      windowsHide: true
    }
  );
}

function powerShellArray(values) {
  return `@(${values.map(powerShellString).join(", ")})`;
}

function powerShellString(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function combinedOutput(result) {
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

function formatCommand(filePath, args) {
  return [filePath, ...args].join(" ");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
