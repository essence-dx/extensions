(function registerDxPhotoshopMessages(global) {
  const DX_PHOTOSHOP_MESSAGES = {
    showStatus: "dx.photoshop.show_status",
    searchAssets: "dx.photoshop.search_assets",
    copyReceiptsPath: "dx.photoshop.copy_receipts_path"
  };

  const DX_PHOTOSHOP_ENTRYPOINTS = {
    panel: "dxCommandCenterPanel",
    showStatus: "dxShowStatus",
    showReceipts: "dxShowReceipts"
  };

  function messageTypeForEntrypoint(entrypointId) {
    if (entrypointId === DX_PHOTOSHOP_ENTRYPOINTS.showStatus) {
      return DX_PHOTOSHOP_MESSAGES.showStatus;
    }

    if (entrypointId === DX_PHOTOSHOP_ENTRYPOINTS.showReceipts) {
      return DX_PHOTOSHOP_MESSAGES.copyReceiptsPath;
    }

    return undefined;
  }

  global.dxPhotoshopMessages = {
    DX_PHOTOSHOP_MESSAGES,
    DX_PHOTOSHOP_ENTRYPOINTS,
    messageTypeForEntrypoint
  };
})(globalThis);
