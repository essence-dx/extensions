import {
  DX_FIGMA_COMMAND_PLANS,
  isKnownDxFigmaMessage
} from "./commandPlans";
import {
  DX_FIGMA_MESSAGES,
  isDxFigmaUiMessage,
  messageTypeForMenuCommand,
  type DxFigmaMessage
} from "./messages";

const DX_RECEIPTS_PATH = ".dx/receipts";

figma.showUI(__html__, {
  width: 360,
  height: 440,
  themeColors: true
});

figma.ui.onmessage = (message: unknown) => {
  if (!isDxFigmaUiMessage(message)) {
    figma.notify("DX Figma message is invalid.");
    return;
  }

  handleDxFigmaMessage(message);
};

const menuMessageType = messageTypeForMenuCommand(figma.command);
if (menuMessageType) {
  handleDxFigmaMessage({ type: menuMessageType });
}

function handleDxFigmaMessage(message: DxFigmaMessage) {
  if (!isKnownDxFigmaMessage(message.type)) {
    figma.notify("DX command is not available.");
    return;
  }

  if (message.type === DX_FIGMA_MESSAGES.copyReceiptsPath) {
    figma.ui.postMessage({
      type: "dx.figma.receipts_path",
      message: DX_RECEIPTS_PATH
    });
    return;
  }

  const plan = Object.values(DX_FIGMA_COMMAND_PLANS).find(
    (candidate) => candidate.messageType === message.type
  );

  if (!plan?.requiresRuntimeProof) {
    figma.notify("DX command plan is unavailable.");
    return;
  }

  figma.notify("DX service connection is not configured for this host.");
}
