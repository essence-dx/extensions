import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type HostFreeRefreshPhase = "package_output" | "package_artifact" | "release_checksum";

export interface HostFreeReleaseArtifactRefreshPlanOptions {
  planPath?: string;
  reportPath?: string;
  sourceReportPath?: string;
}

export interface HostFreeReleaseArtifactRefreshPlan {
  receipt: "dx.extension.host_free_release_artifact_refresh_plan";
  generatedAt: string;
  sourceReportPath: string;
  commands: HostFreeReleaseArtifactRefreshCommand[];
}

export interface WrittenHostFreeReleaseArtifactRefreshPlan extends HostFreeReleaseArtifactRefreshPlan {
  planPath: string;
}

export interface HostFreeReleaseArtifactRefreshCommand {
  command: string;
  executable: "npm";
  arguments: string[];
  requirementCount: number;
  adapters: string[];
  kinds: string[];
  phase: HostFreeRefreshPhase;
}

interface CommandAccumulator {
  command: string;
  executable: "npm";
  arguments: string[];
  requirementCount: number;
  adapters: Set<string>;
  kinds: Set<string>;
  phase: HostFreeRefreshPhase;
}

interface CliOptions {
  planPath?: string;
  reportPath?: string;
}

const defaultReportPath = ".dx/receipts/extensions/release-evidence-gaps-latest.json";
const defaultPlanPath = ".tmp/proofs/host-free-release-artifacts.json";
const phaseOrder: Record<HostFreeRefreshPhase, number> = {
  package_output: 10,
  package_artifact: 20,
  release_checksum: 30
};

export function writeHostFreeReleaseArtifactRefreshPlan(
  root = process.cwd(),
  options: HostFreeReleaseArtifactRefreshPlanOptions = {}
): WrittenHostFreeReleaseArtifactRefreshPlan {
  const workspaceRoot = resolve(root);
  const reportPath = resolve(workspaceRoot, options.reportPath ?? defaultReportPath);
  const planPath = resolve(workspaceRoot, options.planPath ?? defaultPlanPath);
  const report = readJsonRecord(reportPath);
  const plan = createHostFreeReleaseArtifactRefreshPlan(report, {
    sourceReportPath: options.sourceReportPath ?? reportPath
  });
  const writtenPlan = {
    ...plan,
    planPath
  };

  mkdirSync(dirname(planPath), { recursive: true });
  writeFileSync(planPath, `${JSON.stringify(writtenPlan, null, 2)}\n`);

  return writtenPlan;
}

export function createHostFreeReleaseArtifactRefreshPlan(
  report: unknown,
  options: HostFreeReleaseArtifactRefreshPlanOptions = {}
): HostFreeReleaseArtifactRefreshPlan {
  const sourceReportPath = options.sourceReportPath ?? options.reportPath ?? defaultReportPath;
  const reportRecord = expectRecord(report, "release evidence gap report");
  const generatedAt = expectNonEmptyString(reportRecord.generatedAt, "release evidence gap report generatedAt");
  const commands = new Map<string, CommandAccumulator>();

  for (const extension of readRecordArray(reportRecord.extensions)) {
    const adapterId = expectNonEmptyString(extension.id, "release evidence extension id");

    for (const requirement of readRecordArray(extension.evidenceRequirements)) {
      if (requirement.releaseValid === true) {
        continue;
      }

      const remediation = readRecord(requirement.remediation);

      if (!remediation || remediation.proofSource !== "workspace_artifact" || remediation.requiresRealHost !== false) {
        continue;
      }

      const command = expectNonEmptyString(remediation.command, "release evidence remediation command");

      if (isSmokeCommand(command)) {
        continue;
      }

      const parsedCommand = parseNpmCommand(command);
      const kind = expectNonEmptyString(requirement.kind, "release evidence requirement kind");
      const phase = phaseFor(kind);
      const commandKey = commandGroupKey(command, remediation.proofSource, remediation.requiresRealHost);
      const existing = commands.get(commandKey) ?? {
        command,
        executable: parsedCommand.executable,
        arguments: parsedCommand.arguments,
        requirementCount: 0,
        adapters: new Set<string>(),
        kinds: new Set<string>(),
        phase
      };

      existing.requirementCount += 1;
      existing.adapters.add(adapterId);
      existing.kinds.add(kind);
      existing.phase = earlierPhase(existing.phase, phase);
      commands.set(commandKey, existing);
    }
  }

  return {
    receipt: "dx.extension.host_free_release_artifact_refresh_plan",
    generatedAt,
    sourceReportPath,
    commands: [...commands.values()]
      .map((command) => ({
        ...command,
        adapters: [...command.adapters].sort(),
        kinds: [...command.kinds].sort()
      }))
      .sort(compareRefreshCommands)
  };
}

if (isDirectRun()) {
  const options = parseCliOptions(process.argv.slice(2));
  const plan = writeHostFreeReleaseArtifactRefreshPlan(process.cwd(), {
    planPath: options.planPath,
    reportPath: options.reportPath
  });

  console.log(`Host-free release artifact refresh plan written: ${plan.planPath}`);
  console.log(`Planned commands: ${plan.commands.length}`);
}

function compareRefreshCommands(
  left: HostFreeReleaseArtifactRefreshCommand,
  right: HostFreeReleaseArtifactRefreshCommand
): number {
  return (
    phaseOrder[left.phase] - phaseOrder[right.phase] ||
    semanticOrder(left) - semanticOrder(right) ||
    left.command.localeCompare(right.command)
  );
}

function semanticOrder(command: HostFreeReleaseArtifactRefreshCommand): number {
  if (command.kinds.includes("native_host_package")) {
    return 10;
  }

  if (command.kinds.includes("ccx_package")) {
    return 20;
  }

  return 30;
}

function earlierPhase(left: HostFreeRefreshPhase, right: HostFreeRefreshPhase): HostFreeRefreshPhase {
  return phaseOrder[left] <= phaseOrder[right] ? left : right;
}

function phaseFor(kind: string): HostFreeRefreshPhase {
  if (kind === "package_output" || kind === "content_package") {
    return "package_output";
  }

  if (kind === "checksum") {
    return "release_checksum";
  }

  return "package_artifact";
}

function commandGroupKey(command: string, proofSource: unknown, requiresRealHost: unknown): string {
  return JSON.stringify([command, proofSource, requiresRealHost]);
}

function parseNpmCommand(command: string): Pick<HostFreeReleaseArtifactRefreshCommand, "arguments" | "executable"> {
  const tokens = command.trim().split(/\s+/);

  if (tokens[0] !== "npm" || tokens.length < 3) {
    throw new Error(`Host-free release artifact command must be an npm command: ${command}`);
  }

  for (const token of tokens) {
    if (!/^[A-Za-z0-9:._@/=\-]+$/.test(token)) {
      throw new Error(`Host-free release artifact command contains an unsafe token: ${command}`);
    }
  }

  return {
    executable: "npm",
    arguments: tokens.slice(1)
  };
}

function isSmokeCommand(command: string): boolean {
  return command.split(/\s+/).some((token) => token.startsWith("smoke:"));
}

function readJsonRecord(path: string): Record<string, unknown> {
  return expectRecord(JSON.parse(readFileSync(path, "utf8")), `JSON file ${path}`);
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function readRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => Boolean(readRecord(entry))) : [];
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  const record = readRecord(value);

  if (!record) {
    throw new Error(`${label} must be a JSON object`);
  }

  return record;
}

function expectNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }

  return value;
}

function parseCliOptions(args: string[]): CliOptions {
  const options: CliOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--commands-json" && index + 1 < args.length) {
      options.planPath = args[index + 1];
      index += 1;
      continue;
    }

    if (argument === "--report" && index + 1 < args.length) {
      options.reportPath = args[index + 1];
      index += 1;
      continue;
    }

    throw new Error(`Unsupported host-free release artifact refresh argument: ${argument}`);
  }

  return options;
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
