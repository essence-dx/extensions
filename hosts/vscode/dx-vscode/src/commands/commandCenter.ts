import * as vscode from "vscode";

import { DxCli } from "../dx/cli";
import { listDxCommandPlans } from "../dx/commandPlan";
import type { DxCommandPlan } from "../dx/commandPlan";
import { dispatchCommandCenterPlan } from "./commandCenterDispatch";
import { runHostUiCommand as runHostUiCommandPlan } from "./runHostUiCommand";
import { runTrustedCommand } from "./runTrustedCommand";
import { searchIcons } from "./searchIcons";

type CommandCenterItem = vscode.QuickPickItem & {
  planId: string;
};

export async function openCommandCenter(
  cli: DxCli,
  output: vscode.OutputChannel
): Promise<void> {
  const commandItems: CommandCenterItem[] = listDxCommandPlans().map((plan) => ({
    label: plan.title,
    description: plan.description,
    planId: plan.id
  }));

  const selection = await vscode.window.showQuickPick(
    commandItems,
    { title: "DX Command Center" }
  );

  if (!selection) {
    return;
  }

  await dispatchCommandCenterPlan(selection.planId, {
    async runCliCommand(plan) {
      await runTrustedCommand(cli, output, plan);
    },
    async runHostUiCommand(plan) {
      await runHostUiCommandPlan(plan);
    },
    async runInputCommand(plan) {
      await runCommandCenterInputCommand(plan, cli, output);
    }
  });
}

async function runCommandCenterInputCommand(
  plan: DxCommandPlan,
  cli: DxCli,
  output: vscode.OutputChannel
): Promise<void> {
  switch (plan.input) {
    case "icon-query":
      await searchIcons(cli, output);
      return;
    default:
      throw new Error(`Unsupported DX command-center input: ${plan.input}`);
  }
}
