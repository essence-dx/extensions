import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { writeReleaseEvidenceGapReport } from "../write-release-evidence-gap-report.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-release-gaps-special-evidence-"));
const adapters = [
  {
    adapterId: "dx.figma.command-center",
    host: "figma",
    manifestPath: "hosts/figma/dx-figma/dx.extension.toml",
    specialReceipts: [{ kind: "plugin_id", name: "plugin-id-latest.json" }]
  },
  {
    adapterId: "dx.google-workspace.command-center",
    host: "google-workspace",
    manifestPath: "hosts/google-workspace/dx-google-workspace-addon/dx.extension.toml",
    specialReceipts: [
      { kind: "apps_script_deployment", name: "apps-script-deployment-latest.json" },
      { kind: "cloud_service", name: "cloud-service-latest.json" }
    ]
  },
  {
    adapterId: "dx.canva.command-center",
    host: "canva",
    manifestPath: "hosts/canva/dx-canva/dx.extension.toml",
    specialReceipts: [{ kind: "cloud_service", name: "cloud-service-latest.json" }]
  },
  {
    adapterId: "dx.blender.command-center",
    host: "blender",
    manifestPath: "hosts/blender/dx-blender/dx.extension.toml",
    specialReceipts: [{ kind: "addon_install", name: "addon-install-latest.json" }]
  },
  {
    adapterId: "dx.photoshop.command-center",
    host: "photoshop",
    manifestPath: "hosts/adobe/dx-photoshop-uxp/dx.extension.toml",
    specialReceipts: [{ kind: "plugin_id", name: "plugin-id-latest.json" }]
  },
  {
    adapterId: "dx.premiere-pro.command-center",
    host: "premiere-pro",
    manifestPath: "hosts/adobe/dx-premiere-pro-uxp/dx.extension.toml",
    specialReceipts: [
      { kind: "plugin_id", name: "plugin-id-latest.json" },
      { kind: "native_or_hybrid_plugin", name: "native-plugin-latest.json" }
    ]
  },
  {
    adapterId: "dx.indesign.command-center",
    host: "indesign",
    manifestPath: "hosts/adobe/dx-indesign-uxp/dx.extension.toml",
    specialReceipts: [
      { kind: "plugin_id", name: "plugin-id-latest.json" },
      { kind: "native_or_hybrid_plugin", name: "native-plugin-latest.json" }
    ]
  },
  {
    adapterId: "dx.sketch.command-center",
    host: "sketch",
    manifestPath: "hosts/sketch/dx-sketch/dx.extension.toml",
    specialReceipts: [
      { kind: "sketchtool_run", name: "sketchtool-latest.json" },
      { kind: "notarization", name: "notarization-latest.json" }
    ]
  },
  {
    adapterId: "dx.affinity-content.bridge",
    host: "affinity",
    manifestPath: "hosts/affinity/dx-affinity-content/dx.extension.toml",
    specialReceipts: [{ kind: "manual_import", name: "manual-import-latest.json" }]
  },
  {
    adapterId: "dx.davinci-resolve.command-center",
    host: "davinci-resolve",
    manifestPath: "hosts/blackmagic/dx-davinci-resolve/dx.extension.toml",
    specialReceipts: [{ kind: "developer_docs", name: "developer-docs-latest.json" }]
  }
] as const;

try {
  writeGateFixtures();

  for (const adapter of adapters) {
    for (const receipt of adapter.specialReceipts) {
      writeWorkspaceFile(`.dx/receipts/extensions/${adapter.adapterId}/${receipt.name}`, "{}\n");
    }
  }

  const report = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });

  for (const adapter of adapters) {
    const extension = report.extensions.find((entry) => entry.id === adapter.adapterId);

    assert.ok(extension, `${adapter.adapterId} must be present in the gap report.`);

    for (const receipt of adapter.specialReceipts) {
      const requirement = extension.evidenceRequirements.find((entry) => entry.kind === receipt.kind);

      assert.equal(requirement?.exists, true);
      assert.equal(requirement?.releaseValid, false, `${receipt.kind} placeholder must be weak.`);
      assert.match(requirement?.weakness ?? "", /receipt|evidence/i);
      assert.ok(extension.weakEvidence.includes(receipt.kind));
      assert.ok(extension.missingEvidence.includes(receipt.kind));

      if (adapter.adapterId === "dx.davinci-resolve.command-center" && receipt.kind === "developer_docs") {
        assert.deepEqual(requirement?.remediation, {
          command: "npm run smoke:davinci-resolve-developer-docs:j1",
          proofSource: "developer_attestation",
          requiresRealHost: false
        });
      }

      if (isAdobeUxpPluginId(adapter.adapterId, receipt.kind)) {
        assert.deepEqual(requirement?.remediation, {
          command: "npm run smoke:adobe-uxp-plugin-id:j1",
          proofSource: "developer_attestation",
          requiresRealHost: true
        });
      }
    }
  }
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("special release evidence classification verified");

function writeGateFixtures(): void {
  writeWorkspaceFile(
    "registry/official-extensions.toml",
    `
schema = "dx.extensions.registry"
manifest_version = 1

${adapters
  .map(
    (adapter) => `
[[extensions]]
id = "${adapter.adapterId}"
name = "${adapter.adapterId}"
path = "${dirname(adapter.manifestPath).split("\\").join("/")}"
manifest = "${adapter.manifestPath}"
status = "experimental"
professional_targets = ["${adapter.host}"]
`
  )
  .join("\n")}
`
  );

  for (const adapter of adapters) {
    writeWorkspaceFile(
      adapter.manifestPath,
      `
[extension]
id = "${adapter.adapterId}"
`
    );
  }

  writeWorkspaceFile(
    "registry/release-evidence-gates.toml",
    `
schema = "dx.release_evidence_gates"
manifest_version = 1

${adapters.map(writeGateEntry).join("\n")}
`
  );
}

function writeGateEntry(adapter: (typeof adapters)[number]): string {
  const baseRequirements = [
    `host_execution=.dx/receipts/extensions/${adapter.adapterId}/loaded-host-latest.json`,
    `package_output=.dx/receipts/extensions/${adapter.adapterId}/package-output-latest.json`,
    `signing=.dx/receipts/extensions/${adapter.adapterId}/signing-latest.json`,
    `checksum=.dx/receipts/extensions/${adapter.adapterId}/checksum-latest.json`,
    `distribution_review=.dx/receipts/extensions/${adapter.adapterId}/distribution-latest.json`
  ];
  const specialRequirements = adapter.specialReceipts.map(
    (receipt) => `${receipt.kind}=.dx/receipts/extensions/${adapter.adapterId}/${receipt.name}`
  );
  const requirements = [...baseRequirements, ...specialRequirements];
  const requiredEvidence = [
    "host_execution",
    "package_output",
    "signing",
    "checksum",
    "distribution_review",
    ...adapter.specialReceipts.map((receipt) => receipt.kind)
  ];
  const receiptPaths = requirements.map((requirement) => requirement.split("=")[1]);

  return `
[[extensions]]
id = "${adapter.adapterId}"
stage = "not-release-ready"
required_evidence = ${tomlStringArray(requiredEvidence)}
evidence_receipt_requirements = ${tomlStringArray(requirements)}
evidence_receipts = ${tomlStringArray(receiptPaths)}
next_release_proof = "Capture ${adapter.host} special proof"
blocked_by = ["special proof"]
`;
}

function tomlStringArray(values: readonly string[]): string {
  return `[${values.map((value) => JSON.stringify(value)).join(", ")}]`;
}

function writeWorkspaceFile(relativePath: string, source: string): void {
  const absolutePath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);
}

function isAdobeUxpPluginId(adapterId: string, kind: string): boolean {
  return (
    kind === "plugin_id" &&
    [
      "dx.photoshop.command-center",
      "dx.premiere-pro.command-center",
      "dx.indesign.command-center"
    ].includes(adapterId)
  );
}
