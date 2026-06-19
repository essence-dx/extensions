export type DxBrowserCommandPlanId =
  | "status"
  | "doctor"
  | "forgePackages"
  | "showBuildGraph"
  | "openReceipts";
export type DxBrowserCommandRisk = "low" | "medium";
export type DxBrowserCommandTransport = "native-host" | "host-ui";

export interface DxBrowserNativeCommand {
  executable: "dx";
  args: string[];
}

export interface DxBrowserCommandPlan {
  id: DxBrowserCommandPlanId;
  hostActionId: string;
  operation: string;
  nativeCommand?: DxBrowserNativeCommand;
  title: string;
  description: string;
  transport: DxBrowserCommandTransport;
  risk: DxBrowserCommandRisk;
  requiresUserApproval: boolean;
  requiredCapabilities: string[];
}

const commandPlans: Record<DxBrowserCommandPlanId, DxBrowserCommandPlan> = {
  status: {
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
  doctor: {
    id: "doctor",
    hostActionId: "dx.browser.run_doctor",
    operation: "dx.doctor",
    nativeCommand: {
      executable: "dx",
      args: ["doctor"]
    },
    title: "DX Doctor",
    description: "Run DX diagnostics through the native host.",
    transport: "native-host",
    risk: "medium",
    requiresUserApproval: true,
    requiredCapabilities: ["browser.activeTab", "nativeMessaging.dx"]
  },
  forgePackages: {
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
  showBuildGraph: {
    id: "showBuildGraph",
    hostActionId: "dx.browser.show_build_graph",
    operation: "dx.graph.read",
    nativeCommand: {
      executable: "dx",
      args: ["graph", "--json"]
    },
    title: "DX Build Graph",
    description: "Read the source-owned DX build graph through the native host.",
    transport: "native-host",
    risk: "low",
    requiresUserApproval: false,
    requiredCapabilities: [
      "browser.activeTab",
      "nativeMessaging.dx",
      "graph.read"
    ]
  },
  openReceipts: {
    id: "openReceipts",
    hostActionId: "dx.browser.open_receipts",
    operation: "receipt.openFolder",
    title: "Open Receipts",
    description: "Open DX extension receipts from the browser host surface.",
    transport: "host-ui",
    risk: "low",
    requiresUserApproval: false,
    requiredCapabilities: ["receipts.read"]
  }
};

export function listDxBrowserCommandPlans(): DxBrowserCommandPlan[] {
  return Object.values(commandPlans).map(copyCommandPlan);
}

export function resolveDxBrowserCommandPlan(id: string): DxBrowserCommandPlan {
  if (isDxBrowserCommandPlanId(id)) {
    return copyCommandPlan(commandPlans[id]);
  }

  throw new Error(`Unsupported DX browser command plan: ${id}`);
}

function isDxBrowserCommandPlanId(id: string): id is DxBrowserCommandPlanId {
  return Object.prototype.hasOwnProperty.call(commandPlans, id);
}

function copyCommandPlan(plan: DxBrowserCommandPlan): DxBrowserCommandPlan {
  return {
    ...plan,
    nativeCommand: plan.nativeCommand
      ? {
          executable: plan.nativeCommand.executable,
          args: [...plan.nativeCommand.args]
        }
      : undefined,
    requiredCapabilities: [...plan.requiredCapabilities]
  };
}
