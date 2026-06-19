import assert from "node:assert/strict";

const chromiumRuntimeListeners = [];
globalThis.chrome = createBrowserApi(chromiumRuntimeListeners);
await import(`../dist/js/background/chromium.js?test=${Date.now()}`);

assert.equal(
  typeof chromiumRuntimeListeners[0],
  "function",
  "chromium background should register runtime command messages"
);

delete globalThis.chrome;

const firefoxRuntimeListeners = [];
globalThis.browser = createBrowserApi(firefoxRuntimeListeners);
await import(`../dist/js/background/firefox.js?test=${Date.now()}`);

assert.equal(
  typeof firefoxRuntimeListeners[0],
  "function",
  "firefox background should register runtime command messages"
);

delete globalThis.browser;

console.log("browser background entrypoints verified");

function createBrowserApi(runtimeListeners) {
  return {
    runtime: {
      onInstalled: {
        addListener() {}
      },
      onMessage: {
        addListener(listener) {
          runtimeListeners.push(listener);
        }
      },
      openOptionsPage() {}
    },
    tabs: {
      async query() {
        return [
          {
            title: "DX Active Tab",
            url: "https://example.test/current"
          }
        ];
      }
    }
  };
}
