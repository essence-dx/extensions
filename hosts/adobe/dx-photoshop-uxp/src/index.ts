(function registerDxPhotoshopPlugin(global) {
  const { entrypoints } = require("uxp");
  const { DX_PHOTOSHOP_MESSAGES, messageTypeForEntrypoint } = global.dxPhotoshopMessages;
  const { DX_PHOTOSHOP_COMMAND_PLANS, commandPlanForMessage } = global.dxPhotoshopCommandPlans;

  const serviceConnectionMessage = "DX service connection is not configured for this host.";
  const receiptPathMessage = "DX receipt path is available in this host.";

  function formatPlanNotice(plan) {
    const availabilityMessage = plan.requiresRuntimeProof
      ? serviceConnectionMessage
      : plan.requiresLoadedHostProof
        ? receiptPathMessage
        : "DX host action is available.";
    return `${plan.messageType}: ${plan.operation}. ${availabilityMessage}`;
  }

  function showNotice(message) {
    const output = document.querySelector("#dx-output");

    if (output) {
      output.textContent = message;
    }
  }

  function handleMessage(messageType) {
    const plan = commandPlanForMessage(messageType);

    if (!plan) {
      showNotice("Unknown DX command.");
      return;
    }

    showNotice(formatPlanNotice(plan));
  }

  function handleEntrypoint(entrypointId) {
    const messageType = messageTypeForEntrypoint(entrypointId);

    if (messageType) {
      handleMessage(messageType);
    }
  }

  function bindPanelControls(root) {
    const panelRoot = root ?? document;

    for (const button of panelRoot.querySelectorAll("[data-command]")) {
      button.addEventListener("click", () => {
        if (button.dataset.command === DX_PHOTOSHOP_MESSAGES.searchAssets) {
          runSearchFromPanel();
          return;
        }

        handleMessage(button.dataset.command);
      });
    }
  }

  function runSearchFromPanel() {
    const plan = DX_PHOTOSHOP_COMMAND_PLANS.searchAssets;
    const query = document.querySelector("[name='asset-query']")?.value?.trim() ?? "";
    const suffix = query ? ` Query: ${query}` : "";
    showNotice(`${formatPlanNotice(plan)}${suffix}`);
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindPanelControls(document);
  });

  entrypoints.setup({
    commands: {
      dxShowStatus() {
        handleEntrypoint("dxShowStatus");
      },
      dxShowReceipts() {
        handleEntrypoint("dxShowReceipts");
      }
    },
    panels: {
      dxCommandCenterPanel: {
        show(event) {
          bindPanelControls(event?.node);
          handleMessage(DX_PHOTOSHOP_MESSAGES.showStatus);
        }
      }
    }
  });
})(globalThis);
