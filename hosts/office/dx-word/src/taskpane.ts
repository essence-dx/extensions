import { DX_WORD_COMMAND_PLANS } from "./commandPlans";
import {
  createDxOfficeLocalServiceRequest,
  describeDxOfficeServiceConnectionNotice,
  isDxOfficeLocalServicePlan
} from "../../shared/localServiceBoundary";
import {
  DX_WORD_MESSAGES,
  isDxWordMessageType,
  type DxWordMessage
} from "./messages";

const DX_RECEIPTS_PATH = ".dx/receipts";
const WORD_API_SET = "WordApi";

Office.onReady((info) => {
  if (info.host !== Office.HostType.Word) {
    updateStatus("DX Word commands are only available in Word.");
    return;
  }

  bindCommandButtons();
});

function bindCommandButtons() {
  document.querySelectorAll<HTMLButtonElement>("[data-command]").forEach((button) => {
    button.addEventListener("click", () => {
      const command = button.dataset.command;
      if (!command || !isDxWordMessageType(command)) {
        updateStatus("DX command is not available.");
        return;
      }

      handleDxWordMessage({
        type: command,
        query: getAssetQuery()
      });
    });
  });
}

async function handleDxWordMessage(message: DxWordMessage) {
  if (message.type === DX_WORD_MESSAGES.copyReceiptsPath) {
    await copyReceiptsPath();
    return;
  }

  if (!Office.context.requirements.isSetSupported(WORD_API_SET, "1.1")) {
    updateStatus("WordApi 1.1 is required for DX document context.");
    return;
  }

  Office.context.document.getFilePropertiesAsync((result) => {
    const plan = Object.values(DX_WORD_COMMAND_PLANS).find(
      (candidate) => candidate.messageType === message.type
    );

    if (!plan || !isDxOfficeLocalServicePlan(plan)) {
      updateStatus("DX command plan is unavailable.");
      return;
    }

    const request = createDxOfficeLocalServiceRequest({
      host: "word",
      command: message.type,
      plan,
      query: message.query,
      context: {
        hostDocumentState: result.status === Office.AsyncResultStatus.Succeeded ? "loaded" : "unavailable"
      }
    });

    updateStatus(describeDxOfficeServiceConnectionNotice(request));
  });
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
