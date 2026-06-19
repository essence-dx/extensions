import assert from "node:assert/strict";

const {
  listDxCommandPlans,
  resolveDxCliCommandPlan,
  resolveDxCommandPlan,
  resolveDxHostUiCommandPlan
} = await import("../dist/dx/commandPlan.js");

const plans = listDxCommandPlans();

assert.deepEqual(
  plans.map((plan) => plan.id).sort(),
  [
    "copyReceiptsPath",
    "doctor",
    "listForgePackages",
    "openReceipts",
    "searchIcons",
    "showBuildGraph",
    "showCheckEditorState",
    "showLatestCheckReceipt",
    "status"
  ],
  "all manifest-backed VS Code command plans should be exposed"
);

assert.deepEqual(
  resolveDxCommandPlan("status").args,
  ["status"],
  "status command should map to a fixed argv plan"
);

assert.equal(
  resolveDxCommandPlan("status").hostActionId,
  "dx.vscode.show_status",
  "status plan should mirror the manifest host action"
);

assert.equal(
  resolveDxCommandPlan("status").commandId,
  "dx.showStatus",
  "status plan should expose the contributed VS Code command id"
);

assert.equal(
  resolveDxCommandPlan("status").transport,
  "cli",
  "status should run through the CLI transport"
);

assert.equal(
  resolveDxCommandPlan("status").input,
  "none",
  "status should not require host input"
);

assert.deepEqual(
  resolveDxCommandPlan("status").requiredCapabilities,
  ["workspace.read", "process.spawn"],
  "status command should mirror manifest capabilities"
);

assert.deepEqual(
  resolveDxCommandPlan("doctor").args,
  ["doctor"],
  "doctor command should map to a fixed argv plan"
);

assert.equal(
  resolveDxCommandPlan("doctor").operation,
  "dx.doctor",
  "doctor plan should mirror the manifest operation"
);

assert.equal(
  resolveDxCommandPlan("doctor").requiresUserApproval,
  true,
  "doctor command should require explicit user approval"
);

assert.equal(
  resolveDxCommandPlan("doctor").transport,
  "cli",
  "doctor should run through the CLI transport"
);

assert.equal(
  resolveDxCommandPlan("doctor").input,
  "none",
  "doctor should not require host input"
);

assert.deepEqual(
  resolveDxCommandPlan("openReceipts").args,
  [],
  "openReceipts should not expose process argv"
);

assert.equal(
  resolveDxCommandPlan("openReceipts").commandId,
  "dx.openReceipts",
  "openReceipts should expose the contributed VS Code command id"
);

assert.equal(
  resolveDxCommandPlan("openReceipts").hostActionId,
  "dx.vscode.open_receipts",
  "openReceipts plan should mirror the manifest host action"
);

assert.equal(
  resolveDxCommandPlan("openReceipts").transport,
  "host-ui",
  "openReceipts should stay on the host UI transport"
);

assert.equal(
  resolveDxCommandPlan("openReceipts").input,
  "none",
  "openReceipts should not require host input"
);

assert.deepEqual(
  resolveDxCommandPlan("openReceipts").requiredCapabilities,
  ["receipts.read"],
  "openReceipts should mirror manifest capabilities"
);

assert.equal(
  resolveDxCommandPlan("openReceipts").requiresUserApproval,
  false,
  "openReceipts should not require approval"
);

assert.deepEqual(
  resolveDxCommandPlan("copyReceiptsPath").args,
  [],
  "copyReceiptsPath should not expose process argv"
);

assert.equal(
  resolveDxCommandPlan("copyReceiptsPath").commandId,
  "dx.copyReceiptsPath",
  "copyReceiptsPath should expose the contributed VS Code command id"
);

assert.equal(
  resolveDxCommandPlan("copyReceiptsPath").hostActionId,
  "dx.vscode.copy_receipts_path",
  "copyReceiptsPath plan should mirror the manifest host action"
);

assert.equal(
  resolveDxCommandPlan("copyReceiptsPath").operation,
  "receipt.copyPath",
  "copyReceiptsPath should use the shared receipt copy operation"
);

assert.equal(
  resolveDxCommandPlan("copyReceiptsPath").transport,
  "host-ui",
  "copyReceiptsPath should stay on the host UI transport"
);

assert.equal(
  resolveDxCommandPlan("copyReceiptsPath").input,
  "none",
  "copyReceiptsPath should not require host input"
);

assert.deepEqual(
  resolveDxCommandPlan("copyReceiptsPath").requiredCapabilities,
  ["receipts.read"],
  "copyReceiptsPath should mirror manifest capabilities"
);

assert.equal(
  resolveDxCommandPlan("copyReceiptsPath").requiresUserApproval,
  false,
  "copyReceiptsPath should not require approval"
);

assert.deepEqual(
  resolveDxCommandPlan("searchIcons").args,
  ["icon", "search"],
  "searchIcons should expose the fixed DX icon search argv prefix"
);

assert.equal(
  resolveDxCommandPlan("searchIcons").commandId,
  "dx.searchIcons",
  "searchIcons should expose the contributed VS Code command id"
);

assert.equal(
  resolveDxCommandPlan("searchIcons").hostActionId,
  "dx.vscode.search_icons",
  "searchIcons plan should mirror the manifest host action"
);

assert.equal(
  resolveDxCommandPlan("searchIcons").operation,
  "dx.assets.search",
  "searchIcons should use the shared DX asset-search operation"
);

assert.equal(
  resolveDxCommandPlan("searchIcons").transport,
  "cli",
  "searchIcons should run through the CLI transport"
);

assert.equal(
  resolveDxCommandPlan("searchIcons").input,
  "icon-query",
  "searchIcons should require validated host input before execution"
);

assert.deepEqual(
  resolveDxCommandPlan("searchIcons").requiredCapabilities,
  ["workspace.read", "process.spawn", "icons.read"],
  "searchIcons should mirror manifest capabilities"
);

assert.equal(
  resolveDxCommandPlan("searchIcons").requiresUserApproval,
  false,
  "searchIcons should not require approval"
);

assert.deepEqual(
  resolveDxCommandPlan("listForgePackages").args,
  ["forge", "packages", "--json"],
  "listForgePackages should expose the fixed DX Forge packages argv"
);

assert.equal(
  resolveDxCommandPlan("listForgePackages").commandId,
  "dx.listForgePackages",
  "listForgePackages should expose the contributed VS Code command id"
);

assert.equal(
  resolveDxCommandPlan("listForgePackages").hostActionId,
  "dx.vscode.list_forge_packages",
  "listForgePackages plan should mirror the manifest host action"
);

assert.equal(
  resolveDxCommandPlan("listForgePackages").operation,
  "dx.forge.packages.list",
  "listForgePackages should use the shared DX Forge package-list operation"
);

assert.equal(
  resolveDxCommandPlan("listForgePackages").transport,
  "cli",
  "listForgePackages should run through the CLI transport"
);

assert.equal(
  resolveDxCommandPlan("listForgePackages").input,
  "none",
  "listForgePackages should not require host input"
);

assert.deepEqual(
  resolveDxCommandPlan("listForgePackages").requiredCapabilities,
  ["workspace.read", "process.spawn", "forge.read"],
  "listForgePackages should mirror manifest capabilities"
);

assert.equal(
  resolveDxCommandPlan("listForgePackages").requiresUserApproval,
  false,
  "listForgePackages should not require approval"
);

assert.deepEqual(
  resolveDxCommandPlan("showBuildGraph").args,
  ["graph", "--json"],
  "showBuildGraph should expose the fixed DX graph argv"
);

assert.equal(
  resolveDxCommandPlan("showBuildGraph").commandId,
  "dx.showBuildGraph",
  "showBuildGraph should expose the contributed VS Code command id"
);

assert.equal(
  resolveDxCommandPlan("showBuildGraph").hostActionId,
  "dx.vscode.show_build_graph",
  "showBuildGraph plan should mirror the manifest host action"
);

assert.equal(
  resolveDxCommandPlan("showBuildGraph").operation,
  "dx.graph.read",
  "showBuildGraph should use the shared DX build-graph read operation"
);

assert.equal(
  resolveDxCommandPlan("showBuildGraph").transport,
  "cli",
  "showBuildGraph should run through the CLI transport"
);

assert.equal(
  resolveDxCommandPlan("showBuildGraph").input,
  "none",
  "showBuildGraph should not require host input"
);

assert.deepEqual(
  resolveDxCommandPlan("showBuildGraph").requiredCapabilities,
  ["workspace.read", "process.spawn", "graph.read"],
  "showBuildGraph should mirror manifest capabilities"
);

assert.equal(
  resolveDxCommandPlan("showBuildGraph").requiresUserApproval,
  false,
  "showBuildGraph should not require approval"
);

assert.deepEqual(
  resolveDxCommandPlan("showLatestCheckReceipt").args,
  ["check", "--latest-receipt", "--json"],
  "showLatestCheckReceipt should expose the fixed DX latest-check receipt argv"
);

assert.equal(
  resolveDxCommandPlan("showLatestCheckReceipt").commandId,
  "dx.showLatestCheckReceipt",
  "showLatestCheckReceipt should expose the contributed VS Code command id"
);

assert.equal(
  resolveDxCommandPlan("showLatestCheckReceipt").hostActionId,
  "dx.vscode.show_latest_check_receipt",
  "showLatestCheckReceipt plan should mirror the manifest host action"
);

assert.equal(
  resolveDxCommandPlan("showLatestCheckReceipt").operation,
  "dx.check.receipt.latest",
  "showLatestCheckReceipt should use the shared DX latest-check receipt operation"
);

assert.equal(
  resolveDxCommandPlan("showLatestCheckReceipt").transport,
  "cli",
  "showLatestCheckReceipt should run through the CLI transport"
);

assert.equal(
  resolveDxCommandPlan("showLatestCheckReceipt").input,
  "none",
  "showLatestCheckReceipt should not require host input"
);

assert.deepEqual(
  resolveDxCommandPlan("showLatestCheckReceipt").requiredCapabilities,
  ["workspace.read", "process.spawn", "check.receipts.read"],
  "showLatestCheckReceipt should mirror manifest capabilities"
);

assert.equal(
  resolveDxCommandPlan("showLatestCheckReceipt").requiresUserApproval,
  false,
  "showLatestCheckReceipt should not require approval"
);

assert.deepEqual(
  resolveDxCommandPlan("showCheckEditorState").args,
  ["check", "editor", "--json"],
  "showCheckEditorState should expose the fixed DX check editor argv"
);

assert.equal(
  resolveDxCommandPlan("showCheckEditorState").commandId,
  "dx.showCheckEditorState",
  "showCheckEditorState should expose the contributed VS Code command id"
);

assert.equal(
  resolveDxCommandPlan("showCheckEditorState").hostActionId,
  "dx.vscode.show_check_editor_state",
  "showCheckEditorState plan should mirror the manifest host action"
);

assert.equal(
  resolveDxCommandPlan("showCheckEditorState").operation,
  "dx.check.editor.read",
  "showCheckEditorState should use the shared DX check editor read operation"
);

assert.equal(
  resolveDxCommandPlan("showCheckEditorState").transport,
  "cli",
  "showCheckEditorState should run through the CLI transport"
);

assert.equal(
  resolveDxCommandPlan("showCheckEditorState").input,
  "none",
  "showCheckEditorState should not require host input"
);

assert.deepEqual(
  resolveDxCommandPlan("showCheckEditorState").requiredCapabilities,
  ["workspace.read", "process.spawn", "check.editor.read"],
  "showCheckEditorState should mirror manifest capabilities"
);

assert.equal(
  resolveDxCommandPlan("showCheckEditorState").requiresUserApproval,
  false,
  "showCheckEditorState should not require approval"
);

for (const plan of plans) {
  assert.equal(
    plan.requiresWorkspaceTrust,
    true,
    `${plan.id} should require workspace trust`
  );
}

const mutableStatusPlan = resolveDxCommandPlan("status");
mutableStatusPlan.args.push("unsafe-extra-arg");
mutableStatusPlan.requiredCapabilities.push("unsafe-capability");
assert.deepEqual(
  resolveDxCommandPlan("status").args,
  ["status"],
  "resolved command plans should be defensive copies"
);
assert.deepEqual(
  resolveDxCommandPlan("status").requiredCapabilities,
  ["workspace.read", "process.spawn"],
  "resolved command plan capabilities should be defensive copies"
);

assert.throws(
  () => resolveDxCommandPlan("forge"),
  /Unsupported DX command plan/,
  "unknown commands must not be accepted"
);

assert.equal(
  resolveDxCliCommandPlan("doctor").transport,
  "cli",
  "CLI resolver should return CLI plans"
);

assert.equal(
  resolveDxCliCommandPlan("listForgePackages").transport,
  "cli",
  "CLI resolver should return the Forge packages command plan"
);

assert.equal(
  resolveDxCliCommandPlan("showBuildGraph").transport,
  "cli",
  "CLI resolver should return the build-graph command plan"
);

assert.equal(
  resolveDxCliCommandPlan("showLatestCheckReceipt").transport,
  "cli",
  "CLI resolver should return the latest-check receipt command plan"
);

assert.equal(
  resolveDxCliCommandPlan("showCheckEditorState").transport,
  "cli",
  "CLI resolver should return the check editor state command plan"
);

assert.throws(
  () => resolveDxCliCommandPlan("openReceipts"),
  /does not use the CLI transport/,
  "host-UI commands must not be resolved as CLI commands"
);

assert.equal(
  resolveDxHostUiCommandPlan("openReceipts").transport,
  "host-ui",
  "host-UI resolver should return host-UI plans"
);

assert.equal(
  resolveDxHostUiCommandPlan("copyReceiptsPath").transport,
  "host-ui",
  "host-UI resolver should return copyReceiptsPath host-UI plans"
);

assert.throws(
  () => resolveDxHostUiCommandPlan("doctor"),
  /does not use the host-UI transport/,
  "CLI commands must not be resolved as host-UI commands"
);

console.log("command plan allowlist verified");
