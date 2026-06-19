(function registerDxPhotoshopCommandPlans(global) {
  const { DX_PHOTOSHOP_MESSAGES } = global.dxPhotoshopMessages;

  const DX_PHOTOSHOP_COMMAND_PLANS = {
    showStatus: {
      messageType: DX_PHOTOSHOP_MESSAGES.showStatus,
      operation: "dx.status",
      transport: "local-service",
      requiresRuntimeProof: true
    },
    searchAssets: {
      messageType: DX_PHOTOSHOP_MESSAGES.searchAssets,
      operation: "dx.assets.search",
      transport: "local-service",
      requiresRuntimeProof: true
    },
    copyReceiptsPath: {
      messageType: DX_PHOTOSHOP_MESSAGES.copyReceiptsPath,
      operation: "receipt.copyPath",
      transport: "host-ui",
      requiresRuntimeProof: false,
      requiresLoadedHostProof: true
    }
  };

  function commandPlanForMessage(messageType) {
    return Object.values(DX_PHOTOSHOP_COMMAND_PLANS).find(
      (plan) => plan.messageType === messageType
    );
  }

  global.dxPhotoshopCommandPlans = {
    DX_PHOTOSHOP_COMMAND_PLANS,
    commandPlanForMessage
  };
})(globalThis);
