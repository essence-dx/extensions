import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { commandIds } = await import("../dist/commands/commandIds.js");
const { listDxCommandPlans, resolveDxCommandPlan } = await import(
  "../dist/dx/commandPlan.js"
);

const manifestSource = readFileSync(new URL("../dx.extension.toml", import.meta.url), "utf8");
const registerCommandsSource = readFileSync(
  new URL("../src/commands/registerCommands.ts", import.meta.url),
  "utf8"
);
const packageManifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
);

const manifestActions = parseHostActions(manifestSource);
const packageCommands = new Set(
  (packageManifest.contributes?.commands ?? []).map((command) => command.command)
);
const activationEvents = new Set(packageManifest.activationEvents ?? []);
const commandIdValues = new Set(Object.values(commandIds));
const commandIdEntries = Object.entries(commandIds);
const plans = listDxCommandPlans();
const plansByHostAction = new Map(plans.map((plan) => [plan.hostActionId, plan]));

for (const [name, commandId] of commandIdEntries) {
  assert.ok(packageCommands.has(commandId), `${commandId} should be contributed`);
  assert.ok(
    activationEvents.has(`onCommand:${commandId}`),
    `${commandId} should activate the extension`
  );
  assert.match(
    registerCommandsSource,
    new RegExp(`commandIds\\.${name}\\b`),
    `${commandId} should be registered by the extension`
  );
}

for (const action of manifestActions) {
  const plan = plansByHostAction.get(action.id);
  assert.ok(plan, `${action.id} should have a command plan`);
  assert.equal(plan.operation, action.operation);
  assert.equal(plan.requiresUserApproval, action.requiresUserApproval);
  assert.deepEqual(plan.requiredCapabilities, action.requiredCapabilities);

  const commandId = plan.commandId;
  assert.equal(typeof commandId, "string", `${action.id} should expose a command id`);
  assert.ok(commandIdValues.has(commandId), `${commandId} should be exported`);
  assert.ok(packageCommands.has(commandId), `${commandId} should be contributed`);
  assert.ok(
    activationEvents.has(`onCommand:${commandId}`),
    `${commandId} should activate the extension`
  );
}

const openReceipts = resolveDxCommandPlan("openReceipts");
assert.equal(openReceipts.hostActionId, "dx.vscode.open_receipts");
assert.equal(openReceipts.operation, "receipt.openFolder");
assert.equal(openReceipts.transport, "host-ui");
assert.deepEqual(openReceipts.requiredCapabilities, ["receipts.read"]);
assert.deepEqual(openReceipts.args, []);

const copyReceiptsPath = resolveDxCommandPlan("copyReceiptsPath");
assert.equal(copyReceiptsPath.hostActionId, "dx.vscode.copy_receipts_path");
assert.equal(copyReceiptsPath.operation, "receipt.copyPath");
assert.equal(copyReceiptsPath.transport, "host-ui");
assert.deepEqual(copyReceiptsPath.requiredCapabilities, ["receipts.read"]);
assert.deepEqual(copyReceiptsPath.args, []);

const listForgePackages = resolveDxCommandPlan("listForgePackages");
assert.equal(listForgePackages.hostActionId, "dx.vscode.list_forge_packages");
assert.equal(listForgePackages.operation, "dx.forge.packages.list");
assert.equal(listForgePackages.transport, "cli");
assert.deepEqual(listForgePackages.requiredCapabilities, [
  "workspace.read",
  "process.spawn",
  "forge.read"
]);
assert.deepEqual(listForgePackages.args, ["forge", "packages", "--json"]);

const showBuildGraph = resolveDxCommandPlan("showBuildGraph");
assert.equal(showBuildGraph.hostActionId, "dx.vscode.show_build_graph");
assert.equal(showBuildGraph.operation, "dx.graph.read");
assert.equal(showBuildGraph.transport, "cli");
assert.deepEqual(showBuildGraph.requiredCapabilities, [
  "workspace.read",
  "process.spawn",
  "graph.read"
]);
assert.deepEqual(showBuildGraph.args, ["graph", "--json"]);

const showLatestCheckReceipt = resolveDxCommandPlan("showLatestCheckReceipt");
assert.equal(
  showLatestCheckReceipt.hostActionId,
  "dx.vscode.show_latest_check_receipt"
);
assert.equal(showLatestCheckReceipt.operation, "dx.check.receipt.latest");
assert.equal(showLatestCheckReceipt.transport, "cli");
assert.deepEqual(showLatestCheckReceipt.requiredCapabilities, [
  "workspace.read",
  "process.spawn",
  "check.receipts.read"
]);
assert.deepEqual(showLatestCheckReceipt.args, [
  "check",
  "--latest-receipt",
  "--json"
]);

const showCheckEditorState = resolveDxCommandPlan("showCheckEditorState");
assert.equal(showCheckEditorState.hostActionId, "dx.vscode.show_check_editor_state");
assert.equal(showCheckEditorState.operation, "dx.check.editor.read");
assert.equal(showCheckEditorState.transport, "cli");
assert.deepEqual(showCheckEditorState.requiredCapabilities, [
  "workspace.read",
  "process.spawn",
  "check.editor.read"
]);
assert.deepEqual(showCheckEditorState.args, ["check", "editor", "--json"]);

console.log("vscode manifest command parity verified");

function parseHostActions(source) {
  const actions = [];
  let currentAction;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    if (line === "[[host_actions]]") {
      currentAction = {};
      actions.push(currentAction);
      continue;
    }

    if (line.startsWith("[")) {
      currentAction = undefined;
      continue;
    }

    if (!currentAction) {
      continue;
    }

    const assignment = parseTomlAssignment(line);
    if (assignment) {
      currentAction[assignment.key] = assignment.value;
    }
  }

  return actions.map((action) => ({
    id: assertString(action.id, "host action id"),
    operation: assertString(action.operation, `${action.id} operation`),
    requiresUserApproval: action.requires_user_approval === "true",
    requiredCapabilities: parseTomlStringArray(
      assertString(action.required_capabilities, `${action.id} capabilities`)
    )
  }));
}

function parseTomlAssignment(line) {
  const match = /^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/.exec(line);
  if (!match) {
    return undefined;
  }

  return {
    key: match[1],
    value: parseTomlScalar(match[2])
  };
}

function parseTomlScalar(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseTomlStringArray(value) {
  const trimmed = value.trim();
  assert.ok(trimmed.startsWith("[") && trimmed.endsWith("]"));
  const body = trimmed.slice(1, -1).trim();
  if (!body) {
    return [];
  }

  return body
    .split(",")
    .map((item) => item.trim())
    .map((item) => {
      assert.ok(item.startsWith('"') && item.endsWith('"'));
      return item.slice(1, -1);
    });
}

function assertString(value, label) {
  assert.equal(typeof value, "string", `${label} should be present`);
  return value;
}
