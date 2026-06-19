(function registerDxPremiereCommandPlans(global) {
  const { DX_PREMIERE_MESSAGES } = global.dxPremiereMessages;

  const DX_PREMIERE_COMMAND_PLANS = {
    showStatus: {
      messageType: DX_PREMIERE_MESSAGES.showStatus,
      operation: "dx.status",
      transport: "local-service",
      requiresRuntimeProof: true,
      mutatesPremiereProject: false
    },
    searchMediaAssets: {
      messageType: DX_PREMIERE_MESSAGES.searchMediaAssets,
      operation: "dx.media.search",
      transport: "local-service",
      requiresRuntimeProof: true,
      mutatesPremiereProject: false
    },
    showReceipts: {
      messageType: DX_PREMIERE_MESSAGES.showReceipts,
      operation: "receipt.showPath",
      transport: "host-ui",
      requiresRuntimeProof: false,
      requiresLoadedHostProof: true,
      mutatesPremiereProject: false
    }
  };

  function commandPlanForMessage(messageType) {
    return Object.values(DX_PREMIERE_COMMAND_PLANS).find(
      (plan) => plan.messageType === messageType
    );
  }

  global.dxPremiereCommandPlans = {
    DX_PREMIERE_COMMAND_PLANS,
    commandPlanForMessage
  };
})(globalThis);
