(function registerDxInDesignCommandPlans(global) {
  const { DX_INDESIGN_MESSAGES } = global.dxInDesignMessages;

  const DX_INDESIGN_COMMAND_PLANS = {
    showStatus: {
      messageType: DX_INDESIGN_MESSAGES.showStatus,
      operation: "dx.status",
      transport: "local-service",
      requiresRuntimeProof: true,
      mutatesInDesignDocument: false
    },
    searchAssets: {
      messageType: DX_INDESIGN_MESSAGES.searchAssets,
      operation: "dx.assets.search",
      transport: "local-service",
      requiresRuntimeProof: true,
      mutatesInDesignDocument: false
    },
    showReceipts: {
      messageType: DX_INDESIGN_MESSAGES.showReceipts,
      operation: "receipt.showPath",
      transport: "host-ui",
      requiresRuntimeProof: false,
      requiresLoadedHostProof: true,
      mutatesInDesignDocument: false
    }
  };

  function commandPlanForMessage(messageType) {
    return Object.values(DX_INDESIGN_COMMAND_PLANS).find(
      (plan) => plan.messageType === messageType
    );
  }

  global.dxInDesignCommandPlans = {
    DX_INDESIGN_COMMAND_PLANS,
    commandPlanForMessage
  };
})(globalThis);
