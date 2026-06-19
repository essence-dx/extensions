import { existsSync, readFileSync } from "node:fs";
import { join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import { parseTomlDocument } from "./lib/toml-lite.ts";
import {
  groupEvidenceReceiptRequirements,
  parseEvidenceReceiptRequirement
} from "./release-evidence-requirements.ts";

const officialRegistryRelativePath = "registry/official-extensions.toml";
const extensionReadinessRelativePath = "registry/extension-readiness.toml";
const releaseGatesRelativePath = "registry/release-evidence-gates.toml";
const allowedStages = new Set(["not-release-ready", "release-ready"]);
const requiredEvidenceKinds = [
  "host_execution",
  "package_output",
  "signing",
  "checksum",
  "distribution_review"
];
const allowedEvidenceKinds = new Set([
  "addon_install",
  "apps_script_deployment",
  "appsource_review",
  "canva_review",
  "ccx_package",
  "checksum",
  "cloud_service",
  "community_review",
  "content_package",
  "developer_docs",
  "distribution_review",
  "experimental_instance",
  "gallery_review",
  "host_execution",
  "local_service",
  "manual_import",
  "marketplace_review",
  "native_host_package",
  "native_or_hybrid_plugin",
  "notarization",
  "oauth_review",
  "package_output",
  "photoshop_filter_plugin",
  "plugin_id",
  "plugin_verifier",
  "project_enablement",
  "project_import",
  "signing",
  "sketchtool_run",
  "workflow_integration"
]);

export function validateReleaseEvidenceGates(root = process.cwd()): string[] {
  const failures: string[] = [];
  const officialEntries = readOfficialRegistry(root, failures);
  const readinessEntries = readExtensionReadinessStages(root, failures);
  const releaseGatesPath = join(root, releaseGatesRelativePath);

  if (!existsSync(releaseGatesPath)) {
    return [...failures, `missing release evidence gates registry: ${releaseGatesRelativePath}`];
  }

  const releaseGates = parseTomlDocument(readFileSync(releaseGatesPath, "utf8"));

  if (releaseGates.root.schema !== "dx.release_evidence_gates") {
    failures.push("release evidence gates schema must be dx.release_evidence_gates");
  }

  if (releaseGates.root.manifest_version !== 1) {
    failures.push("release evidence gates manifest_version must be 1");
  }

  const officialById = new Map(officialEntries.map((entry) => [entry.id, entry]));
  const gateEntries = releaseGates.arrays.extensions ?? [];
  const gatesById = new Map<string, Record<string, unknown>>();

  for (const entry of gateEntries) {
    const id = expectNonEmptyString(entry.id, "release evidence gate id", failures);
    if (!id) {
      continue;
    }

    if (gatesById.has(id)) {
      failures.push(`duplicate release evidence gate id: ${id}`);
    }
    gatesById.set(id, entry);

    const officialEntry = officialById.get(id);
    if (!officialEntry) {
      failures.push(`release evidence gate is not in official registry: ${id}`);
      continue;
    }

    validateGateEntry(root, id, entry, officialEntry, failures);
    validateReleaseReadyStageParity(id, entry, readinessEntries, failures);
  }

  for (const officialEntry of officialEntries) {
    if (!gatesById.has(officialEntry.id)) {
      failures.push(`missing release evidence gate for official extension: ${officialEntry.id}`);
    }
  }

  validateReadinessReleaseReadyParity(gatesById, readinessEntries, failures);

  return failures;
}

if (isDirectRun()) {
  const failures = validateReleaseEvidenceGates();

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(failure);
    }
    process.exit(1);
  }

  console.log("release evidence gates verified");
}

function validateGateEntry(
  root: string,
  id: string,
  entry: Record<string, unknown>,
  officialEntry: OfficialRegistryEntry,
  failures: string[]
): void {
  const stage = expectNonEmptyString(entry.stage, `release evidence stage for ${id}`, failures);
  const requiredEvidence = expectStringArray(
    entry.required_evidence,
    `release evidence required_evidence for ${id}`,
    failures
  );
  const evidenceReceipts = expectStringArray(
    entry.evidence_receipts,
    `release evidence receipts for ${id}`,
    failures
  );
  const evidenceReceiptRequirementValues = expectStringArray(
    entry.evidence_receipt_requirements,
    `release evidence receipt requirements for ${id}`,
    failures
  );
  expectNonEmptyString(entry.next_release_proof, `release evidence next_release_proof for ${id}`, failures);
  const blockedBy = expectStringArray(entry.blocked_by, `release evidence blocked_by for ${id}`, failures);

  if (stage && !allowedStages.has(stage)) {
    failures.push(`release evidence stage for ${id} is unsupported: ${stage}`);
  }

  for (const evidenceKind of requiredEvidenceKinds) {
    if (!requiredEvidence.includes(evidenceKind)) {
      failures.push(`release evidence for ${id} must include ${evidenceKind}`);
    }
  }

  for (const evidenceKind of readManifestRequiredEvidenceKinds(root, officialEntry.manifest, failures)) {
    if (!requiredEvidence.includes(evidenceKind)) {
      failures.push(`release evidence for ${id} must include manifest-required ${evidenceKind}`);
    }
  }

  for (const evidenceKind of requiredEvidence) {
    if (!isSafeEvidenceKind(evidenceKind)) {
      failures.push(`release evidence kind for ${id} must be lowercase snake_case: ${evidenceKind}`);
    }

    if (!allowedEvidenceKinds.has(evidenceKind)) {
      failures.push(`release evidence kind for ${id} is unsupported: ${evidenceKind}`);
    }
  }

  const receiptRequirements = evidenceReceiptRequirementValues.flatMap((value) => {
    const requirement = parseEvidenceReceiptRequirement(value);

    if (!requirement) {
      failures.push(`release evidence receipt requirement for ${id} must be kind=path: ${value}`);
      return [];
    }

    if (!isSafeEvidenceKind(requirement.kind)) {
      failures.push(`release evidence receipt requirement kind for ${id} must be lowercase snake_case: ${requirement.kind}`);
    }

    if (!allowedEvidenceKinds.has(requirement.kind)) {
      failures.push(`release evidence receipt requirement kind for ${id} is unsupported: ${requirement.kind}`);
    }

    if (!requiredEvidence.includes(requirement.kind)) {
      failures.push(`release evidence receipt requirement for ${id} references undeclared evidence kind: ${requirement.kind}`);
    }

    if (!isSafeRepositoryPath(requirement.receiptPath)) {
      failures.push(`release evidence receipt requirement for ${id} must use a safe relative path: ${requirement.receiptPath}`);
    }

    return [requirement];
  });
  const receiptRequirementsByKind = groupEvidenceReceiptRequirements(receiptRequirements);

  for (const evidenceKind of requiredEvidence) {
    if (!receiptRequirementsByKind.has(evidenceKind)) {
      failures.push(`release evidence for ${id} must map ${evidenceKind} to at least one receipt requirement`);
    }
  }

  for (const receiptPath of evidenceReceipts) {
    if (!isSafeRepositoryPath(receiptPath)) {
      failures.push(`release evidence receipt for ${id} must be a safe relative path: ${receiptPath}`);
    }
  }

  validateReceiptPathParity(id, evidenceReceipts, receiptRequirements, failures);

  if (stage === "not-release-ready" && blockedBy.length === 0) {
    failures.push(`release evidence blocked_by for ${id} must include at least one deferred proof`);
  }
}

interface OfficialRegistryEntry {
  id: string;
  manifest: string;
}

interface ExtensionReadinessStages {
  exists: boolean;
  stagesById: Map<string, string>;
}

function readOfficialRegistry(root: string, failures: string[]): OfficialRegistryEntry[] {
  const registryPath = join(root, officialRegistryRelativePath);

  if (!existsSync(registryPath)) {
    failures.push(`missing official registry: ${officialRegistryRelativePath}`);
    return [];
  }

  const registry = parseTomlDocument(readFileSync(registryPath, "utf8"));
  return (registry.arrays.extensions ?? [])
    .map((entry) => ({
      id: typeof entry.id === "string" ? entry.id.trim() : "",
      manifest: typeof entry.manifest === "string" ? entry.manifest.trim() : ""
    }))
    .filter((entry) => entry.id);
}

function readExtensionReadinessStages(root: string, failures: string[]): ExtensionReadinessStages {
  const readinessPath = join(root, extensionReadinessRelativePath);

  if (!existsSync(readinessPath)) {
    return {
      exists: false,
      stagesById: new Map()
    };
  }

  const readiness = parseTomlDocument(readFileSync(readinessPath, "utf8"));

  if (readiness.root.schema !== "dx.extension_readiness") {
    failures.push("extension readiness schema must be dx.extension_readiness");
  }

  if (readiness.root.manifest_version !== 1) {
    failures.push("extension readiness manifest_version must be 1");
  }

  const stagesById = new Map<string, string>();

  for (const entry of readiness.arrays.extensions ?? []) {
    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    const stage = typeof entry.stage === "string" ? entry.stage.trim() : "";

    if (id && stage) {
      stagesById.set(id, stage);
    }
  }

  return {
    exists: true,
    stagesById
  };
}

function validateReleaseReadyStageParity(
  id: string,
  releaseGateEntry: Record<string, unknown>,
  readinessEntries: ExtensionReadinessStages,
  failures: string[]
): void {
  if (releaseGateEntry.stage !== "release-ready") {
    return;
  }

  if (!readinessEntries.exists || readinessEntries.stagesById.get(id) !== "release-ready") {
    failures.push(`release-ready gate for ${id} requires extension-readiness stage release-ready`);
  }
}

function validateReadinessReleaseReadyParity(
  gatesById: Map<string, Record<string, unknown>>,
  readinessEntries: ExtensionReadinessStages,
  failures: string[]
): void {
  for (const [id, stage] of readinessEntries.stagesById) {
    if (stage !== "release-ready") {
      continue;
    }

    if (gatesById.get(id)?.stage !== "release-ready") {
      failures.push(`extension-readiness release-ready stage for ${id} requires release evidence gate stage release-ready`);
    }
  }
}

function readManifestRequiredEvidenceKinds(
  root: string,
  manifest: string,
  failures: string[]
): string[] {
  if (!manifest || !isSafeRepositoryPath(manifest)) {
    return [];
  }

  const manifestPath = join(root, ...manifest.split("/"));

  if (!existsSync(manifestPath)) {
    failures.push(`release evidence manifest does not exist: ${manifest}`);
    return [];
  }

  const document = parseTomlDocument(readFileSync(manifestPath, "utf8"));
  const capabilityIds = new Set(
    (document.arrays.capabilities ?? [])
      .map((capability) => capability.id)
      .filter((id): id is string => typeof id === "string")
  );
  const requiredEvidence: string[] = [];

  if (capabilityIds.has("local_service.connect")) {
    requiredEvidence.push("local_service");
  }

  if (capabilityIds.has("cloud_service.connect")) {
    requiredEvidence.push("cloud_service");
  }

  return requiredEvidence;
}

function validateReceiptPathParity(
  id: string,
  evidenceReceipts: string[],
  receiptRequirements: Array<{ receiptPath: string }>,
  failures: string[]
): void {
  const evidenceReceiptSet = new Set(evidenceReceipts);
  const requirementPathSet = new Set(receiptRequirements.map((requirement) => requirement.receiptPath));

  for (const requirementPath of requirementPathSet) {
    if (!evidenceReceiptSet.has(requirementPath)) {
      failures.push(`release evidence receipts for ${id} must include mapped receipt path: ${requirementPath}`);
    }
  }

  for (const receiptPath of evidenceReceiptSet) {
    if (!requirementPathSet.has(receiptPath)) {
      failures.push(`release evidence receipt for ${id} must have a matching evidence_receipt_requirements entry: ${receiptPath}`);
    }
  }
}

function expectNonEmptyString(
  value: unknown,
  label: string,
  failures: string[]
): string | undefined {
  if (typeof value !== "string" || value.trim() === "") {
    failures.push(`${label} must be a non-empty string`);
    return undefined;
  }

  return value.trim();
}

function expectStringArray(value: unknown, label: string, failures: string[]): string[] {
  if (!Array.isArray(value)) {
    failures.push(`${label} must be an array`);
    return [];
  }

  const values: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || item.trim() === "") {
      failures.push(`${label} must contain only non-empty strings`);
      continue;
    }

    values.push(item.trim());
  }

  return values;
}

function isSafeEvidenceKind(value: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(value);
}

function isSafeRepositoryPath(value: string): boolean {
  if (
    value.includes("\\") ||
    value.includes("://") ||
    value.startsWith("~") ||
    value.startsWith("/") ||
    /^[A-Za-z]:\//.test(value)
  ) {
    return false;
  }

  return !value.split("/").includes("..");
}

function isDirectRun(): boolean {
  if (!process.argv[1]) {
    return false;
  }

  return (
    normalize(process.argv[1]).toLowerCase() ===
    normalize(fileURLToPath(import.meta.url)).toLowerCase()
  );
}
