import assert from "node:assert/strict";

const { createDxBrowserCommandMessage } = await import(
  "../dist/js/runtime/messages.js"
);
const { resolveDxBrowserCommandPlan } = await import(
  "../dist/js/runtime/commandPlans.js"
);

const extensionOrigin = "chrome-extension://dx-browser-test-extension";
const receiptPath =
  ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json";
const activeTab = {
  title: "DX Browser Command Center",
  url: "https://dx.localhost/extensions"
};
const runtimeListeners = [];
const sentNativeMessages = [];
let optionsOpenCount = 0;

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
    async sendNativeMessage(hostName, request) {
      const nativeRequest = expectRecord(request, "native-host request");
      sentNativeMessages.push({ hostName, request: nativeRequest });

      return {
        protocol: "dx.browser.native-host",
        version: 1,
        requestId: nativeRequest.requestId,
        ok: true,
        receiptPath
      };
    },
    async openOptionsPage() {
      optionsOpenCount += 1;
    }
  },
  tabs: {
    query(queryInfo, callback) {
      assert.deepEqual(queryInfo, { active: true, currentWindow: true });

      const tabs = [activeTab];

      if (callback) {
        callback(tabs);
        return undefined;
      }

      return Promise.resolve(tabs);
    }
  }
};

try {
  await import(`../dist/js/background/chromium.js?loaded-command-smoke=${Date.now()}`);

  assert.equal(
    typeof runtimeListeners[0],
    "function",
    "loaded Chromium background should register a runtime command listener"
  );

  const statusResponse = await invokeCommand("status");
  assertNativeResponse(statusResponse, "status");
  assertNativeCommand(0, "dx.browser.show_status", ["status"]);

  const forgeResponse = await invokeCommand("forgePackages");
  assertNativeResponse(forgeResponse, "forgePackages");
  assertNativeCommand(1, "dx.browser.list_forge_packages", [
    "forge",
    "packages",
    "--json"
  ]);

  const graphResponse = await invokeCommand("showBuildGraph");
  assertNativeResponse(graphResponse, "showBuildGraph");
  assertNativeCommand(2, "dx.browser.show_build_graph", ["graph", "--json"]);

  const deniedDoctorResponse = await invokeCommand("doctor");
  assert.equal(deniedDoctorResponse.ok, false);
  assert.match(deniedDoctorResponse.error, /requires user approval/);
  assert.equal(
    sentNativeMessages.length,
    3,
    "unapproved doctor must not contact the native host"
  );

  const approvedDoctorResponse = await invokeCommand("doctor", true);
  assertNativeResponse(approvedDoctorResponse, "doctor");
  assertNativeCommand(3, "dx.browser.run_doctor", ["doctor"]);

  const receiptsResponse = await invokeCommand("openReceipts");
  assertHostUiResponse(receiptsResponse, "openReceipts");
  assert.equal(optionsOpenCount, 1, "openReceipts should open the options surface");
  assert.equal(
    sentNativeMessages.length,
    4,
    "host UI commands must not contact the native host"
  );

  const deniedSenderResponse = await invokeCommandWithSender("status", false, {
    id: "dx-browser-test-extension",
    url: "https://example.test/content-script"
  });

  assert.deepEqual(deniedSenderResponse, {
    ok: false,
    error: "DX browser command sender is not trusted."
  });
  assert.equal(
    sentNativeMessages.length,
    4,
    "untrusted senders must not contact the native host"
  );
} finally {
  delete globalThis.chrome;
}

console.log("loaded browser command smoke verified");

async function invokeCommand(commandId, approved = false) {
  return invokeCommandWithSender(commandId, approved, {
    id: "dx-browser-test-extension",
    url: `${extensionOrigin}/static/popup.html`
  });
}

async function invokeCommandWithSender(commandId, approved, sender) {
  const responses = [];
  const listenerResult = runtimeListeners[0](
    createDxBrowserCommandMessage(resolveDxBrowserCommandPlan(commandId), approved),
    sender,
    (response) => {
      responses.push(response);
    }
  );

  assert.equal(listenerResult, true, "runtime listener should keep the channel open");
  await waitFor(() => responses.length === 1);
  return responses[0];
}

function assertNativeResponse(response, commandId) {
  assert.deepEqual(response, {
    ok: true,
    result: {
      commandId,
      handledBy: "native-host",
      receiptPath
    }
  });
}

function assertHostUiResponse(response, commandId) {
  assert.deepEqual(response, {
    ok: true,
    result: {
      commandId,
      handledBy: "host-ui"
    }
  });
}

function assertNativeCommand(index, hostActionId, args) {
  const sentMessage = sentNativeMessages[index];
  assert.ok(sentMessage, `native-host command ${index} should be recorded`);
  assert.equal(sentMessage.hostName, "dev.dx.browser");
  assert.equal(sentMessage.request.hostActionId, hostActionId);
  assert.deepEqual(sentMessage.request.command, {
    executable: "dx",
    args
  });
  assert.deepEqual(sentMessage.request.context, {
    activeTabUrl: activeTab.url,
    activeTabTitle: activeTab.title
  });
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  assert.fail("condition was not met before timeout");
}

function expectRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`A ${label} object is required.`);
  }

  return value;
}
