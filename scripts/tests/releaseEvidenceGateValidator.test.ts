import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { validateReleaseEvidenceGates } from "../validate-release-evidence-gates.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-release-evidence-gates-"));

try {
  writeValidWorkspace();

  assert.deepEqual(
    validateReleaseEvidenceGates(workspaceRoot),
    [],
    "valid release evidence gates should pass"
  );

  writeGateRegistry([createGateEntry("dx.alpha.command-center")]);
  assertMessages(validateReleaseEvidenceGates(workspaceRoot), [
    "missing release evidence gate for official extension: dx.beta.command-center"
  ]);

  writeGateRegistry([
    createGateEntry("dx.alpha.command-center"),
    createGateEntry("dx.alpha.command-center"),
    createGateEntry("dx.beta.command-center")
  ]);
  assertMessages(validateReleaseEvidenceGates(workspaceRoot), [
    "duplicate release evidence gate id: dx.alpha.command-center"
  ]);

  writeGateRegistry([
    createGateEntry("dx.alpha.command-center"),
    createGateEntry("dx.beta.command-center"),
    createGateEntry("dx.unknown.command-center")
  ]);
  assertMessages(validateReleaseEvidenceGates(workspaceRoot), [
    "release evidence gate is not in official registry: dx.unknown.command-center"
  ]);

  writeGateRegistry([
    createGateEntry("dx.alpha.command-center", {}, ["package_output", "signing", "checksum", "distribution_review"]),
    createGateEntry("dx.beta.command-center")
  ]);
  assertMessages(validateReleaseEvidenceGates(workspaceRoot), [
    "release evidence for dx.alpha.command-center must include host_execution"
  ]);

  writeGateRegistry([
    createGateEntry("dx.alpha.command-center", {}, ["host_execution", "signing", "checksum", "distribution_review"]),
    createGateEntry("dx.beta.command-center")
  ]);
  assertMessages(validateReleaseEvidenceGates(workspaceRoot), [
    "release evidence for dx.alpha.command-center must include package_output"
  ]);

  writeGateRegistry([
    createGateEntry("dx.alpha.command-center", {
      evidence_receipts: ["G:/bad/path.json"]
    }),
    createGateEntry("dx.beta.command-center")
  ]);
  assertMessages(validateReleaseEvidenceGates(workspaceRoot), [
    "release evidence receipt for dx.alpha.command-center must be a safe relative path: G:/bad/path.json"
  ]);

  writeGateRegistry([
    createGateEntry("dx.alpha.command-center", {}, [
      ...requiredEvidenceFor("dx.alpha.command-center"),
      "unreviewed_release_claim"
    ]),
    createGateEntry("dx.beta.command-center")
  ]);
  assertMessages(validateReleaseEvidenceGates(workspaceRoot), [
    "release evidence kind for dx.alpha.command-center is unsupported: unreviewed_release_claim",
    "release evidence receipt requirement kind for dx.alpha.command-center is unsupported: unreviewed_release_claim"
  ]);

  writeGateRegistry([
    createGateEntry("dx.alpha.command-center", {}, [
      "host_execution",
      "package_output",
      "signing",
      "checksum",
      "distribution_review"
    ]),
    createGateEntry("dx.beta.command-center")
  ]);
  assertMessages(validateReleaseEvidenceGates(workspaceRoot), [
    "release evidence for dx.alpha.command-center must include manifest-required local_service"
  ]);

  writeGateRegistry([
    createGateEntry("dx.alpha.command-center"),
    createGateEntry("dx.beta.command-center", {}, [
      "host_execution",
      "package_output",
      "signing",
      "checksum",
      "distribution_review"
    ])
  ]);
  assertMessages(validateReleaseEvidenceGates(workspaceRoot), [
    "release evidence for dx.beta.command-center must include manifest-required cloud_service"
  ]);

  writeGateRegistry([
    createGateEntry("dx.alpha.command-center", {
      evidence_receipt_requirements: [
        "host_execution=.dx/receipts/extensions/dx.alpha.command-center/loaded-host.json",
        "package_output=.dx/receipts/extensions/dx.alpha.command-center/package-output-latest.json",
        "signing=.dx/receipts/extensions/dx.alpha.command-center/signing-latest.json",
        "checksum=.dx/receipts/extensions/dx.alpha.command-center/checksum-latest.json",
        "distribution_review=.dx/receipts/extensions/dx.alpha.command-center/distribution-latest.json"
      ]
    }),
    createGateEntry("dx.beta.command-center")
  ]);
  assertMessages(validateReleaseEvidenceGates(workspaceRoot), [
    "release evidence for dx.alpha.command-center must map local_service to at least one receipt requirement"
  ]);

  writeExtensionReadinessRegistry([
    createReadinessEntry("dx.alpha.command-center"),
    createReadinessEntry("dx.beta.command-center")
  ]);
  writeGateRegistry([
    createGateEntry("dx.alpha.command-center", {
      stage: "release-ready",
      blocked_by: []
    }),
    createGateEntry("dx.beta.command-center")
  ]);
  assertMessages(validateReleaseEvidenceGates(workspaceRoot), [
    "release-ready gate for dx.alpha.command-center requires extension-readiness stage release-ready"
  ]);

  writeExtensionReadinessRegistry([
    createReadinessEntry("dx.alpha.command-center", {
      stage: "release-ready",
      blocked_by: [],
      loaded_host_receipt: ".dx/receipts/extensions/dx.alpha.command-center/loaded-host.json",
      package_receipt: ".dx/receipts/extensions/dx.alpha.command-center/package-output-latest.json",
      signing_receipt: ".dx/receipts/extensions/dx.alpha.command-center/signing-latest.json",
      checksum_receipt: ".dx/receipts/extensions/dx.alpha.command-center/checksum-latest.json",
      distribution_receipt: ".dx/receipts/extensions/dx.alpha.command-center/distribution-latest.json"
    }),
    createReadinessEntry("dx.beta.command-center")
  ]);
  writeGateRegistry([
    createGateEntry("dx.alpha.command-center"),
    createGateEntry("dx.beta.command-center")
  ]);
  assertMessages(validateReleaseEvidenceGates(workspaceRoot), [
    "extension-readiness release-ready stage for dx.alpha.command-center requires release evidence gate stage release-ready"
  ]);
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("release evidence gate validator verified");

function assertMessages(actualMessages: string[], expectedMessages: string[]): void {
  for (const message of expectedMessages) {
    assert.ok(
      actualMessages.includes(message),
      `expected validation message: ${message}\nactual: ${actualMessages.join("\n")}`
    );
  }
}

function writeValidWorkspace(): void {
  mkdirSync(join(workspaceRoot, "registry"), { recursive: true });
  writeOfficialRegistry([
    createRegistryEntry("dx.alpha.command-center", "hosts/alpha"),
    createRegistryEntry("dx.beta.command-center", "hosts/beta")
  ]);
  writeManifest("hosts/alpha/dx.extension.toml", "dx.alpha.command-center", ["local_service.connect"]);
  writeManifest("hosts/beta/dx.extension.toml", "dx.beta.command-center", ["cloud_service.connect"]);
  writeGateRegistry([
    createGateEntry("dx.alpha.command-center"),
    createGateEntry("dx.beta.command-center")
  ]);
}

function createRegistryEntry(id: string, path: string): Record<string, unknown> {
  return {
    id,
    name: id,
    path,
    manifest: `${path}/dx.extension.toml`,
    status: "experimental",
    professional_targets: ["fixture.host"]
  };
}

function createGateEntry(
  id: string,
  overrides: Record<string, unknown> = {},
  requiredEvidence = requiredEvidenceFor(id)
): Record<string, unknown> {
  const evidenceReceiptRequirements = requiredEvidence.map(
    (kind) => `${kind}=.dx/receipts/extensions/${id}/${receiptNameFor(kind)}`
  );

  return {
    id,
    stage: "not-release-ready",
    required_evidence: requiredEvidence,
    evidence_receipt_requirements: evidenceReceiptRequirements,
    evidence_receipts: evidenceReceiptRequirements.map((requirement) => requirement.split("=")[1]),
    next_release_proof: "capture loaded-host receipt",
    blocked_by: ["loaded-host receipt"],
    ...overrides
  };
}

function createReadinessEntry(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    stage: "source-level",
    manifest: id === "dx.alpha.command-center"
      ? "hosts/alpha/dx.extension.toml"
      : "hosts/beta/dx.extension.toml",
    source_guard: "test:fixture-adapter",
    latest_readiness_receipt: `.dx/receipts/extensions/${id}/readiness-latest.json`,
    next_proof: "capture loaded-host receipt",
    blocked_by: ["loaded-host receipt"],
    ...overrides
  };
}

function writeOfficialRegistry(entries: Array<Record<string, unknown>>): void {
  const source = [
    'schema = "dx.extensions.registry"',
    "manifest_version = 1",
    "",
    ...entries.map(formatRegistryEntry)
  ].join("\n");

  writeFileSync(join(workspaceRoot, "registry", "official-extensions.toml"), `${source}\n`);
}

function writeManifest(relativePath: string, id: string, capabilities: string[]): void {
  const source = [
    "[extension]",
    `id = "${id}"`,
    "",
    ...capabilities.map((capability) =>
      ["[[capabilities]]", `id = "${capability}"`, ""].join("\n")
    )
  ].join("\n");
  const absolutePath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${source}\n`);
}

function writeGateRegistry(entries: Array<Record<string, unknown>>): void {
  const source = [
    'schema = "dx.release_evidence_gates"',
    "manifest_version = 1",
    "",
    ...entries.map(formatGateEntry)
  ].join("\n");

  writeFileSync(join(workspaceRoot, "registry", "release-evidence-gates.toml"), `${source}\n`);
}

function writeExtensionReadinessRegistry(entries: Array<Record<string, unknown>>): void {
  const source = [
    'schema = "dx.extension_readiness"',
    "manifest_version = 1",
    "",
    ...entries.map(formatReadinessEntry)
  ].join("\n");

  writeFileSync(join(workspaceRoot, "registry", "extension-readiness.toml"), `${source}\n`);
}

function formatRegistryEntry(entry: Record<string, unknown>): string {
  return [
    "[[extensions]]",
    `id = "${entry.id}"`,
    `name = "${entry.name}"`,
    `path = "${entry.path}"`,
    `manifest = "${entry.manifest}"`,
    `status = "${entry.status}"`,
    `professional_targets = ${formatStringArray(entry.professional_targets as string[])}`,
    ""
  ].join("\n");
}

function formatGateEntry(entry: Record<string, unknown>): string {
  return [
    "[[extensions]]",
    `id = "${entry.id}"`,
    `stage = "${entry.stage}"`,
    `required_evidence = ${formatStringArray(entry.required_evidence as string[])}`,
    `evidence_receipt_requirements = ${formatStringArray(entry.evidence_receipt_requirements as string[])}`,
    `evidence_receipts = ${formatStringArray(entry.evidence_receipts as string[])}`,
    `next_release_proof = "${entry.next_release_proof}"`,
    `blocked_by = ${formatStringArray(entry.blocked_by as string[])}`,
    ""
  ].join("\n");
}

function formatReadinessEntry(entry: Record<string, unknown>): string {
  return [
    "[[extensions]]",
    `id = "${entry.id}"`,
    `stage = "${entry.stage}"`,
    `manifest = "${entry.manifest}"`,
    `source_guard = "${entry.source_guard}"`,
    `latest_readiness_receipt = "${entry.latest_readiness_receipt}"`,
    `next_proof = "${entry.next_proof}"`,
    `blocked_by = ${formatStringArray(entry.blocked_by as string[])}`,
    ...formatOptionalReceiptFields(entry),
    ""
  ].join("\n");
}

function formatOptionalReceiptFields(entry: Record<string, unknown>): string[] {
  return [
    "loaded_host_receipt",
    "package_receipt",
    "signing_receipt",
    "checksum_receipt",
    "distribution_receipt"
  ].flatMap((key) => typeof entry[key] === "string" ? [`${key} = "${entry[key]}"`] : []);
}

function formatStringArray(values: string[]): string {
  return `[${values.map((value) => `"${value}"`).join(", ")}]`;
}

function requiredEvidenceFor(id: string): string[] {
  const evidence = [
    "host_execution",
    "package_output",
    "signing",
    "checksum",
    "distribution_review"
  ];

  if (id === "dx.alpha.command-center") {
    evidence.push("local_service");
  }

  if (id === "dx.beta.command-center") {
    evidence.push("cloud_service");
  }

  return evidence;
}

function receiptNameFor(kind: string): string {
  const names: Record<string, string> = {
    host_execution: "loaded-host.json",
    package_output: "package-output-latest.json",
    signing: "signing-latest.json",
    checksum: "checksum-latest.json",
    distribution_review: "distribution-latest.json",
    local_service: "local-service-latest.json",
    cloud_service: "cloud-service-latest.json"
  };

  return names[kind] ?? `${kind.replaceAll("_", "-")}-latest.json`;
}
