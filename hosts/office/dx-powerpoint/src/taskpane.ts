import { DX_POWERPOINT_COMMAND_PLANS } from "./commandPlans";
import {
  createDxOfficeLocalServiceRequest,
  describeDxOfficeServiceConnectionNotice,
  isDxOfficeLocalServicePlan
} from "../../shared/localServiceBoundary";
import {
  DX_POWERPOINT_MESSAGES,
  isDxPowerPointMessageType,
  type DxPowerPointMessage
} from "./messages";

const DX_RECEIPTS_PATH = ".dx/receipts";
const POWERPOINT_API_SET = "PowerPointApi";

Office.onReady((info) => {
  if (info.host !== Office.HostType.PowerPoint) {
    updateStatus("DX PowerPoint commands are only available in PowerPoint.");
    return;
  }

  bindCommandButtons();
});

function bindCommandButtons() {
  document.querySelectorAll<HTMLButtonElement>("[data-command]").forEach((button) => {
    button.addEventListener("click", () => {
      const command = button.dataset.command;
      if (!command || !isDxPowerPointMessageType(command)) {
        updateStatus("DX command is not available.");
        return;
      }

      handleDxPowerPointMessage({
        type: command,
        query: getMediaQuery()
      });
    });
  });
}

async function handleDxPowerPointMessage(message: DxPowerPointMessage) {
  if (message.type === DX_POWERPOINT_MESSAGES.copyReceiptsPath) {
    await copyReceiptsPath();
    return;
  }

  if (!Office.context.requirements.isSetSupported(POWERPOINT_API_SET, "1.1")) {
    updateStatus("PowerPointApi 1.1 is required for DX presentation context.");
    return;
  }

  Office.context.document.getFilePropertiesAsync((result) => {
    const plan = Object.values(DX_POWERPOINT_COMMAND_PLANS).find(
      (candidate) => candidate.messageType === message.type
    );

    if (!plan || !isDxOfficeLocalServicePlan(plan)) {
      updateStatus("DX command plan is unavailable.");
      return;
    }

    const request = createDxOfficeLocalServiceRequest({
      host: "powerpoint",
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

function getMediaQuery() {
  const input = document.getElementById("media-query");
  return input instanceof HTMLInputElement ? input.value : "";
}

function updateStatus(message: string) {
  const status = document.getElementById("dx-status");
  if (status) {
    status.textContent = message;
  }
}
