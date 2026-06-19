import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { validateNativeHostCommandBoundary } from "../validate-native-host-command-boundary.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-native-host-boundary-"));

try {
  writeFixture(workspaceRoot, validFixture());
  assert.deepEqual(
    validateNativeHostCommandBoundary(workspaceRoot),
    [],
    "complete native-host command boundary should pass"
  );

  writeFixture(
    workspaceRoot,
    replaceFixtureSource(
      validFixture(),
      "hosts/browser/dx-browser/src/runtime/commandPlans.ts",
      'args: ["status"]',
      'args: ["status", "--raw"]'
    )
  );
  assertMessages(validateNativeHostCommandBoundary(workspaceRoot), [
    "browser status command plan must map to dx status"
  ]);

  writeFixture(
    workspaceRoot,
    replaceFixtureSource(
      validFixture(),
      "hosts/browser/dx-browser/src/runtime/commandPlans.ts",
      'args: ["forge", "packages", "--json"]',
      'args: ["forge", "packages"]'
    )
  );
  assertMessages(validateNativeHostCommandBoundary(workspaceRoot), [
    "browser forgePackages command plan must map to dx forge packages --json"
  ]);

  writeFixture(
    workspaceRoot,
    replaceFixtureSource(
      validFixture(),
      "crates/dx-browser-native-host/src/host.rs",
      'vec!["doctor".to_string()]',
      'vec!["doctor".to_string(), "--raw".to_string()]'
    )
  );
  assertMessages(validateNativeHostCommandBoundary(workspaceRoot), [
    "native host doctor command plan must map to dx doctor"
  ]);

  writeFixture(
    workspaceRoot,
    replaceFixtureSource(
      validFixture(),
      "crates/dx-browser-native-host/src/host.rs",
      'vec!["graph".to_string(), "--json".to_string()]',
      'vec!["graph".to_string()]'
    )
  );
  assertMessages(validateNativeHostCommandBoundary(workspaceRoot), [
    "native host showBuildGraph command plan must map to dx graph --json"
  ]);

  writeFixture(
    workspaceRoot,
    replaceFixtureSource(
      validFixture(),
      "crates/dx-browser-native-host/src/command.rs",
      "Command::new(&self.binary_path)",
      'Command::new("powershell")'
    )
  );
  assertMessages(validateNativeHostCommandBoundary(workspaceRoot), [
    "native host command runner must execute the configured dx.exe directly",
    "native host command runner must not invoke shell, build, or package executables"
  ]);
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("native-host command boundary verified");

function assertMessages(actualMessages, expectedMessages) {
  for (const message of expectedMessages) {
    assert.ok(
      actualMessages.includes(message),
      `expected validation message: ${message}\nactual: ${actualMessages.join("\n")}`
    );
  }
}

function writeFixture(root, fixture) {
  for (const [relativePath, source] of Object.entries(fixture)) {
    const absolutePath = join(root, ...relativePath.split("/"));
    mkdirSync(join(absolutePath, ".."), { recursive: true });
    writeFileSync(absolutePath, source);
  }
}

function replaceFixtureSource(fixture, relativePath, searchValue, replacement) {
  return {
    ...fixture,
    [relativePath]: fixture[relativePath].replace(searchValue, replacement)
  };
}

function validFixture() {
  return {
    "crates/dx-browser-native-host/src/command.rs": [
      "Command::new(&self.binary_path)",
      ".args(&command.args)",
      ".stdin(Stdio::null())",
      ".stdout(Stdio::null())",
      ".stderr(Stdio::null())",
      "child.kill()",
      "child.wait()",
      'Some("dx.exe")',
      "is_allowlisted_command"
    ].join("\n"),
    "crates/dx-browser-native-host/src/protocol.rs": [
      "pub struct NativeHostRequest {",
      "    pub command: DxCliCommand,",
      "}",
      "pub struct DxCliCommand {",
      "    pub executable: String,",
      "    pub args: Vec<String>,",
      "}"
    ].join("\n"),
    "crates/dx-browser-native-host/src/host.rs": [
      'DxCliCommand::new("dx", vec!["status".to_string()])',
      'DxCliCommand::new("dx", vec!["doctor".to_string()])',
      'DxCliCommand::new("dx", vec!["forge".to_string(), "packages".to_string(), "--json".to_string()])',
      'DxCliCommand::new("dx", vec!["graph".to_string(), "--json".to_string()])',
      "validate_dx_cli_command"
    ].join("\n"),
    "hosts/browser/dx-browser/src/runtime/commandPlans.ts": [
      'id: "status",',
      "nativeCommand: {",
      '  executable: "dx",',
      '  args: ["status"]',
      "}",
      'id: "doctor",',
      "nativeCommand: {",
      '  executable: "dx",',
      '  args: ["doctor"]',
      "}",
      'id: "forgePackages",',
      "nativeCommand: {",
      '  executable: "dx",',
      '  args: ["forge", "packages", "--json"]',
      "}",
      'id: "showBuildGraph",',
      "nativeCommand: {",
      '  executable: "dx",',
      '  args: ["graph", "--json"]',
      "}",
      "openReceipts: {"
    ].join("\n"),
    "hosts/browser/dx-browser/src/runtime/protocol.ts": [
      "command: copyNativeCommand(input.plan.nativeCommand)",
      "DxBrowserNativeCommand",
      "Native-host command args must not contain shell control characters."
    ].join("\n")
  };
}
