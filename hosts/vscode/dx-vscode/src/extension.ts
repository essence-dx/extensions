import * as vscode from "vscode";

import { registerCommands } from "./commands/registerCommands";
import { DxCli } from "./dx/cli";
import { readDxConfiguration } from "./dx/configuration";

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("DX");
  const cli = new DxCli(() => readDxConfiguration(), output);

  context.subscriptions.push(output);
  registerCommands(context, cli, output);
}

export function deactivate(): void {
  // No background service is started by the initial bridge.
}
