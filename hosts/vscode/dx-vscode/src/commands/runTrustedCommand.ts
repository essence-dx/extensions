import * as vscode from "vscode";

import { DxCli } from "../dx/cli";
import { DxCliCommandPlan } from "../dx/commandPlan";

export async function runTrustedCommand(
  cli: DxCli,
  output: vscode.OutputChannel,
  plan: DxCliCommandPlan
): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (plan.requiresWorkspaceTrust && !vscode.workspace.isTrusted) {
    vscode.window.showWarningMessage(
      "DX command execution requires workspace trust."
    );
    return;
  }

  if (plan.requiresWorkspaceTrust && !workspaceFolder) {
    vscode.window.showWarningMessage(
      "Open a workspace before running DX commands."
    );
    return;
  }

  if (plan.requiresUserApproval) {
    const selection = await vscode.window.showWarningMessage(
      `${plan.title} will run the local DX CLI in this workspace.`,
      { modal: true },
      "Run"
    );

    if (selection !== "Run") {
      return;
    }
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: plan.title,
      cancellable: true
    },
    async (_progress, token) => {
      const result = await cli.run(plan, { token, title: plan.title });

      if (result.exitCode !== 0) {
        vscode.window.showErrorMessage(
          `${plan.title} exited with ${result.exitCode}.`
        );
      }
    }
  );
}
