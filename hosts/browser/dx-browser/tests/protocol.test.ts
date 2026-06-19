import assert from "node:assert/strict";

const { createNativeHostRequest, parseNativeHostResponse } = await import(
  "../dist/js/runtime/protocol.js"
);
const { resolveDxBrowserCommandPlan } = await import(
  "../dist/js/runtime/commandPlans.js"
);

const statusRequest = createNativeHostRequest({
  requestId: "req-status-1",
  plan: resolveDxBrowserCommandPlan("status"),
  context: {
    activeTabUrl: "https://example.test/docs",
    activeTabTitle: "DX Docs"
  }
});

assert.deepEqual(
  statusRequest,
  {
    protocol: "dx.browser.native-host",
    version: 1,
    requestId: "req-status-1",
    hostActionId: "dx.browser.show_status",
    operation: "dx.status",
    command: {
      executable: "dx",
      args: ["status"]
    },
    context: {
      activeTabUrl: "https://example.test/docs",
      activeTabTitle: "DX Docs"
    }
  },
  "native-host requests should carry a typed DX command plan and page context"
);

const forgePackagesRequest = createNativeHostRequest({
  requestId: "req-forge-packages-1",
  plan: resolveDxBrowserCommandPlan("forgePackages"),
  context: {
    activeTabUrl: "https://example.test/forge",
    activeTabTitle: "DX Forge"
  }
});

assert.deepEqual(
  forgePackagesRequest.command,
  {
    executable: "dx",
    args: ["forge", "packages", "--json"]
  },
  "forge package requests should carry the fixed shell-free DX argv plan"
);

assert.equal(
  forgePackagesRequest.hostActionId,
  "dx.browser.list_forge_packages",
  "forge package requests should carry the browser host action id"
);

const buildGraphRequest = createNativeHostRequest({
  requestId: "req-build-graph-1",
  plan: resolveDxBrowserCommandPlan("showBuildGraph"),
  context: {}
});

assert.deepEqual(
  buildGraphRequest.command,
  {
    executable: "dx",
    args: ["graph", "--json"]
  },
  "build graph requests should carry the fixed shell-free DX argv plan"
);

assert.equal(
  buildGraphRequest.operation,
  "dx.graph.read",
  "build graph requests should carry the read-only graph operation"
);

const sanitizedRequest = createNativeHostRequest({
  requestId: "req-sanitized-1",
  plan: resolveDxBrowserCommandPlan("status"),
  context: {
    activeTabUrl: " https://example.test/docs#section ",
    activeTabTitle: "  DX Docs  "
  }
});

assert.deepEqual(
  sanitizedRequest.context,
  {
    activeTabUrl: "https://example.test/docs#section",
    activeTabTitle: "DX Docs"
  },
  "native-host requests should trim browser context strings"
);

assert.equal(
  Object.prototype.hasOwnProperty.call(statusRequest, "args"),
  false,
  "browser protocol must not expose raw argv"
);

assert.throws(
  () =>
    createNativeHostRequest({
      requestId: "req-receipts-1",
      plan: resolveDxBrowserCommandPlan("openReceipts"),
      context: {}
    }),
  /does not use the native host/,
  "host-ui plans must not become native-host requests"
);

assert.deepEqual(
  parseNativeHostResponse({
    protocol: "dx.browser.native-host",
    version: 1,
    requestId: "req-status-1",
    ok: true,
    receiptPath:
      ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
  }),
  {
    protocol: "dx.browser.native-host",
    version: 1,
    requestId: "req-status-1",
    ok: true,
    receiptPath:
      ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
  },
  "valid native-host responses should parse without mutation"
);

assert.throws(
  () =>
    createNativeHostRequest({
      requestId: "req-unsafe-url-1",
      plan: resolveDxBrowserCommandPlan("status"),
      context: {
        activeTabUrl: "file:///C:/Users/Computer/secret.txt"
      }
    }),
  /Unsupported active tab URL scheme/,
  "native-host requests should reject local file context"
);

assert.throws(
  () =>
    parseNativeHostResponse({
      protocol: "dx.browser.native-host",
      version: 1,
      requestId: "req-status-1",
      ok: true,
      args: ["doctor"]
    }),
  /Unexpected native-host response field: args/,
  "native-host responses should reject unexpected fields"
);

assert.throws(
  () =>
    parseNativeHostResponse({
      protocol: "dx.browser.native-host",
      version: 1,
      requestId: "req-status-1",
      ok: true,
      stdout: "raw output"
    }),
  /Unexpected native-host response field: stdout/,
  "native-host responses should reject raw process-output fields"
);

for (const receiptPath of [
  "C:/Users/Computer/.dx/receipts/extensions/dx.browser.command-center/latest.json",
  "https://example.test/receipt.json",
  ".dx/receipts/extensions/dx.browser.command-center/../secret.json",
  ".dx/receipts/extensions/other.extension/latest.json"
]) {
  assert.throws(
    () =>
      parseNativeHostResponse({
        protocol: "dx.browser.native-host",
        version: 1,
        requestId: "req-status-1",
        ok: true,
        receiptPath
      }),
    /receipt path/,
    `native-host responses should reject unsafe receipt path ${receiptPath}`
  );
}

assert.throws(
  () =>
    parseNativeHostResponse({
      protocol: "dx.browser.native-host",
      version: 2,
      requestId: "req-status-1",
      ok: true
    }),
  /Unsupported DX browser native-host protocol version/,
  "protocol parser should reject unknown versions"
);

assert.throws(
  () =>
    parseNativeHostResponse({
      protocol: "dx.browser.native-host",
      version: 1,
      requestId: "req-status-1",
      ok: false
    }),
  /error message is required/,
  "failed native-host responses should include an error message"
);

console.log("browser native-host protocol verified");
