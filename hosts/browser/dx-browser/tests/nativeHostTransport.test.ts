import assert from "node:assert/strict";

const { resolveDxBrowserCommandPlan } = await import(
  "../dist/js/runtime/commandPlans.js"
);
const { sendNativeHostCommand, dxBrowserNativeHostName } = await import(
  "../dist/js/runtime/nativeHostTransport.js"
);

const sentMessages = [];
const runtime = {
  async sendNativeMessage(hostName, request) {
    sentMessages.push({ hostName, request });
    return {
      protocol: "dx.browser.native-host",
      version: 1,
      requestId: request.requestId,
      ok: true,
      receiptPath:
        ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
    };
  }
};

const response = await sendNativeHostCommand({
  runtime,
  plan: resolveDxBrowserCommandPlan("status"),
  context: {
    activeTabUrl: "https://example.test/workspace",
    activeTabTitle: "DX Workspace"
  },
  createRequestId: () => "req-status-transport"
});

assert.deepEqual(response, {
  protocol: "dx.browser.native-host",
  version: 1,
  requestId: "req-status-transport",
  ok: true,
  receiptPath:
    ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
});

assert.equal(sentMessages.length, 1, "transport should send one native message");
assert.equal(sentMessages[0].hostName, dxBrowserNativeHostName);
assert.deepEqual(
  sentMessages[0].request,
  {
    protocol: "dx.browser.native-host",
    version: 1,
    requestId: "req-status-transport",
    hostActionId: "dx.browser.show_status",
    operation: "dx.status",
    command: {
      executable: "dx",
      args: ["status"]
    },
    context: {
      activeTabUrl: "https://example.test/workspace",
      activeTabTitle: "DX Workspace"
    }
  },
  "transport should send only typed protocol request fields"
);

assert.equal(
  Object.prototype.hasOwnProperty.call(sentMessages[0].request, "args"),
  false,
  "transport request must not expose raw argv"
);

await sendNativeHostCommand({
  runtime,
  plan: resolveDxBrowserCommandPlan("forgePackages"),
  context: {},
  createRequestId: () => "req-forge-packages-transport"
});

assert.deepEqual(
  sentMessages[1].request.command,
  {
    executable: "dx",
    args: ["forge", "packages", "--json"]
  },
  "transport should send the fixed Forge packages command"
);

await sendNativeHostCommand({
  runtime,
  plan: resolveDxBrowserCommandPlan("showBuildGraph"),
  context: {},
  createRequestId: () => "req-build-graph-transport"
});

assert.deepEqual(
  sentMessages[2].request.command,
  {
    executable: "dx",
    args: ["graph", "--json"]
  },
  "transport should send the fixed build graph command"
);

await assert.rejects(
  () =>
    sendNativeHostCommand({
      runtime,
      plan: resolveDxBrowserCommandPlan("openReceipts"),
      context: {},
      createRequestId: () => "req-receipts-transport"
    }),
  /does not use the native host/,
  "host-ui plans must not be sent through native messaging"
);

await assert.rejects(
  () =>
    sendNativeHostCommand({
      runtime: {
        async sendNativeMessage() {
          return {
            protocol: "dx.browser.native-host",
            version: 1,
            requestId: "different-request",
            ok: true
          };
        }
      },
      plan: resolveDxBrowserCommandPlan("status"),
      context: {},
      createRequestId: () => "expected-request"
    }),
  /native-host response request id mismatch/,
  "transport should reject responses for a different request id"
);

console.log("browser native-host transport verified");
