import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import {
  NativeHostProcessRuntime,
  nativeHostTestTimeoutMs
} from "./nativeHostProcessRuntime.ts";

const { createDxBrowserCommandMessage } = await import("../dist/js/runtime/messages.js");
const { resolveDxBrowserCommandPlan } = await import(
  "../dist/js/runtime/commandPlans.js"
);

const nativeHostBinaryPath = process.env.DX_BROWSER_NATIVE_HOST_BIN;
assert.ok(
  nativeHostBinaryPath,
  "DX_BROWSER_NATIVE_HOST_BIN must point to dx-browser-native-host.exe"
);
assert.ok(
  existsSync(nativeHostBinaryPath),
  `DX_BROWSER_NATIVE_HOST_BIN does not exist: ${nativeHostBinaryPath}`
);

const nativeRuntime = new NativeHostProcessRuntime(nativeHostBinaryPath);
const sentNativeHostNames: string[] = [];
const extensionOrigin = "chrome-extension://dx-browser-test-extension";
const trustedSender = {
  id: "dx-browser-test-extension",
  url: `${extensionOrigin}/static/popup.html`
};
const runtimeListeners: Array<
  (
    message: unknown,
    sender?: unknown,
    sendResponse?: (response: DxRuntimeSmokeResponse) => void
  ) => true | Promise<unknown> | undefined
> = [];

globalThis.chrome = {
  runtime: {
    onInstalled: {
      addListener() {}
    },
    onMessage: {
      addListener(listener) {
        runtimeListeners.push(listener);
      }
    },
    getURL(path = "") {
      return `${extensionOrigin}/${path}`;
    },
    async sendNativeMessage(hostName: string, message: unknown): Promise<unknown> {
      sentNativeHostNames.push(hostName);
      return nativeRuntime.sendNativeMessage(hostName, message);
    },
    openOptionsPage() {}
  },
  tabs: {
    async query() {
      return [
        {
          title: "DX Loaded Runtime",
          url: "https://dx.localhost/extensions"
        }
      ];
    }
  }
};

try {
  await import(`../dist/js/background/chromium.js?loaded-smoke=${Date.now()}`);

  assert.equal(
    typeof runtimeListeners[0],
    "function",
    "loaded Chromium background should register a runtime message listener"
  );

  const listenerResponses: DxRuntimeSmokeResponse[] = [];
  const listenerResult = runtimeListeners[0](
    createDxBrowserCommandMessage(resolveDxBrowserCommandPlan("status")),
    trustedSender,
    (response) => {
      listenerResponses.push(response);
    }
  );

  assert.equal(listenerResult, true, "runtime listener should keep the channel open");
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
  assert.deepEqual(sentNativeHostNames, ["dev.dx.browser"]);

  const forgePackagesResponse = await invokeLoadedCommand("forgePackages");
  assert.deepEqual(forgePackagesResponse, {
    ok: true,
    result: {
      commandId: "forgePackages",
      handledBy: "native-host",
      receiptPath:
        ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
    }
  });
  assert.deepEqual(sentNativeHostNames, ["dev.dx.browser", "dev.dx.browser"]);

  const buildGraphResponse = await invokeLoadedCommand("showBuildGraph");
  assert.deepEqual(buildGraphResponse, {
    ok: true,
    result: {
      commandId: "showBuildGraph",
      handledBy: "native-host",
      receiptPath:
        ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
    }
  });
  assert.deepEqual(sentNativeHostNames, [
    "dev.dx.browser",
    "dev.dx.browser",
    "dev.dx.browser"
  ]);

  const deniedResponses: DxRuntimeSmokeResponse[] = [];
  runtimeListeners[0](
    createDxBrowserCommandMessage(resolveDxBrowserCommandPlan("doctor")),
    trustedSender,
    (response) => {
      deniedResponses.push(response);
    }
  );

  await waitFor(() => deniedResponses.length === 1);
  assert.deepEqual(sentNativeHostNames, [
    "dev.dx.browser",
    "dev.dx.browser",
    "dev.dx.browser"
  ]);
  assert.equal(deniedResponses[0].ok, false);
  assert.match(deniedResponses[0].error, /requires user approval/);

  const deniedSenderResponses: DxRuntimeSmokeResponse[] = [];
  runtimeListeners[0](
    createDxBrowserCommandMessage(resolveDxBrowserCommandPlan("status")),
    {
      id: "dx-browser-test-extension",
      url: "https://example.test/content-script"
    },
    (response) => {
      deniedSenderResponses.push(response);
    }
  );

  await waitFor(() => deniedSenderResponses.length === 1);
  assert.deepEqual(deniedSenderResponses[0], {
    ok: false,
    error: "DX browser command sender is not trusted."
  });
  assert.deepEqual(sentNativeHostNames, [
    "dev.dx.browser",
    "dev.dx.browser",
    "dev.dx.browser"
  ]);
} finally {
  delete globalThis.chrome;
}

console.log("loaded browser dispatch smoke verified");

interface DxRuntimeSmokeResponse {
  ok: boolean;
  error?: string;
  result?: unknown;
}

async function invokeLoadedCommand(
  commandId: "forgePackages" | "showBuildGraph"
): Promise<DxRuntimeSmokeResponse> {
  const responses: DxRuntimeSmokeResponse[] = [];
  const listenerResult = runtimeListeners[0](
    createDxBrowserCommandMessage(resolveDxBrowserCommandPlan(commandId)),
    trustedSender,
    (response) => {
      responses.push(response);
    }
  );

  assert.equal(listenerResult, true, "runtime listener should keep the channel open");
  await waitFor(() => responses.length === 1);
  return responses[0];
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + nativeHostTestTimeoutMs;

  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  assert.fail(`condition was not met before ${nativeHostTestTimeoutMs}ms smoke timeout`);
}
