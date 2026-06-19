(function registerDxInDesignMessages(global) {
  const DX_INDESIGN_MESSAGES = {
    showStatus: "dx.indesign.show_status",
    searchAssets: "dx.indesign.search_assets",
    showReceipts: "dx.indesign.show_receipts"
  };

  const DX_INDESIGN_ENTRYPOINTS = {
    panel: "dxCommandCenterPanel",
    showStatus: "dxShowStatus",
    showReceipts: "dxShowReceipts"
  };

  function messageTypeForEntrypoint(entrypointId) {
    if (entrypointId === DX_INDESIGN_ENTRYPOINTS.showStatus) {
      return DX_INDESIGN_MESSAGES.showStatus;
    }

    if (entrypointId === DX_INDESIGN_ENTRYPOINTS.showReceipts) {
      return DX_INDESIGN_MESSAGES.showReceipts;
    }

    return undefined;
  }

  global.dxInDesignMessages = {
    DX_INDESIGN_MESSAGES,
    DX_INDESIGN_ENTRYPOINTS,
    messageTypeForEntrypoint
  };
})(globalThis);
