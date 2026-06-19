export type DxCommandPlanId =
  | "status"
  | "doctor"
  | "listForgePackages"
  | "openReceipts"
  | "copyReceiptsPath"
  | "searchIcons"
  | "showBuildGraph"
  | "showCheckEditorState"
  | "showLatestCheckReceipt";
export type DxCommandInput = "none" | "icon-query";
export type DxCommandRisk = "low" | "medium";
export type DxCommandTransport = "cli" | "host-ui";

interface DxCommandPlanBase {
  id: DxCommandPlanId;
  commandId: string;
  hostActionId: string;
  operation: string;
  title: string;
  description: string;
  transport: DxCommandTransport;
  input: DxCommandInput;
  args: readonly string[];
  requiredCapabilities: readonly string[];
  risk: DxCommandRisk;
  requiresWorkspaceTrust: boolean;
  requiresUserApproval: boolean;
}

export interface DxCliCommandPlan extends DxCommandPlanBase {
  transport: "cli";
}

export interface DxHostUiCommandPlan extends DxCommandPlanBase {
  transport: "host-ui";
}

export type DxCommandPlan = DxCliCommandPlan | DxHostUiCommandPlan;

const commandPlans: Record<DxCommandPlanId, DxCommandPlan> = {
  status: {
    id: "status",
    commandId: "dx.showStatus",
    hostActionId: "dx.vscode.show_status",
    operation: "dx.status",
    title: "DX Status",
    description: "Read the current DX workspace status",
    transport: "cli",
    input: "none",
    args: ["status"],
    requiredCapabilities: ["workspace.read", "process.spawn"],
    risk: "low",
    requiresWorkspaceTrust: true,
    requiresUserApproval: false
  },
  doctor: {
    id: "doctor",
    commandId: "dx.doctor",
    hostActionId: "dx.vscode.run_doctor",
    operation: "dx.doctor",
    title: "DX Doctor",
    description: "Run DX installation and workspace diagnostics",
    transport: "cli",
    input: "none",
    args: ["doctor"],
    requiredCapabilities: ["workspace.read", "process.spawn"],
    risk: "medium",
    requiresWorkspaceTrust: true,
    requiresUserApproval: true
  },
  listForgePackages: {
    id: "listForgePackages",
    commandId: "dx.listForgePackages",
    hostActionId: "dx.vscode.list_forge_packages",
    operation: "dx.forge.packages.list",
    title: "List DX Forge Packages",
    description: "List source-owned DX Forge packages",
    transport: "cli",
    input: "none",
    args: ["forge", "packages", "--json"],
    requiredCapabilities: ["workspace.read", "process.spawn", "forge.read"],
    risk: "low",
    requiresWorkspaceTrust: true,
    requiresUserApproval: false
  },
  showBuildGraph: {
    id: "showBuildGraph",
    commandId: "dx.showBuildGraph",
    hostActionId: "dx.vscode.show_build_graph",
    operation: "dx.graph.read",
    title: "Show DX Build Graph",
    description: "Read the source-owned DX build graph",
    transport: "cli",
    input: "none",
    args: ["graph", "--json"],
    requiredCapabilities: ["workspace.read", "process.spawn", "graph.read"],
    risk: "low",
    requiresWorkspaceTrust: true,
    requiresUserApproval: false
  },
  showLatestCheckReceipt: {
    id: "showLatestCheckReceipt",
    commandId: "dx.showLatestCheckReceipt",
    hostActionId: "dx.vscode.show_latest_check_receipt",
    operation: "dx.check.receipt.latest",
    title: "Show Latest DX Check Receipt",
    description: "Read the latest DX check receipt without running checks",
    transport: "cli",
    input: "none",
    args: ["check", "--latest-receipt", "--json"],
    requiredCapabilities: [
      "workspace.read",
      "process.spawn",
      "check.receipts.read"
    ],
    risk: "low",
    requiresWorkspaceTrust: true,
    requiresUserApproval: false
  },
  showCheckEditorState: {
    id: "showCheckEditorState",
    commandId: "dx.showCheckEditorState",
    hostActionId: "dx.vscode.show_check_editor_state",
    operation: "dx.check.editor.read",
    title: "Show DX Check Editor State",
    description: "Read the low-impact DX check editor polling state",
    transport: "cli",
    input: "none",
    args: ["check", "editor", "--json"],
    requiredCapabilities: ["workspace.read", "process.spawn", "check.editor.read"],
    risk: "low",
    requiresWorkspaceTrust: true,
    requiresUserApproval: false
  },
  openReceipts: {
    id: "openReceipts",
    commandId: "dx.openReceipts",
    hostActionId: "dx.vscode.open_receipts",
    operation: "receipt.openFolder",
    title: "Open Receipts Folder",
    description: "Open .dx receipts when the workspace provides them",
    transport: "host-ui",
    input: "none",
    args: [],
    requiredCapabilities: ["receipts.read"],
    risk: "low",
    requiresWorkspaceTrust: true,
    requiresUserApproval: false
  },
  copyReceiptsPath: {
    id: "copyReceiptsPath",
    commandId: "dx.copyReceiptsPath",
    hostActionId: "dx.vscode.copy_receipts_path",
    operation: "receipt.copyPath",
    title: "Copy Receipts Path",
    description: "Copy the workspace DX receipts folder path",
    transport: "host-ui",
    input: "none",
    args: [],
    requiredCapabilities: ["receipts.read"],
    risk: "low",
    requiresWorkspaceTrust: true,
    requiresUserApproval: false
  },
  searchIcons: {
    id: "searchIcons",
    commandId: "dx.searchIcons",
    hostActionId: "dx.vscode.search_icons",
    operation: "dx.assets.search",
    title: "Search DX Icons",
    description: "Search the local DX icon index from VS Code",
    transport: "cli",
    input: "icon-query",
    args: ["icon", "search"],
    requiredCapabilities: ["workspace.read", "process.spawn", "icons.read"],
    risk: "low",
    requiresWorkspaceTrust: true,
    requiresUserApproval: false
  }
};

export function listDxCommandPlans(): DxCommandPlan[] {
  return Object.values(commandPlans).map(copyPlan);
}

export function resolveDxCommandPlan(id: string): DxCommandPlan {
  if (isDxCommandPlanId(id)) {
    return copyPlan(commandPlans[id]);
  }

  throw new Error(`Unsupported DX command plan: ${id}`);
}

export function resolveDxCliCommandPlan(id: string): DxCliCommandPlan {
  const plan = resolveDxCommandPlan(id);
  if (plan.transport === "cli") {
    return plan;
  }

  throw new Error(`DX command plan ${id} does not use the CLI transport.`);
}

export function resolveDxHostUiCommandPlan(id: string): DxHostUiCommandPlan {
  const plan = resolveDxCommandPlan(id);
  if (plan.transport === "host-ui") {
    return plan;
  }

  throw new Error(`DX command plan ${id} does not use the host-UI transport.`);
}

function isDxCommandPlanId(id: string): id is DxCommandPlanId {
  return Object.prototype.hasOwnProperty.call(commandPlans, id);
}

function copyPlan(plan: DxCommandPlan): DxCommandPlan {
  return {
    ...plan,
    args: [...plan.args],
    requiredCapabilities: [...plan.requiredCapabilities]
  };
}
