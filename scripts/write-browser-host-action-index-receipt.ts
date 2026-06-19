import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  type DxBrowserCommandPlan,
  listDxBrowserCommandPlans
} from "../hosts/browser/dx-browser/src/runtime/commandPlans.ts";
import { parseTomlDocument } from "./lib/toml-lite.ts";

export interface BrowserHostActionIndexReceiptOptions {
  generatedAt?: Date | string;
  manifestPath?: string;
  receiptPath?: string;
  verificationCommand?: string;
}

export interface BrowserHostActionIndexReceipt {
  receipt: "dx.extension.host_action_index";
  adapterId: "dx.browser.command-center";
  host: "browser";
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  manifest: {
    path: string;
    sha256: string;
    actionCount: number;
    receiptPath: string;
  };
  actions: BrowserHostActionIndexEntry[];
  nativeHostActionCount: number;
  hostUiActionCount: number;
  runtimePlanParity: true;
  releaseClaims: {
    loadedChromeProfileVerified: false;
    loadedEdgeProfileVerified: false;
    loadedFirefoxProfileVerified: false;
    nativeHostReleasePackageVerified: false;
    releaseGateSatisfied: false;
  };
}

export interface BrowserHostActionIndexEntry {
  id: string;
  runtimePlanId: string;
  operation: string;
  transport: "native-host" | "host-ui";
  riskLevel: "low" | "medium";
  requiresUserApproval: boolean;
  requiredCapabilities: string[];
  nativeCommand?: {
    executable: "dx";
    args: string[];
  };
}

interface BrowserHostActionManifestEntry {
  id: string;
  operation: string;
  transport: "native-host" | "host-ui";
  risk_level: "low" | "medium";
  requires_user_approval: boolean;
  required_capabilities: string[];
}

const adapterId = "dx.browser.command-center";
const defaultManifestRelativePath = "hosts/browser/dx-browser/dx.extension.toml";
const defaultReceiptRelativePath =
  ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json";

export function writeBrowserHostActionIndexReceipt(
  root = process.cwd(),
  options: BrowserHostActionIndexReceiptOptions = {}
): BrowserHostActionIndexReceipt {
  const workspaceRoot = resolve(root);
  const manifestPath = resolve(
    options.manifestPath ?? join(workspaceRoot, ...defaultManifestRelativePath.split("/"))
  );
  const receiptPath = resolve(
    options.receiptPath ?? join(workspaceRoot, ...defaultReceiptRelativePath.split("/"))
  );
  const manifestSource = readFileSync(manifestPath, "utf8");
  const manifest = parseTomlDocument(manifestSource);
  const actions = readHostActions(manifest.arrays.host_actions ?? []);
  const runtimePlans = listDxBrowserCommandPlans();
  const indexedActions = createActionIndex(actions, runtimePlans);

  assertBrowserManifest(manifest, actions);

  const receipt: BrowserHostActionIndexReceipt = {
    receipt: "dx.extension.host_action_index",
    adapterId,
    host: "browser",
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand:
      options.verificationCommand ?? "npm run test:browser-host-action-index-receipt",
    receiptPath,
    manifest: {
      path: options.manifestPath ? manifestPath : defaultManifestRelativePath,
      sha256: createHash("sha256").update(manifestSource).digest("hex"),
      actionCount: actions.length,
      receiptPath: readReceiptPath(manifest.arrays.receipts ?? [])
    },
    actions: indexedActions,
    nativeHostActionCount: indexedActions.filter((action) => action.transport === "native-host").length,
    hostUiActionCount: indexedActions.filter((action) => action.transport === "host-ui").length,
    runtimePlanParity: true,
    releaseClaims: {
      loadedChromeProfileVerified: false,
      loadedEdgeProfileVerified: false,
      loadedFirefoxProfileVerified: false,
      nativeHostReleasePackageVerified: false,
      releaseGateSatisfied: false
    }
  };

  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

  return receipt;
}

if (isDirectRun()) {
  const receipt = writeBrowserHostActionIndexReceipt(process.cwd(), {
    verificationCommand:
      process.env.DX_VERIFICATION_COMMAND ?? "npm run test:browser-host-action-index-receipt"
  });

  console.log(`Browser host action index receipt written: ${receipt.receiptPath}`);
}

function assertBrowserManifest(
  manifest: ReturnType<typeof parseTomlDocument>,
  actions: BrowserHostActionManifestEntry[]
): void {
  if (manifest.sections.extension?.id !== adapterId) {
    throw new Error("Browser host action index manifest must target dx.browser.command-center.");
  }

  if (actions.length === 0) {
    throw new Error("Browser host action index requires at least one host action.");
  }

  if (readReceiptPath(manifest.arrays.receipts ?? []) !== defaultReceiptRelativePath) {
    throw new Error("Browser host action index receipt path does not match the DX manifest.");
  }
}

function readHostActions(values: Record<string, unknown>[]): BrowserHostActionManifestEntry[] {
  return values.map((value) => ({
    id: readString(value, "id"),
    operation: readString(value, "operation"),
    transport: readTransport(value.transport),
    risk_level: readRiskLevel(value.risk_level),
    requires_user_approval: readBoolean(value, "requires_user_approval"),
    required_capabilities: readStringArray(value.required_capabilities, "required_capabilities")
  }));
}

function createActionIndex(
  actions: BrowserHostActionManifestEntry[],
  runtimePlans: DxBrowserCommandPlan[]
): BrowserHostActionIndexEntry[] {
  const actionsById = new Map(actions.map((action) => [action.id, action]));
  const entries = runtimePlans.map((plan) => createActionEntry(plan, actionsById));

  for (const action of actions) {
    if (!runtimePlans.some((plan) => plan.hostActionId === action.id)) {
      throw new Error(`Browser host action ${action.id} has no runtime command plan.`);
    }
  }

  return entries;
}

function createActionEntry(
  plan: DxBrowserCommandPlan,
  actionsById: Map<string, BrowserHostActionManifestEntry>
): BrowserHostActionIndexEntry {
  const action = actionsById.get(plan.hostActionId);

  if (!action) {
    throw new Error(`Browser runtime plan ${plan.id} is missing from host actions.`);
  }

  assertMatchesPlan(action, plan);

  return {
    id: action.id,
    runtimePlanId: plan.id,
    operation: action.operation,
    transport: action.transport,
    riskLevel: action.risk_level,
    requiresUserApproval: action.requires_user_approval,
    requiredCapabilities: [...action.required_capabilities],
    ...(plan.nativeCommand
      ? {
          nativeCommand: {
            executable: plan.nativeCommand.executable,
            args: [...plan.nativeCommand.args]
          }
        }
      : {})
  };
}

function assertMatchesPlan(
  action: BrowserHostActionManifestEntry,
  plan: DxBrowserCommandPlan
): void {
  if (
    action.operation !== plan.operation ||
    action.transport !== plan.transport ||
    action.risk_level !== plan.risk ||
    action.requires_user_approval !== plan.requiresUserApproval ||
    !sameStringList(action.required_capabilities, plan.requiredCapabilities)
  ) {
    throw new Error(`Browser host action ${action.id} does not match runtime plan ${plan.id}.`);
  }

  if (plan.transport === "native-host" && !plan.nativeCommand) {
    throw new Error(`Browser runtime plan ${plan.id} is missing native-host command metadata.`);
  }
}

function readReceiptPath(values: Record<string, unknown>[]): string {
  const receipt = values.find((value) => value.id === "host-action-index");
  return readString(receipt ?? {}, "latest_path");
}

function readString(value: Record<string, unknown>, key: string): string {
  const field = value[key];

  if (typeof field !== "string" || field.trim() === "") {
    throw new Error(`Browser host action index requires ${key}.`);
  }

  return field;
}

function readBoolean(value: Record<string, unknown>, key: string): boolean {
  const field = value[key];

  if (typeof field !== "boolean") {
    throw new Error(`Browser host action index requires boolean ${key}.`);
  }

  return field;
}

function readTransport(value: unknown): BrowserHostActionManifestEntry["transport"] {
  if (value === "native-host" || value === "host-ui") {
    return value;
  }

  throw new Error("Browser host action index has unsupported transport.");
}

function readRiskLevel(value: unknown): BrowserHostActionManifestEntry["risk_level"] {
  if (value === "low" || value === "medium") {
    return value;
  }

  throw new Error("Browser host action index has unsupported risk level.");
}

function readStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item.trim())) {
    throw new Error(`Browser host action index requires string array ${label}.`);
  }

  return [...value];
}

function sameStringList(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function normalizeGeneratedAt(value: Date | string | undefined): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value ?? new Date().toISOString();
}

function isDirectRun(): boolean {
  if (!process.argv[1]) {
    return false;
  }

  return (
    normalize(resolve(process.argv[1])).toLowerCase() ===
    normalize(fileURLToPath(import.meta.url)).toLowerCase()
  );
}
