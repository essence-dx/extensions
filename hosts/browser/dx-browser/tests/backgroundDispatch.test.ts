import assert from "node:assert/strict";

const {
  createDxBrowserRuntimeMessageListener,
  dispatchDxBrowserCommandMessage
} = await import(
  "../dist/js/background/common.js"
);
const { createDxBrowserCommandMessage } = await import(
  "../dist/js/runtime/messages.js"
);
const { resolveDxBrowserCommandPlan } = await import(
  "../dist/js/runtime/commandPlans.js"
);

const nativeMessages = [];
let receiptOpenCount = 0;
const trustedSender = {
  id: "dx-browser-test-extension",
  url: "chrome-extension://dx-browser-test-extension/static/popup.html"
};
const contentScriptSender = {
  id: "dx-browser-test-extension",
  url: "https://example.test/current",
  tab: {
    id: 1,
    url: "https://example.test/current"
  }
};

const dependencies = {
  nativeRuntime: {
    async sendNativeMessage(hostName, request) {
      nativeMessages.push({ hostName, request });
      return {
        protocol: "dx.browser.native-host",
        version: 1,
        requestId: request.requestId,
        ok: true,
        receiptPath:
          ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
      };
    }
  },
  hostUi: {
    async openReceipts() {
      receiptOpenCount += 1;
    }
  },
  readActiveTabContext() {
    return {
      activeTabUrl: "https://example.test/current",
      activeTabTitle: "Current DX Page"
    };
  },
  createRequestId() {
    return "req-background-dispatch";
  },
  extensionOrigin: "chrome-extension://dx-browser-test-extension"
};

const statusResult = await dispatchDxBrowserCommandMessage(
  createDxBrowserCommandMessage(resolveDxBrowserCommandPlan("status")),
  dependencies
);

assert.equal(statusResult.commandId, "status");
assert.equal(statusResult.handledBy, "native-host");
assert.equal(nativeMessages.length, 1, "status should contact the native host once");
assert.equal(nativeMessages[0].request.hostActionId, "dx.browser.show_status");
assert.deepEqual(nativeMessages[0].request.command, {
  executable: "dx",
  args: ["status"]
});
assert.deepEqual(nativeMessages[0].request.context, {
  activeTabUrl: "https://example.test/current",
  activeTabTitle: "Current DX Page"
});

await assert.rejects(
  () =>
    dispatchDxBrowserCommandMessage(
      createDxBrowserCommandMessage(resolveDxBrowserCommandPlan("doctor")),
      dependencies
    ),
  /requires user approval/,
  "doctor should not run without approval"
);
assert.equal(nativeMessages.length, 1, "denied doctor must not contact native host");

const doctorResult = await dispatchDxBrowserCommandMessage(
  createDxBrowserCommandMessage(resolveDxBrowserCommandPlan("doctor"), true),
  dependencies
);

assert.equal(doctorResult.commandId, "doctor");
assert.equal(doctorResult.handledBy, "native-host");
assert.equal(nativeMessages.length, 2, "approved doctor should contact native host");
assert.equal(nativeMessages[1].request.hostActionId, "dx.browser.run_doctor");
assert.deepEqual(nativeMessages[1].request.command, {
  executable: "dx",
  args: ["doctor"]
});

const forgePackagesResult = await dispatchDxBrowserCommandMessage(
  createDxBrowserCommandMessage(resolveDxBrowserCommandPlan("forgePackages")),
  dependencies
);

assert.equal(forgePackagesResult.commandId, "forgePackages");
assert.equal(forgePackagesResult.handledBy, "native-host");
assert.equal(nativeMessages.length, 3, "forgePackages should contact native host");
assert.equal(
  nativeMessages[2].request.hostActionId,
  "dx.browser.list_forge_packages"
);
assert.deepEqual(nativeMessages[2].request.command, {
  executable: "dx",
  args: ["forge", "packages", "--json"]
});

const buildGraphResult = await dispatchDxBrowserCommandMessage(
  createDxBrowserCommandMessage(resolveDxBrowserCommandPlan("showBuildGraph")),
  dependencies
);

assert.equal(buildGraphResult.commandId, "showBuildGraph");
assert.equal(buildGraphResult.handledBy, "native-host");
assert.equal(nativeMessages.length, 4, "showBuildGraph should contact native host");
assert.equal(nativeMessages[3].request.hostActionId, "dx.browser.show_build_graph");
assert.deepEqual(nativeMessages[3].request.command, {
  executable: "dx",
  args: ["graph", "--json"]
});

const receiptsResult = await dispatchDxBrowserCommandMessage(
  createDxBrowserCommandMessage(resolveDxBrowserCommandPlan("openReceipts")),
  dependencies
);

assert.equal(receiptsResult.commandId, "openReceipts");
assert.equal(receiptsResult.handledBy, "host-ui");
assert.equal(receiptOpenCount, 1, "openReceipts should call host UI");
assert.equal(nativeMessages.length, 4, "openReceipts must not contact native host");

const listenerResponses = [];
const listener = createDxBrowserRuntimeMessageListener(dependencies);
const listenerResult = listener(
  createDxBrowserCommandMessage(resolveDxBrowserCommandPlan("status")),
  trustedSender,
  (response) => {
    listenerResponses.push(response);
  }
);

assert.equal(
  listenerResult,
  true,
  "runtime listener should keep the browser message channel open"
);

await waitFor(() => listenerResponses.length === 1);
assert.deepEqual(listenerResponses[0], {
  ok: true,
  result: {
    commandId: "status",
    handledBy: "native-host",
    receiptPath:
      ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
  }
});

const deniedResponses = [];
const deniedResult = listener(
  createDxBrowserCommandMessage(resolveDxBrowserCommandPlan("status")),
  contentScriptSender,
  (response) => {
    deniedResponses.push(response);
  }
);

assert.equal(
  deniedResult,
  true,
  "runtime listener should keep the browser message channel open for sender errors"
);

await waitFor(() => deniedResponses.length === 1);
assert.deepEqual(deniedResponses[0], {
  ok: false,
  error: "DX browser command sender is not trusted."
});
assert.equal(
  nativeMessages.length,
  5,
  "untrusted sender must not contact the native host"
);

const receiptCountBeforeDeniedSender = receiptOpenCount;
const deniedHostUiResponses = [];
listener(
  createDxBrowserCommandMessage(resolveDxBrowserCommandPlan("openReceipts")),
  contentScriptSender,
  (response) => {
    deniedHostUiResponses.push(response);
  }
);

await waitFor(() => deniedHostUiResponses.length === 1);
assert.deepEqual(deniedHostUiResponses[0], {
  ok: false,
  error: "DX browser command sender is not trusted."
});
assert.equal(
  receiptOpenCount,
  receiptCountBeforeDeniedSender,
  "untrusted sender must not call host UI actions"
);

const missingSenderResponses = [];
listener(
  createDxBrowserCommandMessage(resolveDxBrowserCommandPlan("status")),
  undefined,
  (response) => {
    missingSenderResponses.push(response);
  }
);

await waitFor(() => missingSenderResponses.length === 1);
assert.deepEqual(missingSenderResponses[0], {
  ok: false,
  error: "DX browser command sender is not trusted."
});

await assert.rejects(
  () =>
    dispatchDxBrowserCommandMessage(
      {
        type: "dx.browser.command.invoke",
        commandId: "forge"
      },
      dependencies
    ),
  /Unsupported DX browser command plan/,
  "unknown command ids must be rejected"
);

console.log("browser background command dispatch verified");

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  assert.fail("condition was not met before timeout");
}
