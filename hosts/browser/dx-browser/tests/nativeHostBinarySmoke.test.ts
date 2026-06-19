import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import { NativeHostProcessRuntime } from "./nativeHostProcessRuntime.ts";

const { resolveDxBrowserCommandPlan } = await import(
  "../dist/js/runtime/commandPlans.js"
);
const { sendNativeHostCommand, dxBrowserNativeHostName } = await import(
  "../dist/js/runtime/nativeHostTransport.js"
);
const {
  dxBrowserNativeHostProtocol,
  dxBrowserNativeHostProtocolVersion
} = await import("../dist/js/runtime/protocol.js");

const nativeHostBinaryPath = process.env.DX_BROWSER_NATIVE_HOST_BIN;
assert.ok(
  nativeHostBinaryPath,
  "DX_BROWSER_NATIVE_HOST_BIN must point to dx-browser-native-host.exe"
);
assert.ok(
  existsSync(nativeHostBinaryPath),
  `DX_BROWSER_NATIVE_HOST_BIN does not exist: ${nativeHostBinaryPath}`
);

const runtime = new NativeHostProcessRuntime(nativeHostBinaryPath);
const observedHostNames = [];
const nativeRuntime = {
  async sendNativeMessage(hostName, message) {
    observedHostNames.push(hostName);
    return runtime.sendNativeMessage(hostName, message);
  }
};
const statusResponse = await sendNativeHostCommand({
  runtime: nativeRuntime,
  plan: resolveDxBrowserCommandPlan("status"),
  context: {
    activeTabUrl: "https://dx.localhost/workspace",
    activeTabTitle: "DX Workspace"
  },
  createRequestId: () => "req-native-host-binary-status"
});

assert.deepEqual(observedHostNames, [dxBrowserNativeHostName]);
assert.deepEqual(statusResponse, {
  protocol: dxBrowserNativeHostProtocol,
  version: dxBrowserNativeHostProtocolVersion,
  requestId: "req-native-host-binary-status",
  ok: true,
  receiptPath:
    ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
});

const forgePackagesResponse = await sendNativeHostCommand({
  runtime: nativeRuntime,
  plan: resolveDxBrowserCommandPlan("forgePackages"),
  context: {
    activeTabUrl: "https://dx.localhost/forge",
    activeTabTitle: "DX Forge"
  },
  createRequestId: () => "req-native-host-binary-forge-packages"
});

assert.deepEqual(forgePackagesResponse, {
  protocol: dxBrowserNativeHostProtocol,
  version: dxBrowserNativeHostProtocolVersion,
  requestId: "req-native-host-binary-forge-packages",
  ok: true,
  receiptPath:
    ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
});

const buildGraphResponse = await sendNativeHostCommand({
  runtime: nativeRuntime,
  plan: resolveDxBrowserCommandPlan("showBuildGraph"),
  context: {
    activeTabUrl: "https://dx.localhost/graph",
    activeTabTitle: "DX Build Graph"
  },
  createRequestId: () => "req-native-host-binary-build-graph"
});

assert.deepEqual(buildGraphResponse, {
  protocol: dxBrowserNativeHostProtocol,
  version: dxBrowserNativeHostProtocolVersion,
  requestId: "req-native-host-binary-build-graph",
  ok: true,
  receiptPath:
    ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
});

const unsupportedResponse = await runtime.sendNativeMessage(
  dxBrowserNativeHostName,
  {
    protocol: dxBrowserNativeHostProtocol,
    version: dxBrowserNativeHostProtocolVersion,
    requestId: "req-native-host-binary-unsupported",
    hostActionId: "dx.browser.delete_workspace",
    operation: "workspace.delete",
    command: {
      executable: "dx",
      args: ["status"]
    },
    context: {}
  }
);

assert.deepEqual(unsupportedResponse, {
  protocol: dxBrowserNativeHostProtocol,
  version: dxBrowserNativeHostProtocolVersion,
  requestId: "req-native-host-binary-unsupported",
  ok: false,
  error: "Unsupported DX browser native-host operation: workspace.delete"
});

console.log("browser native-host binary smoke verified");
