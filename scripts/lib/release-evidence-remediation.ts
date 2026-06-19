import type { EvidenceReceiptRequirement } from "../release-evidence-requirements.ts";

export const releaseEvidenceRemediationProofSources = [
  "developer_attestation",
  "host_application",
  "marketplace_review",
  "service_endpoint",
  "signature_authority",
  "workspace_artifact"
] as const;

export type ReleaseEvidenceRemediationProofSource = typeof releaseEvidenceRemediationProofSources[number];

export interface ReleaseEvidenceRequirementRemediation {
  command: string;
  proofSource: ReleaseEvidenceRemediationProofSource;
  requiresRealHost: boolean;
}

export interface ReleaseEvidenceRemediationSummary {
  invalidRequirementCount: number;
  withCommandCount: number;
  withoutCommandCount: number;
  realHostRequirementCount: number;
  deterministicRequirementCount: number;
  proofSourceRequirementCounts: Record<ReleaseEvidenceRemediationProofSource, number>;
  commands: ReleaseEvidenceRemediationCommandSummary[];
}

export interface ReleaseEvidenceRemediationCommandSummary {
  command: string;
  proofSources: ReleaseEvidenceRemediationProofSource[];
  requiresRealHost: boolean;
  requirementCount: number;
  adapters: string[];
  kinds: string[];
}

interface RemediationExtensionEntry {
  id: string;
  evidenceRequirements: RemediationRequirementEntry[];
}

interface RemediationRequirementEntry {
  kind: string;
  releaseValid: boolean;
  remediation?: ReleaseEvidenceRequirementRemediation;
}

const packageOutputCommands = new Map<string, string>([
  ["dx.affinity-content.bridge", "npm run package:affinity-content:j1"],
  ["dx.blender.command-center", "npm run build:blender:j1"],
  ["dx.browser.command-center", "npm run build:browser:j1"],
  ["dx.canva.command-center", "npm run build:canva:j1"],
  ["dx.davinci-resolve.command-center", "npm run package:davinci-resolve:j1"],
  ["dx.excel.command-center", "npm run build:office-taskpane:j1"],
  ["dx.figma.command-center", "npm run build:figma:j1"],
  ["dx.google-workspace.command-center", "npm run build:google-workspace-apps-script:j1"],
  ["dx.indesign.command-center", "npm run build:adobe-uxp:j1"],
  ["dx.intellij-platform.command-center", "npm run package:intellij-platform:j1"],
  ["dx.obsidian.command-center", "npm run build:obsidian:j1"],
  ["dx.photoshop.command-center", "npm run build:adobe-uxp:j1"],
  ["dx.powerpoint.command-center", "npm run build:office-taskpane:j1"],
  ["dx.premiere-pro.command-center", "npm run build:adobe-uxp:j1"],
  ["dx.sketch.command-center", "npm run build:sketch:j1"],
  ["dx.unity-editor.command-center", "npm run package:unity-editor:j1"],
  ["dx.unreal-engine.command-center", "npm run package:unreal-engine:j1"],
  ["dx.visual-studio.command-center", "npm run package:visual-studio:j1"],
  ["dx.vscode.command-center", "npm run package:vscode:j1"],
  ["dx.word.command-center", "npm run build:office-taskpane:j1"],
  ["dx.zed.command-center", "npm run package:zed:j1"]
]);

const realHostExecutionCommands = new Map<string, string>([
  ["dx.affinity-content.bridge", "npm run smoke:affinity-loaded-app:j1"],
  ["dx.canva.command-center", "npm run smoke:application-loaded-host:j1"],
  ["dx.excel.command-center", "npm run smoke:office-sideloaded-host:j1"],
  ["dx.figma.command-center", "npm run smoke:figma-loaded-host:j1"],
  ["dx.google-workspace.command-center", "npm run smoke:google-workspace-deployment:j1"],
  ["dx.obsidian.command-center", "npm run smoke:application-loaded-host:j1"],
  ["dx.powerpoint.command-center", "npm run smoke:office-sideloaded-host:j1"],
  ["dx.sketch.command-center", "npm run smoke:application-loaded-host:j1"],
  ["dx.vscode.command-center", "npm run smoke:vscode-loaded-host:j1"],
  ["dx.word.command-center", "npm run smoke:office-sideloaded-host:j1"],
  ["dx.zed.command-center", "npm run smoke:application-loaded-host:j1"]
]);

const creativeHostAdapters = new Set([
  "dx.blender.command-center",
  "dx.davinci-resolve.command-center",
  "dx.indesign.command-center",
  "dx.photoshop.command-center",
  "dx.premiere-pro.command-center"
]);

const ideGameEngineHostAdapters = new Set([
  "dx.intellij-platform.command-center",
  "dx.unity-editor.command-center",
  "dx.unreal-engine.command-center",
  "dx.visual-studio.command-center"
]);

const officeGoogleAdapters = new Set([
  "dx.excel.command-center",
  "dx.google-workspace.command-center",
  "dx.powerpoint.command-center",
  "dx.word.command-center"
]);

const adobeUxpAdapters = new Set([
  "dx.indesign.command-center",
  "dx.photoshop.command-center",
  "dx.premiere-pro.command-center"
]);

export function deriveReleaseEvidenceRequirementRemediation(
  adapterId: string,
  requirement: EvidenceReceiptRequirement
): ReleaseEvidenceRequirementRemediation | undefined {
  if (requirement.kind === "package_output") {
    return commandRemediation(packageOutputCommands.get(adapterId), "workspace_artifact", false);
  }

  if (requirement.kind === "host_execution") {
    return hostExecutionRemediation(adapterId, requirement.receiptPath);
  }

  if (requirement.kind === "native_host_package" && adapterId === "dx.browser.command-center") {
    return commandRemediation("npm run package:browser-native-host:j1", "workspace_artifact", false);
  }

  if (requirement.kind === "checksum") {
    return commandRemediation(checksumCommandFor(adapterId), "workspace_artifact", false);
  }

  if (requirement.kind === "signing") {
    return commandRemediation("npm run smoke:package-signing:j1", "signature_authority", false);
  }

  if (
    requirement.kind === "distribution_review" ||
    requirement.kind === "marketplace_review" ||
    requirement.kind === "community_review" ||
    requirement.kind === "canva_review" ||
    requirement.kind === "appsource_review" ||
    requirement.kind === "gallery_review" ||
    requirement.kind === "oauth_review"
  ) {
    return commandRemediation("npm run smoke:distribution-review:j1", "marketplace_review", false);
  }

  return specialEvidenceRemediation(adapterId, requirement.kind);
}

function hostExecutionRemediation(
  adapterId: string,
  receiptPath: string
): ReleaseEvidenceRequirementRemediation | undefined {
  if (adapterId === "dx.browser.command-center") {
    const browserTarget = browserTargetFromReceiptPath(receiptPath);

    return browserTarget
      ? commandRemediation(`npm run smoke:browser-loaded-profile:j1 -- -Target ${browserTarget}`, "host_application", true)
      : undefined;
  }

  if (creativeHostAdapters.has(adapterId)) {
    return commandRemediation("npm run smoke:creative-loaded-host:j1", "host_application", true);
  }

  if (ideGameEngineHostAdapters.has(adapterId)) {
    return commandRemediation("npm run smoke:ide-game-engine-loaded-host:j1", "host_application", true);
  }

  return commandRemediation(realHostExecutionCommands.get(adapterId), "host_application", true);
}

function specialEvidenceRemediation(
  adapterId: string,
  kind: string
): ReleaseEvidenceRequirementRemediation | undefined {
  if (kind === "ccx_package") {
    return commandRemediation("npm run package:adobe-ccx:j1", "workspace_artifact", false);
  }

  if (kind === "plugin_id" && adapterId === "dx.figma.command-center") {
    return commandRemediation("npm run smoke:figma-loaded-host:j1", "host_application", true);
  }

  if (kind === "plugin_id" && adobeUxpAdapters.has(adapterId)) {
    return commandRemediation("npm run smoke:adobe-uxp-plugin-id:j1", "developer_attestation", true);
  }

  if (kind === "local_service") {
    const command = officeGoogleAdapters.has(adapterId)
      ? "npm run smoke:office-local-service:j1"
      : "npm run smoke:local-service:j1";

    return commandRemediation(command, "service_endpoint", false);
  }

  if (kind === "cloud_service" && adapterId === "dx.canva.command-center") {
    return commandRemediation("npm run smoke:canva-cloud-service:j1", "service_endpoint", false);
  }

  if (kind === "cloud_service" && adapterId === "dx.google-workspace.command-center") {
    return commandRemediation("npm run smoke:google-workspace-deployment:j1", "service_endpoint", false);
  }

  if (kind === "apps_script_deployment") {
    return commandRemediation("npm run smoke:google-workspace-deployment:j1", "service_endpoint", false);
  }

  if (kind === "notarization") {
    return commandRemediation("npm run smoke:package-notarization:j1", "signature_authority", false);
  }

  if (kind === "developer_docs" && adapterId === "dx.davinci-resolve.command-center") {
    return commandRemediation("npm run smoke:davinci-resolve-developer-docs:j1", "developer_attestation", false);
  }

  if (kind === "native_or_hybrid_plugin") {
    return commandRemediation("npm run smoke:creative-native-or-hybrid-plugin:j1", "host_application", true);
  }

  if (kind === "manual_import") {
    return commandRemediation("npm run smoke:affinity-manual-import:j1", "host_application", true);
  }

  if (kind === "photoshop_filter_plugin") {
    return commandRemediation("npm run smoke:affinity-photoshop-filter-plugin:j1", "host_application", true);
  }

  if (
    kind === "addon_install" ||
    kind === "sketchtool_run" ||
    kind === "workflow_integration" ||
    kind === "plugin_verifier" ||
    kind === "project_import" ||
    kind === "project_enablement"
  ) {
    return commandRemediation(
      ideGameEngineHostAdapters.has(adapterId)
        ? "npm run smoke:ide-game-engine-special-proof:j1"
        : "npm run smoke:creative-native-or-hybrid-plugin:j1",
      "host_application",
      true
    );
  }

  if (kind === "experimental_instance" && adapterId === "dx.visual-studio.command-center") {
    return commandRemediation("npm run smoke:ide-game-engine-loaded-host:j1", "host_application", true);
  }

  if (kind === "content_package") {
    return commandRemediation("npm run package:affinity-content:j1", "workspace_artifact", false);
  }

  return undefined;
}

export function summarizeReleaseEvidenceRemediations(
  extensions: RemediationExtensionEntry[]
): ReleaseEvidenceRemediationSummary {
  const commandSummaries = new Map<string, {
    adapters: Set<string>;
    kinds: Set<string>;
    proofSources: Set<ReleaseEvidenceRemediationProofSource>;
    remediation: ReleaseEvidenceRequirementRemediation;
    requirementCount: number;
  }>();
  let invalidRequirementCount = 0;
  let withCommandCount = 0;
  let withoutCommandCount = 0;
  let realHostRequirementCount = 0;
  let deterministicRequirementCount = 0;
  const proofSourceRequirementCounts = createProofSourceRequirementCounts();

  for (const extension of extensions) {
    for (const requirement of extension.evidenceRequirements) {
      if (requirement.releaseValid) {
        continue;
      }

      invalidRequirementCount += 1;

      if (!requirement.remediation) {
        withoutCommandCount += 1;
        continue;
      }

      withCommandCount += 1;

      if (requirement.remediation.requiresRealHost) {
        realHostRequirementCount += 1;
      } else {
        deterministicRequirementCount += 1;
      }

      proofSourceRequirementCounts[requirement.remediation.proofSource] += 1;

      const key = `${requirement.remediation.requiresRealHost ? "host" : "deterministic"}:${requirement.remediation.command}`;
      const summary = commandSummaries.get(key) ?? {
        adapters: new Set<string>(),
        kinds: new Set<string>(),
        proofSources: new Set<ReleaseEvidenceRemediationProofSource>(),
        remediation: requirement.remediation,
        requirementCount: 0
      };

      summary.adapters.add(extension.id);
      summary.kinds.add(requirement.kind);
      summary.proofSources.add(requirement.remediation.proofSource);
      summary.requirementCount += 1;
      commandSummaries.set(key, summary);
    }
  }

  return {
    invalidRequirementCount,
    withCommandCount,
    withoutCommandCount,
    realHostRequirementCount,
    deterministicRequirementCount,
    proofSourceRequirementCounts,
    commands: [...commandSummaries.values()]
      .map((summary) => ({
        command: summary.remediation.command,
        proofSources: [...summary.proofSources].sort(),
        requiresRealHost: summary.remediation.requiresRealHost,
        requirementCount: summary.requirementCount,
        adapters: [...summary.adapters].sort(),
        kinds: [...summary.kinds].sort()
      }))
      .sort((left, right) => left.command.localeCompare(right.command))
  };
}

function checksumCommandFor(adapterId: string): string {
  if (adapterId === "dx.affinity-content.bridge") {
    return "npm run package:affinity-release-checksum:j1";
  }

  if (officeGoogleAdapters.has(adapterId)) {
    return "npm run package:office-google-release-checksum:j1";
  }

  return `npm run package:package-output-release-checksum:j1 -- -AdapterId ${adapterId}`;
}

function browserTargetFromReceiptPath(receiptPath: string): "chrome" | "edge" | "firefox" | undefined {
  if (receiptPath.endsWith("/chrome-loaded-profile-latest.json")) {
    return "chrome";
  }

  if (receiptPath.endsWith("/edge-loaded-profile-latest.json")) {
    return "edge";
  }

  if (receiptPath.endsWith("/firefox-loaded-profile-latest.json")) {
    return "firefox";
  }

  return undefined;
}

function commandRemediation(
  command: string | undefined,
  proofSource: ReleaseEvidenceRemediationProofSource,
  requiresRealHost: boolean
): ReleaseEvidenceRequirementRemediation | undefined {
  return command ? { command, proofSource, requiresRealHost } : undefined;
}

function createProofSourceRequirementCounts(): Record<ReleaseEvidenceRemediationProofSource, number> {
  return Object.fromEntries(releaseEvidenceRemediationProofSources.map((proofSource) => [proofSource, 0])) as Record<
    ReleaseEvidenceRemediationProofSource,
    number
  >;
}
