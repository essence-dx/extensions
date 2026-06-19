import assert from "node:assert/strict";
import * as vscode from "vscode";

export async function run(): Promise<void> {
  const extensionId = readRequiredEnvironmentValue(
    "DX_VSCODE_SMOKE_EXTENSION_ID"
  );
  const expectedCommandIds = readExpectedCommandIds();
  const extension = vscode.extensions.getExtension(extensionId);

  assert.ok(extension, `expected extension to be loadable: ${extensionId}`);
  await extension.activate();

  const availableCommandIds = new Set(await vscode.commands.getCommands(true));
  for (const commandId of expectedCommandIds) {
    assert.ok(
      availableCommandIds.has(commandId),
      `expected loaded host to expose command: ${commandId}`
    );
  }

  assert.ok(
    vscode.workspace.workspaceFolders?.length,
    "expected loaded smoke to run inside an isolated workspace"
  );
}

function readExpectedCommandIds(): string[] {
  const rawValue = readRequiredEnvironmentValue(
    "DX_VSCODE_SMOKE_EXPECTED_COMMANDS"
  );
  const parsedValue = JSON.parse(rawValue) as unknown;

  assert.ok(Array.isArray(parsedValue), "expected command list should be an array");
  assert.ok(
    parsedValue.every((commandId) => typeof commandId === "string"),
    "expected command list should contain command strings"
  );

  return parsedValue;
}

function readRequiredEnvironmentValue(name: string): string {
  const value = process.env[name];
  assert.ok(value, `${name} must be set`);
  return value;
}
