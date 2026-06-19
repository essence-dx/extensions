import assert from "node:assert/strict";

import {
  findExtensionServiceWorkerTarget,
  assertCompleteBrowserExtensionIdCapture,
  formatBrowserCaptureDiagnostics,
  formatBrowserExtensionIdCaptureVerificationCommand,
  mergeBrowserExtensionIdCaptures,
  type BrowserExtensionIdCapture
} from "../capture-browser-extension-ids.ts";

const chromeExtensionId = "abcdefghijklmnopabcdefghijklmnop";
const edgeExtensionId = "bcdefghijklmnopabcdefghijklmnopa";

const chromeCapture = findExtensionServiceWorkerTarget("chrome", [
  {
    type: "page",
    url: "about:blank"
  },
  {
    type: "service_worker",
    url: `chrome-extension://${chromeExtensionId}/js/background/chromium.js`
  }
]);

assert.deepEqual(chromeCapture, {
  extensionId: chromeExtensionId,
  extensionBaseUrl: `chrome-extension://${chromeExtensionId}/`,
  backgroundServiceWorkerUrl: `chrome-extension://${chromeExtensionId}/js/background/chromium.js`
});

const edgeCapture = findExtensionServiceWorkerTarget("edge", [
  {
    type: "service_worker",
    url: `chrome-extension://${edgeExtensionId}/js/background/chromium.js`
  }
]);

assert.equal(edgeCapture.extensionId, edgeExtensionId);
assert.equal(edgeCapture.extensionBaseUrl, `chrome-extension://${edgeExtensionId}/`);

assert.throws(
  () =>
    findExtensionServiceWorkerTarget("chrome", [
      {
        type: "service_worker",
        url: "moz-extension://dx-browser-command-center/js/background/firefox.js"
      }
    ]),
  /did not expose the DX background service worker/
);

assert.throws(
  () =>
    findExtensionServiceWorkerTarget("edge", [
      {
        type: "page",
        url: "chrome-extension://abcdefghijklmnopabcdefghijklmnop/static/popup.html"
      }
    ]),
  /did not expose the DX background service worker/
);

assert.match(
  formatBrowserCaptureDiagnostics([
    "--disable-extensions-except is not allowed in Google Chrome, ignoring.",
    "ordinary browser startup line"
  ]),
  /disable-extensions-except/
);

const previousChromeCapture = createCapture("chrome", chromeExtensionId);
const previousEdgeCapture = createCapture("edge", edgeExtensionId);
const refreshedEdgeCapture = createCapture("edge", "cdefghijklmnopabcdefghijklmnopab");

assert.deepEqual(
  mergeBrowserExtensionIdCaptures([refreshedEdgeCapture], [previousChromeCapture, previousEdgeCapture], ["edge"]),
  [previousChromeCapture, refreshedEdgeCapture],
  "partial browser extension ID capture must preserve an existing complete paired capture"
);

assert.deepEqual(
  mergeBrowserExtensionIdCaptures([refreshedEdgeCapture], [], ["edge"]),
  [refreshedEdgeCapture],
  "partial browser extension ID capture can remain partial when no prior paired capture exists"
);

assert.throws(
  () => assertCompleteBrowserExtensionIdCapture([refreshedEdgeCapture]),
  /requires captured Chrome and Edge extension IDs/
);

assert.doesNotThrow(() =>
  assertCompleteBrowserExtensionIdCapture([previousChromeCapture, refreshedEdgeCapture])
);

assert.equal(
  formatBrowserExtensionIdCaptureVerificationCommand(["edge"]),
  "npm run capture:browser-extension-ids:j1 -- --target edge"
);

assert.equal(
  formatBrowserExtensionIdCaptureVerificationCommand(["edge"], 30000),
  "npm run capture:browser-extension-ids:j1 -- --target edge --timeout-ms 30000"
);

assert.equal(
  formatBrowserExtensionIdCaptureVerificationCommand(["chrome", "edge"]),
  "npm run capture:browser-extension-ids:j1"
);

console.log("Browser extension ID capture verified");

function createCapture(
  target: BrowserExtensionIdCapture["target"],
  extensionId: string
): BrowserExtensionIdCapture {
  return {
    target,
    browserExecutablePath: `C:/Program Files/${target}/browser.exe`,
    browserVersion: `${target}/1.0.0`,
    extensionRoot: `G:/Dx/extensions/hosts/browser/dx-browser/dist/browser/${target}`,
    extensionId,
    extensionBaseUrl: `chrome-extension://${extensionId}/`,
    backgroundServiceWorkerUrl: `chrome-extension://${extensionId}/js/background/chromium.js`,
    profilePath: `C:/Temp/dx-${target}`,
    loadedBackgroundServiceWorkerVerified: true
  };
}
