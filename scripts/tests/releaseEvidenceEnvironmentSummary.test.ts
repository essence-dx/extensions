import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { readReleaseEvidenceEnvironmentSummary } from "../lib/release-evidence-environment-summary.ts";
import { hashSourceInputs, readSourceInputProofs } from "../lib/source-input-proof.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-release-evidence-environment-"));
const sourceInputPathsByAdapterId = new Map<string, string[]>([
  [
    "dx.canva.command-center",
    ["canva-app.json", "src/app.tsx", "src/commandPlans.ts", "src/messages.ts"]
  ],
  [
    "dx.excel.command-center",
    [
      "dx-excel/manifest.xml",
      "dx-excel/src/commandPlans.ts",
      "dx-excel/src/messages.ts",
      "dx-excel/src/taskpane.ts",
      "dx-excel/static/taskpane.html",
      "shared/localServiceBoundary.ts"
    ]
  ],
  [
    "dx.figma.command-center",
    ["manifest.json", "src/commandPlans.ts", "src/main.ts", "src/messages.ts", "ui.html"]
  ],
  [
    "dx.google-workspace.command-center",
    [
      "appsscript.json",
      "src/cards.ts",
      "src/commandPlans.ts",
      "src/entrypoints.ts",
      "src/localServiceBoundary.ts",
      "src/messages.ts"
    ]
  ]
]);
const packageReceiptFixtureByAdapterId = new Map<
  string,
  { receipt: string; host: string; format: string }
>([
  [
    "dx.canva.command-center",
    { receipt: "dx.extension.figma_canva.package_output", host: "canva", format: "canva-app" }
  ],
  [
    "dx.excel.command-center",
    { receipt: "dx.extension.office_taskpane.package_output", host: "excel", format: "office-taskpane" }
  ],
  [
    "dx.figma.command-center",
    { receipt: "dx.extension.figma_canva.package_output", host: "figma", format: "figma-plugin" }
  ],
  [
    "dx.google-workspace.command-center",
    {
      receipt: "dx.extension.google_workspace.apps_script_package_output",
      host: "google-workspace",
      format: "apps-script"
    }
  ]
]);

try {
  writeLoadedHostPreflightReceipt("dx.figma.command-center", [
    "loaded Figma desktop receipt",
    "generated plugin ID proof",
    "Community review proof",
    "signing receipt",
    "unmapped design audit"
  ]);
  writeLoadedHostPreflightReceipt("dx.canva.command-center", [
    "development Canva app receipt",
    "cloud-service proof",
    "Canva review proof"
  ]);
  writeLoadedHostPreflightReceipt("dx.google-workspace.command-center", [
    "test Workspace file receipt",
    "Apps Script deployment proof",
    "OAuth consent proof",
    "Marketplace review proof"
  ]);
  writeLoadedHostPreflightReceipt("dx.excel.command-center", [
    "sideloaded Excel receipt",
    "AppSource readiness proof"
  ]);

  const figma = readReleaseEvidenceEnvironmentSummary(workspaceRoot, "dx.figma.command-center", {
    releaseValidEvidenceKinds: ["host_execution", "plugin_id", "community_review"]
  });

  assert.deepEqual(figma.loadedHostPreflight?.blockedBy, [
    "loaded Figma desktop receipt",
    "generated plugin ID proof",
    "Community review proof",
    "signing receipt",
    "unmapped design audit"
  ]);
  assert.deepEqual(figma.blockers, [
    "loaded-host preflight: signing receipt",
    "loaded-host preflight: unmapped design audit"
  ]);

  const canva = readReleaseEvidenceEnvironmentSummary(workspaceRoot, "dx.canva.command-center", {
    releaseValidEvidenceKinds: ["host_execution", "cloud_service", "canva_review"]
  });

  assert.deepEqual(canva.blockers, []);

  const googleWorkspace = readReleaseEvidenceEnvironmentSummary(
    workspaceRoot,
    "dx.google-workspace.command-center",
    {
      releaseValidEvidenceKinds: [
        "host_execution",
        "apps_script_deployment",
        "oauth_review",
        "distribution_review"
      ]
    }
  );

  assert.deepEqual(googleWorkspace.blockers, []);

  const excel = readReleaseEvidenceEnvironmentSummary(workspaceRoot, "dx.excel.command-center", {
    releaseValidEvidenceKinds: ["host_execution"]
  });

  assert.deepEqual(excel.blockers, ["loaded-host preflight: AppSource readiness proof"]);

  const stalePackageAdapterId = "dx.stale-package.command-center";
  const stalePackageReceiptPath = writeWorkspaceFile(
    `.dx/receipts/extensions/${stalePackageAdapterId}/package-output-latest.json`,
    `{"receipt":"dx.extension.stale.package_output"}\n`
  );
  writeLoadedHostPreflightReceipt(stalePackageAdapterId, ["loaded stale package host receipt"], {
    packageOutputReceiptPath: stalePackageReceiptPath,
    packageOutputReceiptSha256: sha256(readFileSync(stalePackageReceiptPath))
  });
  writeWorkspaceFile(
    `.dx/receipts/extensions/${stalePackageAdapterId}/package-output-latest.json`,
    `{"receipt":"dx.extension.changed.package_output"}\n`
  );
  const stalePackage = readReleaseEvidenceEnvironmentSummary(workspaceRoot, stalePackageAdapterId, {
    releaseValidEvidenceKinds: ["host_execution"]
  });

  assert.deepEqual(stalePackage.loadedHostPreflight?.blockedBy, ["loaded stale package host receipt"]);
  assert.deepEqual(stalePackage.blockers, [
    "loaded-host preflight: loaded-host preflight package-output link is stale"
  ]);

  const weakSourceLink = createFigmaPackageOutputLinkWithoutSourceProof();
  writeLoadedHostPreflightReceipt("dx.figma.command-center", ["loaded Figma desktop receipt"], weakSourceLink);
  const weakSourcePackage = readReleaseEvidenceEnvironmentSummary(workspaceRoot, "dx.figma.command-center", {
    releaseValidEvidenceKinds: ["host_execution"]
  });

  assert.equal(
    weakSourcePackage.loadedHostPreflight?.packageLinkProblem,
    "package-output link is weak: Figma package-output source root is missing"
  );
  assert.deepEqual(weakSourcePackage.blockers, [
    "loaded-host preflight: package-output link is weak: Figma package-output source root is missing"
  ]);
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("release evidence environment summary verified");

function writeLoadedHostPreflightReceipt(
  adapterId: string,
  blockedBy: string[],
  packageOutputLink?: { packageOutputReceiptPath: string; packageOutputReceiptSha256: string }
): void {
  const resolvedPackageOutputLink = packageOutputLink ?? createPackageOutputLink(adapterId);

  writeWorkspaceFile(
    `.dx/receipts/extensions/${adapterId}/loaded-host-preflight-latest.json`,
    `${JSON.stringify(
      {
        receipt: "dx.extension.loaded_host_preflight",
        adapterId,
        ...resolvedPackageOutputLink,
        readiness: {
          nextProof: "Capture host evidence.",
          blockedBy
        },
        preflightClaims: {
          hostExecuted: false,
          loadedHostVerified: false,
          releaseReady: false,
          marketplaceOrStoreVerified: false
        }
      },
      null,
      2
    )}\n`
  );
}

function createPackageOutputLink(adapterId: string): {
  packageOutputReceiptPath: string;
  packageOutputReceiptSha256: string;
} {
  const safeAdapterId = adapterId.replace(/[^a-z0-9.-]/gi, "-");
  const packageRoot = join(workspaceRoot, "package-links", safeAdapterId);
  writeWorkspaceFile(
    `package-links/${safeAdapterId}/extension.toml`,
    `id = "${adapterId}"\n`
  );
  const files = [readPackageFileProof(packageRoot, "extension.toml")];
  const sourceProof = createSourceProof(adapterId, safeAdapterId);
  const packageFixture = packageReceiptFixtureByAdapterId.get(adapterId) ?? {
    receipt: "dx.extension.zed.package_output",
    host: "zed",
    format: "test-package-link-fixture"
  };
  const packageOutputReceiptPath = writeWorkspaceFile(
    `.dx/receipts/extensions/${adapterId}/package-output-latest.json`,
    `${JSON.stringify(
      {
        receipt: packageFixture.receipt,
        adapterId,
        host: packageFixture.host,
        package: {
          root: packageRoot,
          format: packageFixture.format,
          fileCount: files.length,
          sha256: hashPackageFiles(files),
          files
        },
        ...sourceProof,
        releaseClaims: {
          loadedHostVerified: false,
          localServiceVerified: false,
          signingVerified: false,
          releaseChecksumVerified: false,
          distributionVerified: false
        }
      },
      null,
      2
    )}\n`
  );

  return {
    packageOutputReceiptPath,
    packageOutputReceiptSha256: sha256(readFileSync(packageOutputReceiptPath))
  };
}

function createSourceProof(adapterId: string, safeAdapterId: string): {
  sourceRoot?: string;
  sourceInputs?: ReturnType<typeof readSourceInputProofs>;
  sourceSha256?: string;
} {
  const relativePaths = sourceInputPathsByAdapterId.get(adapterId);

  if (!relativePaths) {
    return {};
  }

  const sourceRoot = join(workspaceRoot, "source-links", safeAdapterId);

  for (const relativePath of relativePaths) {
    writeWorkspaceFile(`source-links/${safeAdapterId}/${relativePath}`, `source for ${adapterId}: ${relativePath}\n`);
  }

  const sourceInputs = readSourceInputProofs(sourceRoot, relativePaths);

  return {
    sourceRoot,
    sourceInputs,
    sourceSha256: hashSourceInputs(sourceInputs)
  };
}

function createFigmaPackageOutputLinkWithoutSourceProof(): {
  packageOutputReceiptPath: string;
  packageOutputReceiptSha256: string;
} {
  const adapterId = "dx.figma.command-center";
  const packageRoot = join(workspaceRoot, "package-links", "figma-source-weak");
  writeWorkspaceFile("package-links/figma-source-weak/manifest.json", `{"name":"DX Figma"}\n`);
  const files = [readPackageFileProof(packageRoot, "manifest.json")];
  const packageOutputReceiptPath = writeWorkspaceFile(
    `.dx/receipts/extensions/${adapterId}/package-output-latest.json`,
    `${JSON.stringify(
      {
        receipt: "dx.extension.figma_canva.package_output",
        adapterId,
        host: "figma",
        package: {
          root: packageRoot,
          format: "figma-plugin",
          fileCount: files.length,
          sha256: hashPackageFiles(files),
          files
        },
        releaseClaims: {
          loadedHostVerified: false,
          localServiceVerified: false,
          signingVerified: false,
          releaseChecksumVerified: false,
          distributionVerified: false
        }
      },
      null,
      2
    )}\n`
  );

  return {
    packageOutputReceiptPath,
    packageOutputReceiptSha256: sha256(readFileSync(packageOutputReceiptPath))
  };
}

function readPackageFileProof(packageRoot: string, relativePath: string): {
  relativePath: string;
  bytes: number;
  sha256: string;
} {
  const bytes = readFileSync(join(packageRoot, ...relativePath.split("/")));

  return {
    relativePath,
    bytes: bytes.length,
    sha256: sha256(bytes)
  };
}

function hashPackageFiles(files: Array<{ relativePath: string; bytes: number; sha256: string }>): string {
  const hash = createHash("sha256");

  for (const file of files) {
    hash.update(file.relativePath);
    hash.update("\0");
    hash.update(file.sha256);
    hash.update("\0");
    hash.update(String(file.bytes));
    hash.update("\n");
  }

  return hash.digest("hex");
}

function sha256(source: Buffer): string {
  return createHash("sha256").update(source).digest("hex");
}

function writeWorkspaceFile(relativePath: string, source: string): string {
  const absolutePath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);

  return absolutePath;
}
