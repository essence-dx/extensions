import * as vscode from "vscode";

import { DxHostUiCommandPlan } from "../dx/commandPlan";
import {
  copyReceiptsPath as copyReceiptsPathWithHost,
  openReceiptsFolder as openReceiptsFolderWithHost
} from "./receiptActions";
import type { DxReceiptsHost } from "./receiptActions";

export async function openReceiptsFolder(plan: DxHostUiCommandPlan): Promise<void> {
  await openReceiptsFolderWithHost(createVsCodeReceiptsHost(plan));
}

export async function copyReceiptsPath(plan: DxHostUiCommandPlan): Promise<void> {
  await copyReceiptsPathWithHost(createVsCodeReceiptsHost(plan));
}

function createVsCodeReceiptsHost(plan: DxHostUiCommandPlan): DxReceiptsHost {
  return {
    isTrusted: !plan.requiresWorkspaceTrust || vscode.workspace.isTrusted,
    workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
    receiptsPath(workspaceRoot) {
      return vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), ".dx", "receipts").fsPath;
    },
    async receiptsDirectoryExistsAt(path) {
      try {
        const stat = await vscode.workspace.fs.stat(vscode.Uri.file(path));
        return (stat.type & vscode.FileType.Directory) === vscode.FileType.Directory;
      } catch {
        return false;
      }
    },
    async revealPath(path) {
      await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(path));
    },
    async copyText(text) {
      await vscode.env.clipboard.writeText(text);
    },
    showWarning(message) {
      vscode.window.showWarningMessage(message);
    },
    showError(message) {
      vscode.window.showErrorMessage(message);
    },
    showInformation(message) {
      vscode.window.showInformationMessage(message);
    }
  };
}
