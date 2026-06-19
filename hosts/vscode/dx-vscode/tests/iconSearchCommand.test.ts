import assert from "node:assert/strict";

const {
  createDxIconSearchCommandPlan,
  validateDxIconSearchQuery
} = await import("../dist/dx/iconSearch.js");

assert.equal(
  validateDxIconSearchQuery("home"),
  undefined,
  "simple icon queries should be accepted"
);

assert.equal(
  validateDxIconSearchQuery("arrow-left"),
  undefined,
  "dash-separated icon queries should be accepted"
);

assert.equal(
  validateDxIconSearchQuery("   "),
  "Enter an icon name or keyword.",
  "blank icon queries should be rejected"
);

assert.equal(
  validateDxIconSearchQuery("home; rm -rf"),
  "Use letters, numbers, spaces, dashes, underscores, dots, or slashes only.",
  "shell-control characters should be rejected"
);

assert.deepEqual(
  createDxIconSearchCommandPlan("  arrow   left  ").args,
  ["icon", "search", "arrow left", "--limit", "20"],
  "icon search should build a normalized shell-free DX CLI argv plan"
);

assert.equal(
  createDxIconSearchCommandPlan("home").input,
  "none",
  "validated icon search plans should be runnable without additional host input"
);

assert.equal(
  createDxIconSearchCommandPlan("home").commandId,
  "dx.searchIcons",
  "icon search runnable plan should keep the contributed command id"
);

assert.equal(
  createDxIconSearchCommandPlan("home").hostActionId,
  "dx.vscode.search_icons",
  "icon search runnable plan should keep the manifest host action"
);

assert.deepEqual(
  createDxIconSearchCommandPlan("home").requiredCapabilities,
  ["workspace.read", "process.spawn", "icons.read"],
  "icon search runnable plan should keep the manifest capabilities"
);

assert.throws(
  () => createDxIconSearchCommandPlan(""),
  /Enter an icon name or keyword/,
  "programmatic callers should not be able to create blank icon search plans"
);

console.log("vscode icon search command plan verified");
