import * as vscode from "vscode";

import { openCommandCenter } from "./commandCenter";
import { commandIds } from "./commandIds";
import { listForgePackages } from "./listForgePackages";
import { runHostUiCommand } from "./runHostUiCommand";
import { runDoctor } from "./runDoctor";
import { searchIcons } from "./searchIcons";
import { showBuildGraph } from "./showBuildGraph";
import { showCheckEditorState } from "./showCheckEditorState";
import { showLatestCheckReceipt } from "./showLatestCheckReceipt";
import { showStatus } from "./showStatus";
import { DxCli } from "../dx/cli";
import { resolveDxHostUiCommandPlan } from "../dx/commandPlan";

export function registerCommands(
  context: vscode.ExtensionContext,
  cli: DxCli,
  output: vscode.OutputChannel
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(commandIds.openCommandCenter, () =>
      openCommandCenter(cli, output)
    ),
    vscode.commands.registerCommand(commandIds.copyReceiptsPath, () =>
      runHostUiCommand(resolveDxHostUiCommandPlan("copyReceiptsPath"))
    ),
    vscode.commands.registerCommand(commandIds.doctor, () => runDoctor(cli, output)),
    vscode.commands.registerCommand(commandIds.listForgePackages, () =>
      listForgePackages(cli, output)
    ),
    vscode.commands.registerCommand(commandIds.openReceipts, () =>
      runHostUiCommand(resolveDxHostUiCommandPlan("openReceipts"))
    ),
    vscode.commands.registerCommand(commandIds.searchIcons, () =>
      searchIcons(cli, output)
    ),
    vscode.commands.registerCommand(commandIds.showBuildGraph, () =>
      showBuildGraph(cli, output)
    ),
    vscode.commands.registerCommand(commandIds.showCheckEditorState, () =>
      showCheckEditorState(cli, output)
    ),
    vscode.commands.registerCommand(commandIds.showLatestCheckReceipt, () =>
      showLatestCheckReceipt(cli, output)
    ),
    vscode.commands.registerCommand(commandIds.showStatus, () => showStatus(cli, output))
  );
}
