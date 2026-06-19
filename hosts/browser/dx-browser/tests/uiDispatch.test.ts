import assert from "node:assert/strict";

const { handleCommandCenterClick } = await import(
  "../dist/js/ui/commandDispatch.js"
);

const sentMessages = [];
const statuses = [];
const runtime = {
  async sendMessage(message) {
    sentMessages.push(message);
    return {
      ok: true,
      result: {
        commandId: message.commandId,
        handledBy: "native-host",
        receiptPath:
          ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
      }
    };
  }
};

await handleCommandCenterClick(createClickEvent("status"), {
  runtime,
  reportStatus(status) {
    statuses.push(status);
  },
  confirmCommand: () => {
    throw new Error("status should not ask for approval");
  }
});

assert.deepEqual(sentMessages, [
  {
    type: "dx.browser.command.invoke",
    commandId: "status"
  }
]);

assert.deepEqual(
  statuses,
  [
    {
      tone: "pending",
      message: "DX Status is running."
    },
    {
      tone: "success",
      message: "DX Status completed.",
      receiptPath:
        ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
    }
  ],
  "UI dispatch should report pending and successful command status"
);

await handleCommandCenterClick(createClickEvent("forgePackages"), {
  runtime,
  reportStatus(status) {
    statuses.push(status);
  },
  confirmCommand: () => {
    throw new Error("forgePackages should not ask for approval");
  }
});

assert.deepEqual(sentMessages[1], {
  type: "dx.browser.command.invoke",
  commandId: "forgePackages"
});
assert.deepEqual(
  statuses.at(-1),
  {
    tone: "success",
    message: "DX Forge Packages completed.",
    receiptPath:
      ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
  },
  "forge package commands should dispatch without approval and report success"
);

await handleCommandCenterClick(createClickEvent("showBuildGraph"), {
  runtime,
  reportStatus(status) {
    statuses.push(status);
  },
  confirmCommand: () => {
    throw new Error("showBuildGraph should not ask for approval");
  }
});

assert.deepEqual(sentMessages[2], {
  type: "dx.browser.command.invoke",
  commandId: "showBuildGraph"
});
assert.deepEqual(
  statuses.at(-1),
  {
    tone: "success",
    message: "DX Build Graph completed.",
    receiptPath:
      ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
  },
  "build graph commands should dispatch without approval and report success"
);

await handleCommandCenterClick(createClickEvent("doctor"), {
  runtime,
  reportStatus(status) {
    statuses.push(status);
  },
  confirmCommand: () => false
});

assert.equal(sentMessages.length, 3, "denied doctor should not send a message");
assert.deepEqual(
  statuses.at(-1),
  {
    tone: "info",
    message: "DX Doctor was not run."
  },
  "denied commands should report that no native-host work ran"
);

await handleCommandCenterClick(createClickEvent("doctor"), {
  runtime,
  reportStatus(status) {
    statuses.push(status);
  },
  confirmCommand: () => true
});

assert.deepEqual(sentMessages[3], {
  type: "dx.browser.command.invoke",
  commandId: "doctor",
  approved: true
});
assert.deepEqual(
  statuses.at(-1),
  {
    tone: "success",
    message: "DX Doctor completed.",
    receiptPath:
      ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
  },
  "approved privileged commands should report success"
);

const failureStatuses = [];
await handleCommandCenterClick(createClickEvent("status"), {
  runtime: {
    async sendMessage() {
      return {
        ok: false,
        error: "native host is not installed"
      };
    }
  },
  reportStatus(status) {
    failureStatuses.push(status);
  }
});

assert.deepEqual(
  failureStatuses,
  [
    {
      tone: "pending",
      message: "DX Status is running."
    },
    {
      tone: "error",
      message: "native host is not installed"
    }
  ],
  "background errors should be surfaced to the browser UI"
);

await assert.rejects(
  () =>
    handleCommandCenterClick(createClickEvent("forge"), {
      runtime,
      confirmCommand: () => true
    }),
  /Unsupported DX browser command plan/,
  "unknown UI command ids should be rejected"
);

await handleCommandCenterClick(createNonCommandClickEvent(), {
  runtime,
  confirmCommand: () => {
    throw new Error("non-command clicks should not ask for approval");
  }
});

assert.equal(
  sentMessages.length,
  4,
  "non-command clicks must not dispatch runtime messages"
);

await assert.rejects(
  () =>
    handleCommandCenterClick(createClickEvent("status"), {
      runtime: {
        async sendMessage() {
          throw new Error("runtime failed");
        }
      }
    }),
  /runtime failed/,
  "runtime dispatch errors must be visible to UI callers"
);

console.log("browser UI command dispatch verified");

function createClickEvent(commandId) {
  return {
    target: {
      closest(selector) {
        assert.equal(selector, "[data-command]");
        return {
          dataset: {
            command: commandId
          }
        };
      }
    }
  };
}

function createNonCommandClickEvent() {
  return {
    target: {
      closest(selector) {
        assert.equal(selector, "[data-command]");
        return null;
      }
    }
  };
}
