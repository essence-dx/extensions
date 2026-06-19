import * as vscode from "vscode";

import { DxCli } from "../dx/cli";
import {
  createDxIconSearchCommandPlan,
  validateDxIconSearchQuery
} from "../dx/iconSearch";
import { runTrustedCommand } from "./runTrustedCommand";

export async function searchIcons(
  cli: DxCli,
  output: vscode.OutputChannel
): Promise<void> {
  const query = await vscode.window.showInputBox({
    title: "Search DX Icons",
    prompt: "Search the local DX icon index.",
    placeHolder: "home, arrow left, search",
    ignoreFocusOut: true,
    validateInput: validateDxIconSearchQuery
  });

  if (query === undefined) {
    return;
  }

  await runTrustedCommand(cli, output, createDxIconSearchCommandPlan(query));
}
