import { DX_EXCEL_COMMAND_PLANS } from "./commandPlans";
import {
  createDxOfficeLocalServiceRequest,
  describeDxOfficeServiceConnectionNotice,
  isDxOfficeLocalServicePlan
} from "../../shared/localServiceBoundary";
import {
  DX_EXCEL_MESSAGES,
  isDxExcelMessageType,
  type DxExcelMessage
} from "./messages";

const DX_RECEIPTS_PATH = ".dx/receipts";

Office.onReady((info) => {
  if (info.host !== Office.HostType.Excel) {
    updateStatus("DX Excel commands are only available in Excel.");
    return;
  }

  bindCommandButtons();
});

function bindCommandButtons() {
  document.querySelectorAll<HTMLButtonElement>("[data-command]").forEach((button) => {
    button.addEventListener("click", () => {
      const command = button.dataset.command;
      if (!command || !isDxExcelMessageType(command)) {
        updateStatus("DX command is not available.");
        return;
      }

      handleDxExcelMessage({
        type: command,
        query: getAssetQuery()
      });
    });
  });
}

async function handleDxExcelMessage(message: DxExcelMessage) {
  if (message.type === DX_EXCEL_MESSAGES.copyReceiptsPath) {
    await copyReceiptsPath();
    return;
  }

  const plan = Object.values(DX_EXCEL_COMMAND_PLANS).find(
    (candidate) => candidate.messageType === message.type
  );

  if (!plan || !isDxOfficeLocalServicePlan(plan)) {
    updateStatus("DX command plan is unavailable.");
    return;
  }

  const request = createDxOfficeLocalServiceRequest({
    host: "excel",
    command: message.type,
    plan,
    query: message.query,
    context: { hostDocumentState: "loaded" }
  });

  updateStatus(describeDxOfficeServiceConnectionNotice(request));
}

async function copyReceiptsPath() {
  await navigator.clipboard.writeText(DX_RECEIPTS_PATH);
  updateStatus("DX receipts path copied.");
}

function getAssetQuery() {
  const input = document.getElementById("asset-query");
  return input instanceof HTMLInputElement ? input.value : "";
}

function updateStatus(message: string) {
  const status = document.getElementById("dx-status");
  if (status) {
    status.textContent = message;
  }
}
