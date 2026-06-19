import assert from "node:assert/strict";

const { dispatchCommandCenterPlan } = await import(
  "../dist/commands/commandCenterDispatch.js"
);

const calls = [];
const dependencies = {
  async runCliCommand(plan) {
    calls.push(["cli", plan.id]);
  },
  async runHostUiCommand(plan) {
    calls.push(["host-ui", plan.id]);
  },
  async runInputCommand(plan) {
    calls.push(["input", plan.id, plan.input]);
  }
};

await dispatchCommandCenterPlan("status", dependencies);
await dispatchCommandCenterPlan("openReceipts", dependencies);
await dispatchCommandCenterPlan("copyReceiptsPath", dependencies);
await dispatchCommandCenterPlan("searchIcons", dependencies);
await dispatchCommandCenterPlan("listForgePackages", dependencies);
await dispatchCommandCenterPlan("showBuildGraph", dependencies);
await dispatchCommandCenterPlan("showLatestCheckReceipt", dependencies);
await dispatchCommandCenterPlan("showCheckEditorState", dependencies);

assert.deepEqual(
  calls,
  [
    ["cli", "status"],
    ["host-ui", "openReceipts"],
    ["host-ui", "copyReceiptsPath"],
    ["input", "searchIcons", "icon-query"],
    ["cli", "listForgePackages"],
    ["cli", "showBuildGraph"],
    ["cli", "showLatestCheckReceipt"],
    ["cli", "showCheckEditorState"]
  ],
  "command center dispatch should follow command-plan input and transport metadata"
);

await assert.rejects(
  () => dispatchCommandCenterPlan("forge", dependencies),
  /Unsupported DX command plan/,
  "unknown command-center plan ids must be rejected"
);

console.log("vscode command-center dispatch verified");
