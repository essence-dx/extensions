import assert from "node:assert/strict";

const { listDxBrowserCommandPlans, resolveDxBrowserCommandPlan } = await import(
  "../dist/js/runtime/commandPlans.js"
);

const plans = listDxBrowserCommandPlans();

assert.deepEqual(
  plans.map((plan) => plan.id).sort(),
  ["doctor", "forgePackages", "openReceipts", "showBuildGraph", "status"],
  "browser host should expose the approved command-center plans"
);

assert.deepEqual(
  resolveDxBrowserCommandPlan("status"),
  {
    id: "status",
    hostActionId: "dx.browser.show_status",
    operation: "dx.status",
    nativeCommand: {
      executable: "dx",
      args: ["status"]
    },
    title: "DX Status",
    description: "Read the current DX workspace status through the native host.",
    transport: "native-host",
    risk: "low",
    requiresUserApproval: false,
    requiredCapabilities: ["browser.activeTab", "nativeMessaging.dx"]
  },
  "status plan should be a fixed low-risk native-host command"
);

assert.equal(
  resolveDxBrowserCommandPlan("doctor").requiresUserApproval,
  true,
  "doctor should require explicit approval before the native host is contacted"
);

assert.deepEqual(
  resolveDxBrowserCommandPlan("doctor").nativeCommand,
  {
    executable: "dx",
    args: ["doctor"]
  },
  "doctor should map to the fixed DX doctor command"
);

assert.deepEqual(
  resolveDxBrowserCommandPlan("forgePackages"),
  {
    id: "forgePackages",
    hostActionId: "dx.browser.list_forge_packages",
    operation: "dx.forge.packages.list",
    nativeCommand: {
      executable: "dx",
      args: ["forge", "packages", "--json"]
    },
    title: "DX Forge Packages",
    description: "List source-owned DX Forge packages through the native host.",
    transport: "native-host",
    risk: "low",
    requiresUserApproval: false,
    requiredCapabilities: [
      "browser.activeTab",
      "nativeMessaging.dx",
      "forge.read"
    ]
  },
  "forgePackages should be a fixed low-risk native-host command"
);

assert.deepEqual(
  resolveDxBrowserCommandPlan("showBuildGraph").nativeCommand,
  {
    executable: "dx",
    args: ["graph", "--json"]
  },
  "showBuildGraph should map to the fixed DX graph command"
);

assert.deepEqual(
  resolveDxBrowserCommandPlan("showBuildGraph").requiredCapabilities,
  ["browser.activeTab", "nativeMessaging.dx", "graph.read"],
  "showBuildGraph should declare graph read capability"
);

assert.equal(
  resolveDxBrowserCommandPlan("openReceipts").transport,
  "host-ui",
  "open receipts should remain a host-ui action and must not use native messaging"
);

const mutableStatusPlan = resolveDxBrowserCommandPlan("status");
mutableStatusPlan.requiredCapabilities.push("unsafe.extra");
mutableStatusPlan.nativeCommand.args.push("--unsafe");
assert.deepEqual(
  resolveDxBrowserCommandPlan("status").requiredCapabilities,
  ["browser.activeTab", "nativeMessaging.dx"],
  "resolved browser command plans should be defensive copies"
);
assert.deepEqual(
  resolveDxBrowserCommandPlan("status").nativeCommand.args,
  ["status"],
  "resolved native command args should be defensive copies"
);

assert.throws(
  () => resolveDxBrowserCommandPlan("forge"),
  /Unsupported DX browser command plan/,
  "unknown browser commands must not be accepted"
);

console.log("browser command plans verified");
