import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  createHostFreeReleaseArtifactRefreshPlan,
  writeHostFreeReleaseArtifactRefreshPlan
} from "../refresh-host-free-release-artifacts.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-host-free-refresh-"));
const reportPath = join(workspaceRoot, ".dx", "receipts", "extensions", "release-evidence-gaps-latest.json");
const planPath = join(workspaceRoot, ".tmp", "proofs", "host-free-release-artifacts.json");

try {
  writeJson(reportPath, releaseGapReportFixture());

  const plan = createHostFreeReleaseArtifactRefreshPlan(releaseGapReportFixture(), {
    sourceReportPath: reportPath
  });

  assert.equal(plan.sourceReportPath, reportPath);
  assert.deepEqual(
    plan.commands.map((command) => command.command),
    [
      "npm run build:browser:j1",
      "npm run build:obsidian:j1",
      "npm run package:browser-native-host:j1",
      "npm run package:adobe-ccx:j1",
      "npm run package:package-output-release-checksum:j1 -- -AdapterId dx.browser.command-center",
      "npm run package:package-output-release-checksum:j1 -- -AdapterId dx.obsidian.command-center"
    ]
  );
  assert.deepEqual(plan.commands[0], {
    command: "npm run build:browser:j1",
    executable: "npm",
    arguments: ["run", "build:browser:j1"],
    requirementCount: 2,
    adapters: ["dx.browser.command-center", "dx.canva.command-center"],
    kinds: ["package_output"],
    phase: "package_output"
  });
  assert.deepEqual(plan.commands[4]?.arguments, [
    "run",
    "package:package-output-release-checksum:j1",
    "--",
    "-AdapterId",
    "dx.browser.command-center"
  ]);
  assert.equal(
    plan.commands.some((command) => command.command.includes("smoke:")),
    false,
    "host-free artifact refresh must not execute smoke/proof commands"
  );

  const written = writeHostFreeReleaseArtifactRefreshPlan(workspaceRoot, {
    planPath,
    reportPath
  });

  assert.deepEqual(written, {
    ...plan,
    planPath
  });
  assert.deepEqual(JSON.parse(readFileSync(planPath, "utf8")), written);

  const packageJson = JSON.parse(readFileSync(join(import.meta.dirname, "..", "..", "package.json"), "utf8"));
  assert.equal(
    packageJson.scripts["test:host-free-release-artifact-refresh-plan"],
    "node --experimental-strip-types scripts/tests/hostFreeReleaseArtifactRefreshPlan.test.ts"
  );
  assert.equal(
    packageJson.scripts["refresh:host-free-release-artifacts"],
    "npm run refresh:host-free-release-artifacts:j1"
  );
  assert.equal(
    packageJson.scripts["refresh:host-free-release-artifacts:j1"],
    "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/refresh-host-free-release-artifacts-j1.ps1"
  );

  const wrapperSource = readFileSync(
    join(import.meta.dirname, "..", "refresh-host-free-release-artifacts-j1.ps1"),
    "utf8"
  );
  assert.match(wrapperSource, /Set-DxSerialBuildEnvironment/);
  assert.match(wrapperSource, /Assert-DxDriveSpace -MinimumFreeGiB 4/);
  assert.match(wrapperSource, /Assert-NoCompetingHeavyProcess/);
  assert.match(wrapperSource, /"report:release-evidence-gaps:j1"/);
  assert.match(wrapperSource, /"test:host-free-release-artifact-refresh-plan"/);
  assert.match(wrapperSource, /scripts\/refresh-host-free-release-artifacts\.ts/);
  assert.match(wrapperSource, /Invoke-DxCommand \$plannedCommand\.executable \$arguments/);
  assert.match(wrapperSource, /"report:extension-progress:j1"/);
  assert.match(wrapperSource, /"check:generated-output-ignore"/);
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("host-free release artifact refresh plan verified");

function releaseGapReportFixture() {
  return {
    receipt: "dx.extension.release_evidence_gap_report",
    generatedAt: "2026-06-09T00:00:00.000Z",
    receiptPath: reportPath,
    extensions: [
      extension("dx.browser.command-center", [
        requirement("package_output", false, {
          command: "npm run build:browser:j1",
          proofSource: "workspace_artifact",
          requiresRealHost: false
        }),
        requirement("native_host_package", false, {
          command: "npm run package:browser-native-host:j1",
          proofSource: "workspace_artifact",
          requiresRealHost: false
        }),
        requirement("checksum", false, {
          command: "npm run package:package-output-release-checksum:j1 -- -AdapterId dx.browser.command-center",
          proofSource: "workspace_artifact",
          requiresRealHost: false
        }),
        requirement("host_execution", false, {
          command: "npm run smoke:browser-loaded-profile:j1 -- -Target chrome",
          proofSource: "host_application",
          requiresRealHost: true
        })
      ]),
      extension("dx.obsidian.command-center", [
        requirement("package_output", false, {
          command: "npm run build:obsidian:j1",
          proofSource: "workspace_artifact",
          requiresRealHost: false
        }),
        requirement("checksum", false, {
          command: "npm run package:package-output-release-checksum:j1 -- -AdapterId dx.obsidian.command-center",
          proofSource: "workspace_artifact",
          requiresRealHost: false
        }),
        requirement("distribution_review", false, {
          command: "npm run smoke:distribution-review:j1",
          proofSource: "marketplace_review",
          requiresRealHost: false
        }),
        requirement("signing", false, {
          command: "npm run smoke:package-signing:j1",
          proofSource: "signature_authority",
          requiresRealHost: false
        })
      ]),
      extension("dx.photoshop.command-center", [
        requirement("ccx_package", false, {
          command: "npm run package:adobe-ccx:j1",
          proofSource: "workspace_artifact",
          requiresRealHost: false
        }),
        requirement("plugin_id", false, {
          command: "npm run smoke:adobe-uxp-plugin-id:j1",
          proofSource: "developer_attestation",
          requiresRealHost: true
        })
      ]),
      extension("dx.canva.command-center", [
        requirement("package_output", false, {
          command: "npm run build:browser:j1",
          proofSource: "workspace_artifact",
          requiresRealHost: false
        }),
        requirement("cloud_service", false, {
          command: "npm run smoke:canva-cloud-service:j1",
          proofSource: "service_endpoint",
          requiresRealHost: false
        })
      ]),
      extension("dx.zed.command-center", [
        requirement("package_output", true, {
          command: "npm run package:zed:j1",
          proofSource: "workspace_artifact",
          requiresRealHost: false
        })
      ])
    ]
  };
}

function extension(id: string, evidenceRequirements: Array<Record<string, unknown>>): Record<string, unknown> {
  return {
    id,
    evidenceRequirements
  };
}

function requirement(
  kind: string,
  releaseValid: boolean,
  remediation: Record<string, unknown>
): Record<string, unknown> {
  return {
    kind,
    receiptPath: `.dx/receipts/extensions/fixture/${kind}.json`,
    exists: false,
    releaseValid,
    remediation
  };
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
