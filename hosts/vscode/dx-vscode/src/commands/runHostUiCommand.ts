import { DxHostUiCommandPlan } from "../dx/commandPlan";
import { copyReceiptsPath, openReceiptsFolder } from "./openReceipts";

export async function runHostUiCommand(plan: DxHostUiCommandPlan): Promise<void> {
  switch (plan.hostActionId) {
    case "dx.vscode.open_receipts":
      await openReceiptsFolder(plan);
      return;
    case "dx.vscode.copy_receipts_path":
      await copyReceiptsPath(plan);
      return;
    default:
      throw new Error(`Unsupported DX host-UI command: ${plan.hostActionId}`);
  }
}
