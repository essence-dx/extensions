import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { writeReleaseEvidenceGapReport } from "../write-release-evidence-gap-report.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-release-gap-remediation-"));

try {
  writeWorkspaceFixtures();

  const report = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-09T00:00:00.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });
  const obsidian = report.extensions.find((entry) => entry.id === "dx.obsidian.command-center");

  assert.ok(obsidian, "Obsidian must be present in the release gap report.");
  const hostExecution = obsidian.evidenceRequirements.find((entry) => entry.kind === "host_execution");

  assert.equal(hostExecution?.exists, false);
  assert.equal(hostExecution?.releaseValid, false);
  assert.deepEqual(hostExecution?.remediation, {
    command: "npm run smoke:application-loaded-host:j1",
    proofSource: "host_application",
    requiresRealHost: true
  });

  const missingOrWeakRequirements = report.extensions.flatMap((extension) =>
    extension.evidenceRequirements.filter((requirement) => !requirement.releaseValid)
  );

  assert.equal(
    missingOrWeakRequirements.every((requirement) => Boolean(requirement.remediation)),
    true,
    "Every missing or weak release evidence receipt must include a guarded remediation command."
  );
  assert.deepEqual(report.remediation, {
    invalidRequirementCount: 6,
    withCommandCount: 6,
    withoutCommandCount: 0,
    realHostRequirementCount: 1,
    deterministicRequirementCount: 5,
    proofSourceRequirementCounts: {
      developer_attestation: 0,
      host_application: 1,
      marketplace_review: 2,
      service_endpoint: 0,
      signature_authority: 1,
      workspace_artifact: 2
    },
    commands: [
      {
        command: "npm run build:obsidian:j1",
        proofSources: ["workspace_artifact"],
        requiresRealHost: false,
        requirementCount: 1,
        adapters: ["dx.obsidian.command-center"],
        kinds: ["package_output"]
      },
      {
        command: "npm run package:package-output-release-checksum:j1 -- -AdapterId dx.obsidian.command-center",
        proofSources: ["workspace_artifact"],
        requiresRealHost: false,
        requirementCount: 1,
        adapters: ["dx.obsidian.command-center"],
        kinds: ["checksum"]
      },
      {
        command: "npm run smoke:application-loaded-host:j1",
        proofSources: ["host_application"],
        requiresRealHost: true,
        requirementCount: 1,
        adapters: ["dx.obsidian.command-center"],
        kinds: ["host_execution"]
      },
      {
        command: "npm run smoke:distribution-review:j1",
        proofSources: ["marketplace_review"],
        requiresRealHost: false,
        requirementCount: 2,
        adapters: ["dx.obsidian.command-center"],
        kinds: ["community_review", "distribution_review"]
      },
      {
        command: "npm run smoke:package-signing:j1",
        proofSources: ["signature_authority"],
        requiresRealHost: false,
        requirementCount: 1,
        adapters: ["dx.obsidian.command-center"],
        kinds: ["signing"]
      }
    ]
  });
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("release evidence remediation coverage verified");

function writeWorkspaceFixtures(): void {
  writeWorkspaceFile(
    "registry/official-extensions.toml",
    `
schema = "dx.extensions.registry"
manifest_version = 1

[[extensions]]
id = "dx.obsidian.command-center"
name = "DX Obsidian Command Center"
path = "hosts/obsidian/dx-command-center"
manifest = "hosts/obsidian/dx-command-center/dx.extension.toml"
status = "experimental"
professional_targets = ["obsidian.plugins"]
`
  );
  writeWorkspaceFile(
    "hosts/obsidian/dx-command-center/dx.extension.toml",
    `
[extension]
id = "dx.obsidian.command-center"
`
  );
  writeWorkspaceFile(
    "registry/release-evidence-gates.toml",
    `
schema = "dx.release_evidence_gates"
manifest_version = 1

[[extensions]]
id = "dx.obsidian.command-center"
stage = "not-release-ready"
required_evidence = ["host_execution", "package_output", "signing", "checksum", "distribution_review", "community_review"]
evidence_receipt_requirements = ["host_execution=.dx/receipts/extensions/dx.obsidian.command-center/loaded-vault-latest.json", "package_output=.dx/receipts/extensions/dx.obsidian.command-center/package-output-latest.json", "signing=.dx/receipts/extensions/dx.obsidian.command-center/signing-latest.json", "checksum=.dx/receipts/extensions/dx.obsidian.command-center/checksum-latest.json", "distribution_review=.dx/receipts/extensions/dx.obsidian.command-center/community-review-latest.json", "community_review=.dx/receipts/extensions/dx.obsidian.command-center/community-review-latest.json"]
evidence_receipts = [".dx/receipts/extensions/dx.obsidian.command-center/loaded-vault-latest.json", ".dx/receipts/extensions/dx.obsidian.command-center/package-output-latest.json", ".dx/receipts/extensions/dx.obsidian.command-center/signing-latest.json", ".dx/receipts/extensions/dx.obsidian.command-center/checksum-latest.json", ".dx/receipts/extensions/dx.obsidian.command-center/community-review-latest.json"]
next_release_proof = "Load the plugin in an isolated Obsidian vault and capture command palette receipts."
blocked_by = ["loaded vault receipt", "release asset proof", "community plugin review proof"]
`
  );
}

function writeWorkspaceFile(relativePath: string, source: string): void {
  const absolutePath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);
}
