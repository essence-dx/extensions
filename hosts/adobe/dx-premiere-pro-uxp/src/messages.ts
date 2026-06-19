(function registerDxPremiereMessages(global) {
  const DX_PREMIERE_MESSAGES = {
    showStatus: "dx.premiere-pro.show_status",
    searchMediaAssets: "dx.premiere-pro.search_media_assets",
    showReceipts: "dx.premiere-pro.show_receipts"
  };

  const DX_PREMIERE_ENTRYPOINTS = {
    panel: "dxCommandCenterPanel",
    showStatus: "dxShowStatus",
    showReceipts: "dxShowReceipts"
  };

  function messageTypeForEntrypoint(entrypointId) {
    if (entrypointId === DX_PREMIERE_ENTRYPOINTS.showStatus) {
      return DX_PREMIERE_MESSAGES.showStatus;
    }

    if (entrypointId === DX_PREMIERE_ENTRYPOINTS.showReceipts) {
      return DX_PREMIERE_MESSAGES.showReceipts;
    }

    return undefined;
  }

  global.dxPremiereMessages = {
    DX_PREMIERE_MESSAGES,
    DX_PREMIERE_ENTRYPOINTS,
    messageTypeForEntrypoint
  };
})(globalThis);
