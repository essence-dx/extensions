import * as vscode from "vscode";

import { DxCli } from "../dx/cli";
import { resolveDxCliCommandPlan } from "../dx/commandPlan";
import { runTrustedCommand } from "./runTrustedCommand";

export async function runDoctor(
  cli: DxCli,
  output: vscode.OutputChannel
): Promise<void> {
  await runTrustedCommand(cli, output, resolveDxCliCommandPlan("doctor"));
}
