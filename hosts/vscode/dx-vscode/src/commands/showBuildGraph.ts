import * as vscode from "vscode";

import { DxCli } from "../dx/cli";
import { resolveDxCliCommandPlan } from "../dx/commandPlan";
import { runTrustedCommand } from "./runTrustedCommand";

export async function showBuildGraph(
  cli: DxCli,
  output: vscode.OutputChannel
): Promise<void> {
  await runTrustedCommand(cli, output, resolveDxCliCommandPlan("showBuildGraph"));
}
