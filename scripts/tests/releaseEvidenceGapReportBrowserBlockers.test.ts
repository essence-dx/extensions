import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { createOperatorProofTemplate } from "../lib/operator-proof-templates.ts";
import {
  browserPackageSourceInputs,
  hashSourceInputs,
  readSourceInputProofs
} from "../lib/source-input-proof.ts";
import { writeReleaseEvidenceGapReport } from "../write-release-evidence-gap-report.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-browser-gap-blockers-"));
const adapterId = "dx.browser.command-center";

try {
  writeBrowserReleaseGate();
  const packageOutput = writePackageOutputReceipt();
  const hostActionIndexReceipt = writeHostActionIndexReceipt();
  writeEdgeLoadedProfileReceipt(
    packageOutput.receiptPath,
    packageOutput.receiptSha256,
    packageOutput.nativeHostPackageReceiptPath,
    hostActionIndexReceipt
  );

  const report = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-08T00:00:00.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });
  const browser = report.extensions.find((extension) => extension.id === adapterId);

  assert.ok(browser);
  assert.equal(browser.existingReceipts.includes(edgeReceiptPath()), true);
  assert.equal(browser.missingReceipts.includes(edgeReceiptPath()), false);
  assert.equal(browser.blockedBy.some((blocker) => blocker.includes("edge-loaded-profile")), false);
  assert.equal(browser.blockedBy.some((blocker) => blocker.includes("chrome-loaded-profile")), true);
  assert.equal(browser.blockedBy.some((blocker) => blocker.includes("firefox-loaded-profile")), true);
  assert.equal(browser.blockedBy.some((blocker) => blocker.includes("signing-latest")), true);
  assert.equal(browser.blockedBy.some((blocker) => blocker.includes("checksum-latest")), true);
  assert.equal(browser.blockedBy.some((blocker) => blocker.includes("store-distribution-latest")), true);
  const requirements = new Map(
    browser.evidenceRequirements.map((requirement) => [requirement.kind, requirement])
  );
  const nativeHostPackageRequirement = requirements.get("native_host_package");
  const packageOutputRequirement = requirements.get("package_output");
  assert.equal(packageOutputRequirement?.releaseValid, false);
  assert.match(
    packageOutputRequirement?.weakness ?? "",
    /browser package-output receipt is missing branded icon proof/
  );
  assert.equal(nativeHostPackageRequirement?.releaseValid, false);
  assert.match(
    nativeHostPackageRequirement?.weakness ?? "",
    /native-host package executable file does not exist/
  );
  assert.match(
    nativeHostPackageRequirement?.weakness ?? "",
    /native-host package receipt is missing extension ID capture linkage/
  );
  assert.deepEqual(nativeHostPackageRequirement?.remediation, {
    command: "npm run package:browser-native-host:j1",
    proofSource: "workspace_artifact",
    requiresRealHost: false
  });
  assert.deepEqual(JSON.parse(readFileSync(report.receiptPath, "utf8")), report);

  writeCopiedEdgeReceiptToChromePath();
  const copiedTargetReport = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-08T00:00:20.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });
  const copiedChromeLoadedProfileRequirement = requirementByReceiptPath(
    copiedTargetReport,
    chromeReceiptPath()
  );

  assert.equal(copiedChromeLoadedProfileRequirement.releaseValid, false);
  assert.match(
    copiedChromeLoadedProfileRequirement.weakness ?? "",
    /browser loaded-profile receipt target edge does not match required chrome receipt path/
  );
  assert.deepEqual(copiedChromeLoadedProfileRequirement.remediation, {
    command: "npm run smoke:browser-loaded-profile:j1 -- -Target chrome",
    proofSource: "host_application",
    requiresRealHost: true
  });

  withMutatedFile(packageOutput.receiptPath, "{}\n", () => {
    const stalePackageReport = writeReleaseEvidenceGapReport(workspaceRoot, {
      generatedAt: "2026-06-08T00:00:30.000Z",
      verificationCommand: "npm run report:release-evidence-gaps:j1"
    });
    const edgeLoadedProfileRequirement = requirementByReceiptPath(
      stalePackageReport,
      edgeReceiptPath()
    );

    assert.equal(edgeLoadedProfileRequirement.releaseValid, false);
    assert.match(
      edgeLoadedProfileRequirement.weakness ?? "",
      /browser loaded-profile package-output receipt hash changed/
    );
    assert.deepEqual(edgeLoadedProfileRequirement.remediation, {
      command: "npm run smoke:browser-loaded-profile:j1 -- -Target edge",
      proofSource: "host_application",
      requiresRealHost: true
    });
  });

  withMutatedFile(packageOutput.nativeHostPackageReceiptPath, "{}\n", () => {
    const staleNativeHostPackageReport = writeReleaseEvidenceGapReport(workspaceRoot, {
      generatedAt: "2026-06-08T00:00:45.000Z",
      verificationCommand: "npm run report:release-evidence-gaps:j1"
    });
    const edgeLoadedProfileRequirement = requirementByReceiptPath(
      staleNativeHostPackageReport,
      edgeReceiptPath()
    );

    assert.equal(edgeLoadedProfileRequirement.releaseValid, false);
    assert.match(
      edgeLoadedProfileRequirement.weakness ?? "",
      /browser loaded-profile native-host package receipt hash changed/
    );
  });

  withMutatedFile(hostActionIndexReceipt.absolutePath, "{}\n", () => {
    const staleRoundTripReport = writeReleaseEvidenceGapReport(workspaceRoot, {
      generatedAt: "2026-06-08T00:01:00.000Z",
      verificationCommand: "npm run report:release-evidence-gaps:j1"
    });
    const edgeLoadedProfileRequirement = requirementByReceiptPath(
      staleRoundTripReport,
      edgeReceiptPath()
    );

    assert.equal(edgeLoadedProfileRequirement.releaseValid, false);
    assert.match(
      edgeLoadedProfileRequirement.weakness ?? "",
      /browser loaded-profile native-host round-trip status receipt hash changed/
    );
  });

  const weakHostActionIndexSource = `${JSON.stringify(
    {
      receipt: "dx.extension.host_action_index",
      adapterId,
      host: "browser",
      runtimePlanParity: true,
      actions: [
        browserHostAction("forgePackages"),
        browserHostAction("showBuildGraph")
      ]
    },
    null,
    2
  )}\n`;

  withMutatedFile(hostActionIndexReceipt.absolutePath, weakHostActionIndexSource, () => {
    withUpdatedEdgeRoundTripReceiptSha256(sha256(weakHostActionIndexSource), () => {
      const weakRoundTripSemanticReport = writeReleaseEvidenceGapReport(workspaceRoot, {
        generatedAt: "2026-06-08T00:01:15.000Z",
        verificationCommand: "npm run report:release-evidence-gaps:j1"
      });
      const edgeLoadedProfileRequirement = requirementByReceiptPath(
        weakRoundTripSemanticReport,
        edgeReceiptPath()
      );

      assert.equal(edgeLoadedProfileRequirement.releaseValid, false);
      assert.match(
        edgeLoadedProfileRequirement.weakness ?? "",
        /browser loaded-profile native-host round-trip status host-action index is missing native-host action/
      );
    });
  });
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

assertFirefoxNativeHostExtensionMismatchIsWeak();
assertCopiedOperatorTemplateIsWeakHostEvidence();

console.log("browser release evidence blockers verified");

function writeBrowserReleaseGate(root = workspaceRoot): void {
  writeWorkspaceFile(
    root,
    "registry/official-extensions.toml",
    `
schema = "dx.extensions.registry"
manifest_version = 1

[[extensions]]
id = "${adapterId}"
name = "DX Browser Command Center"
path = "hosts/browser/dx-browser"
manifest = "hosts/browser/dx-browser/dx.extension.toml"
status = "experimental"
professional_targets = ["browser.chrome", "browser.edge", "browser.firefox"]
`
  );
  writeWorkspaceFile(
    root,
    "hosts/browser/dx-browser/dx.extension.toml",
    `
[extension]
id = "${adapterId}"
`
  );
  writeBrowserSourceInputs(root);
  writeWorkspaceFile(
    root,
    "registry/release-evidence-gates.toml",
    `
schema = "dx.release_evidence_gates"
manifest_version = 1

[[extensions]]
id = "${adapterId}"
stage = "not-release-ready"
required_evidence = ["host_execution", "package_output", "native_host_package", "signing", "checksum", "distribution_review"]
evidence_receipt_requirements = ["host_execution=.dx/receipts/extensions/${adapterId}/chrome-loaded-profile-latest.json", "host_execution=.dx/receipts/extensions/${adapterId}/edge-loaded-profile-latest.json", "host_execution=.dx/receipts/extensions/${adapterId}/firefox-loaded-profile-latest.json", "package_output=.dx/receipts/extensions/${adapterId}/package-output-latest.json", "native_host_package=.dx/receipts/extensions/${adapterId}/native-host-release-package-latest.json", "signing=.dx/receipts/extensions/${adapterId}/signing-latest.json", "checksum=.dx/receipts/extensions/${adapterId}/checksum-latest.json", "distribution_review=.dx/receipts/extensions/${adapterId}/store-distribution-latest.json"]
evidence_receipts = [".dx/receipts/extensions/${adapterId}/chrome-loaded-profile-latest.json", ".dx/receipts/extensions/${adapterId}/edge-loaded-profile-latest.json", ".dx/receipts/extensions/${adapterId}/firefox-loaded-profile-latest.json", ".dx/receipts/extensions/${adapterId}/package-output-latest.json", ".dx/receipts/extensions/${adapterId}/native-host-release-package-latest.json", ".dx/receipts/extensions/${adapterId}/signing-latest.json", ".dx/receipts/extensions/${adapterId}/checksum-latest.json", ".dx/receipts/extensions/${adapterId}/store-distribution-latest.json"]
next_release_proof = "Capture real loaded Chrome, Edge, and Firefox profile receipts against the installed native host."
blocked_by = ["loaded Chrome receipt", "loaded Edge receipt", "loaded Firefox receipt", "signing receipt", "store distribution proof"]
`
  );
}

function writePackageOutputReceipt(): {
  nativeHostPackageReceiptPath: string;
  receiptPath: string;
  receiptSha256: string;
} {
  const files = [
    writePackageFile("dist/browser/chrome/manifest.json", "{}\n"),
    writePackageFile("dist/browser/edge/manifest.json", "{}\n"),
    writePackageFile("dist/browser/firefox/manifest.json", "{}\n")
  ];
  const sourceProof = readBrowserSourceProof(workspaceRoot);
  const receiptPath = writeWorkspaceFile(
    workspaceRoot,
    `.dx/receipts/extensions/${adapterId}/package-output-latest.json`,
    JSON.stringify(
      {
        receipt: "dx.extension.browser.package_output",
        adapterId,
        host: "browser",
        package: {
          root: join(workspaceRoot, "dist", "browser"),
          fileCount: files.length,
          sha256: hashPackageFiles(files),
          files
        },
        inputs: browserPackageSourceInputs,
        sourceRoot: sourceProof.sourceRoot,
        sourceInputs: sourceProof.sourceInputs,
        sourceSha256: sourceProof.sourceSha256,
        releaseClaims: {
          loadedHostVerified: false,
          signingVerified: false,
          releaseChecksumVerified: false,
          distributionVerified: false
        }
      },
      null,
      2
    )
  );

  const nativeHostPackageReceiptPath = writeWorkspaceFile(
    workspaceRoot,
    `.dx/receipts/extensions/${adapterId}/native-host-release-package-latest.json`,
    JSON.stringify(
      {
        receipt: "dx.extension.browser.native_host_package",
        adapterId,
        host: "browser",
        packageOutput: {
          receiptPath,
          receiptSha256: sha256(readFileSync(receiptPath)),
          packageSha256: hashPackageFiles(files),
          filesVerified: files.length
        },
        nativeHost: {
          executable: {
            path: join(workspaceRoot, "native-host", "dx-browser-native-host.exe"),
            fileName: "dx-browser-native-host.exe",
            targetOs: "windows",
            targetArch: "x64",
            bytes: 16,
            sha256: "a".repeat(64)
          },
          manifests: [
            nativeHostManifest("chrome", "abcdefghijklmnopabcdefghijklmnop"),
            nativeHostManifest("edge", "bcdefghijklmnopabcdefghijklmnopa"),
            nativeHostManifest("firefox", "dx-browser-command-center@dx.dev")
          ]
        },
        releaseClaims: {
          packageOutputVerified: true,
          nativeHostReleasePackageVerified: true
        }
      },
      null,
      2
    )
  );

  return {
    nativeHostPackageReceiptPath,
    receiptPath,
    receiptSha256: sha256(readFileSync(receiptPath))
  };
}

function writeHostActionIndexReceipt(): { absolutePath: string; receiptPath: string; receiptSha256: string } {
  const receiptPath = `.dx/receipts/extensions/${adapterId}/host-action-index-latest.json`;
  const absolutePath = writeWorkspaceFile(
    workspaceRoot,
    receiptPath,
    JSON.stringify(
      {
        receipt: "dx.extension.host_action_index",
        adapterId,
        host: "browser",
        runtimePlanParity: true,
        actions: [
          browserHostAction("status"),
          browserHostAction("forgePackages"),
          browserHostAction("showBuildGraph")
        ]
      },
      null,
      2
    )
  );

  return {
    absolutePath,
    receiptPath,
    receiptSha256: sha256(readFileSync(absolutePath))
  };
}

function browserHostAction(commandId: "status" | "forgePackages" | "showBuildGraph"): Record<string, unknown> {
  const actions = {
    status: {
      id: "dx.browser.show_status",
      runtimePlanId: "status",
      operation: "dx.status",
      requiredCapabilities: ["browser.activeTab", "nativeMessaging.dx"],
      nativeCommand: { executable: "dx", args: ["status"] }
    },
    forgePackages: {
      id: "dx.browser.list_forge_packages",
      runtimePlanId: "forgePackages",
      operation: "dx.forge.packages.list",
      requiredCapabilities: ["browser.activeTab", "nativeMessaging.dx", "forge.read"],
      nativeCommand: { executable: "dx", args: ["forge", "packages", "--json"] }
    },
    showBuildGraph: {
      id: "dx.browser.show_build_graph",
      runtimePlanId: "showBuildGraph",
      operation: "dx.graph.read",
      requiredCapabilities: ["browser.activeTab", "nativeMessaging.dx", "graph.read"],
      nativeCommand: { executable: "dx", args: ["graph", "--json"] }
    }
  } satisfies Record<
    "status" | "forgePackages" | "showBuildGraph",
    {
      id: string;
      runtimePlanId: string;
      operation: string;
      requiredCapabilities: string[];
      nativeCommand: { executable: "dx"; args: string[] };
    }
  >;
  const action = actions[commandId];

  return {
    ...action,
    transport: "native-host",
    riskLevel: "low",
    requiresUserApproval: false
  };
}

function writeEdgeLoadedProfileReceipt(
  packageOutputReceiptPath: string,
  packageOutputReceiptSha256: string,
  nativeHostPackageReceiptPath: string,
  roundTripReceipt: { receiptPath: string; receiptSha256: string }
): void {
  const nativeHostPackageReceipt = JSON.parse(readFileSync(nativeHostPackageReceiptPath, "utf8"));
  const edgeManifest = nativeHostPackageReceipt.nativeHost.manifests.find(
    (manifest: Record<string, unknown>) => manifest.target === "edge"
  );

  writeWorkspaceFile(
    workspaceRoot,
    `.dx/receipts/extensions/${adapterId}/edge-loaded-profile-latest.json`,
    JSON.stringify(
      {
        receipt: "dx.extension.browser.loaded_profile",
        adapterId,
        host: "browser",
        target: "edge",
        receiptPath: join(
          workspaceRoot,
          ".dx",
          "receipts",
          "extensions",
          adapterId,
          "edge-loaded-profile-latest.json"
        ),
        packageOutput: {
          receiptPath: packageOutputReceiptPath,
          receiptSha256: packageOutputReceiptSha256
        },
        nativeHostPackage: {
          receiptPath: nativeHostPackageReceiptPath,
          receiptSha256: sha256(readFileSync(nativeHostPackageReceiptPath)),
          target: "edge",
          manifestPath: edgeManifest.manifestPath,
          manifestSha256: edgeManifest.sha256,
          executableSha256: nativeHostPackageReceipt.nativeHost.executable.sha256
        },
        browser: {
          executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
          version: "149.0.4022.52"
        },
        extension: {
          id: "bcdefghijklmnopabcdefghijklmnopa",
          baseUrl: "chrome-extension://bcdefghijklmnopabcdefghijklmnopa/"
        },
        nativeHost: {
          name: "dev.dx.browser",
          manifestPath: edgeManifest.manifestPath,
          registered: true
        },
        loadedProfile: {
          backgroundServiceWorkerVerified: true,
          commandIds: ["status", "forgePackages", "showBuildGraph"],
          hostUiCommandIds: ["copyReceiptsPath"],
          nativeHostRoundTrips: [
            nativeHostRoundTrip("status", roundTripReceipt),
            nativeHostRoundTrip("forgePackages", roundTripReceipt),
            nativeHostRoundTrip("showBuildGraph", roundTripReceipt)
          ]
        }
      },
      null,
      2
    )
  );
}

function nativeHostManifest(target: "chrome" | "edge" | "firefox", extensionId: string): Record<string, unknown> {
  const manifest = {
    target,
    manifestPath: join(workspaceRoot, "native-host-manifests", target, "dev.dx.browser.json"),
    sha256: target === "chrome" ? "b".repeat(64) : target === "edge" ? "c".repeat(64) : "d".repeat(64),
    name: "dev.dx.browser",
    type: "stdio",
    nativeHostPath: join(workspaceRoot, "native-host", "dx-browser-native-host.exe")
  };

  return target === "firefox"
    ? { ...manifest, allowedExtensions: [extensionId] }
    : { ...manifest, allowedOrigins: [`chrome-extension://${extensionId}/`] };
}

function nativeHostRoundTrip(
  commandId: "status" | "forgePackages" | "showBuildGraph",
  roundTripReceipt: { receiptPath: string; receiptSha256: string }
): Record<string, unknown> {
  return {
    commandId,
    hostActionId:
      commandId === "status"
        ? "dx.browser.show_status"
        : commandId === "forgePackages"
          ? "dx.browser.list_forge_packages"
          : "dx.browser.show_build_graph",
    handledBy: "native-host",
    ok: true,
    receiptPath: roundTripReceipt.receiptPath,
    receiptSha256: roundTripReceipt.receiptSha256
  };
}

function writePackageFile(relativePath: string, source: string): { relativePath: string; bytes: number; sha256: string } {
  const absolutePath = writeWorkspaceFile(workspaceRoot, relativePath, source);
  const bytes = readFileSync(absolutePath);

  return {
    relativePath: relativePath.replace(/^dist\/browser\//, ""),
    bytes: bytes.length,
    sha256: sha256(bytes)
  };
}

function writeWorkspaceFile(root: string, relativePath: string, source: string): string {
  const absolutePath = join(root, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);

  return absolutePath;
}

function edgeReceiptPath(): string {
  return `.dx/receipts/extensions/${adapterId}/edge-loaded-profile-latest.json`;
}

function chromeReceiptPath(): string {
  return `.dx/receipts/extensions/${adapterId}/chrome-loaded-profile-latest.json`;
}

function writeCopiedEdgeReceiptToChromePath(): void {
  writeWorkspaceFile(
    workspaceRoot,
    chromeReceiptPath(),
    readFileSync(join(workspaceRoot, ...edgeReceiptPath().split("/")), "utf8")
  );
}

function requirementByReceiptPath(
  report: ReturnType<typeof writeReleaseEvidenceGapReport>,
  receiptPath: string
) {
  const browser = report.extensions.find((extension) => extension.id === adapterId);
  assert.ok(browser, "browser gap entry must exist");
  const requirement = browser.evidenceRequirements.find((entry) => entry.receiptPath === receiptPath);
  assert.ok(requirement, `${receiptPath} requirement must exist`);

  return requirement;
}

function withMutatedFile(path: string, source: string, assertion: () => void): void {
  const originalSource = readFileSync(path, "utf8");
  writeFileSync(path, source);

  try {
    assertion();
  } finally {
    writeFileSync(path, originalSource);
  }
}

function withUpdatedEdgeRoundTripReceiptSha256(receiptSha256: string, assertion: () => void): void {
  const path = join(workspaceRoot, ...edgeReceiptPath().split("/"));
  const originalSource = readFileSync(path, "utf8");
  const receipt = JSON.parse(originalSource);

  receipt.loadedProfile.nativeHostRoundTrips = receipt.loadedProfile.nativeHostRoundTrips.map(
    (roundTrip: Record<string, unknown>) => ({
      ...roundTrip,
      receiptSha256
    })
  );
  writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`);

  try {
    assertion();
  } finally {
    writeFileSync(path, originalSource);
  }
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

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertFirefoxNativeHostExtensionMismatchIsWeak(): void {
  const root = mkdtempSync(join(tmpdir(), "dx-browser-firefox-native-host-mismatch-"));

  try {
    writeBrowserReleaseGate(root);
    const packageOutput = writePackageOutputWithFirefoxExtensionId(root, "dx-browser-command-center@dx.dev");
    const nativeHostBinaryPath = writeWorkspaceFile(root, "native-host/dx-browser-native-host.exe", "native host\n");
    const extensionIdCaptureReceiptPath = writeExtensionIdCaptureReceiptInRoot(root);
    const chromeManifest = writeNativeHostManifestInRoot(
      root,
      "chrome",
      nativeHostBinaryPath,
      "abcdefghijklmnopabcdefghijklmnop"
    );
    const edgeManifest = writeNativeHostManifestInRoot(
      root,
      "edge",
      nativeHostBinaryPath,
      "bcdefghijklmnopabcdefghijklmnopa"
    );
    const firefoxManifest = writeNativeHostManifestInRoot(
      root,
      "firefox",
      nativeHostBinaryPath,
      "stale-browser-command-center@dx.dev"
    );

    writeWorkspaceFile(
      root,
      `.dx/receipts/extensions/${adapterId}/native-host-release-package-latest.json`,
      JSON.stringify(
        {
          receipt: "dx.extension.browser.native_host_package",
          adapterId,
          host: "browser",
          packageOutput: {
            receiptPath: packageOutput.receiptPath,
            receiptSha256: packageOutput.receiptSha256,
            packageSha256: packageOutput.packageSha256,
            filesVerified: packageOutput.filesVerified
          },
          extensionIdCapture: {
            receiptPath: extensionIdCaptureReceiptPath,
            receiptSha256: sha256(readFileSync(extensionIdCaptureReceiptPath)),
            capturedTargets: ["chrome", "edge"],
            chromeExtensionId: "abcdefghijklmnopabcdefghijklmnop",
            edgeExtensionId: "bcdefghijklmnopabcdefghijklmnopa"
          },
          nativeHost: {
            executable: {
              path: nativeHostBinaryPath,
              fileName: "dx-browser-native-host.exe",
              targetOs: "windows",
              targetArch: "x64",
              bytes: Buffer.byteLength("native host\n"),
              sha256: sha256(readFileSync(nativeHostBinaryPath))
            },
            manifests: [chromeManifest, edgeManifest, firefoxManifest]
          },
          releaseClaims: {
            packageOutputVerified: true,
            nativeHostReleasePackageVerified: true
          }
        },
        null,
        2
      )
    );

    const report = writeReleaseEvidenceGapReport(root, {
      generatedAt: "2026-06-08T00:00:00.000Z",
      verificationCommand: "npm run report:release-evidence-gaps:j1"
    });
    const browser = report.extensions.find((extension) => extension.id === adapterId);
    const nativeHostPackageRequirement = browser?.evidenceRequirements.find(
      (requirement) => requirement.kind === "native_host_package"
    );

    assert.equal(nativeHostPackageRequirement?.releaseValid, false);
    assert.match(
      nativeHostPackageRequirement?.weakness ?? "",
      /Firefox manifest no longer matches packaged Firefox extension id/
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function assertCopiedOperatorTemplateIsWeakHostEvidence(): void {
  const root = mkdtempSync(join(tmpdir(), "dx-browser-template-as-proof-"));
  const receiptPath = `.dx/receipts/extensions/${adapterId}/chrome-loaded-profile-latest.json`;

  try {
    writeBrowserReleaseGate(root);
    writeWorkspaceFile(
      root,
      receiptPath,
      JSON.stringify(
        createOperatorProofTemplate("browser-chrome-loaded-profile", {
          generatedAt: "2026-06-09T00:00:00.000Z"
        }),
        null,
        2
      )
    );

    const report = writeReleaseEvidenceGapReport(root, {
      generatedAt: "2026-06-09T00:00:30.000Z",
      verificationCommand: "npm run report:release-evidence-gaps:j1"
    });
    const chromeLoadedProfileRequirement = requirementByReceiptPath(report, receiptPath);

    assert.equal(chromeLoadedProfileRequirement.exists, true);
    assert.equal(chromeLoadedProfileRequirement.releaseValid, false);
    assert.match(
      chromeLoadedProfileRequirement.weakness ?? "",
      /host-execution receipt is not a recognized loaded-host receipt/
    );
    assert.deepEqual(chromeLoadedProfileRequirement.remediation, {
      command: "npm run smoke:browser-loaded-profile:j1 -- -Target chrome",
      proofSource: "host_application",
      requiresRealHost: true
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function writePackageOutputWithFirefoxExtensionId(
  root: string,
  firefoxExtensionId: string
): { receiptPath: string; receiptSha256: string; packageSha256: string; filesVerified: number } {
  const packageRoot = join(root, "dist", "browser");
  const files = [
    writePackageFileInRoot(root, "chromium/manifest.json", "{}\n"),
    writePackageFileInRoot(root, "edge/manifest.json", "{}\n"),
    writePackageFileInRoot(
      root,
      "firefox/manifest.json",
      JSON.stringify({
        browser_specific_settings: {
          gecko: {
            id: firefoxExtensionId
          }
        }
      })
    )
  ];
  const packageSha256 = hashPackageFiles(files);
  const sourceProof = readBrowserSourceProof(root);
  const receiptPath = writeWorkspaceFile(
    root,
    `.dx/receipts/extensions/${adapterId}/package-output-latest.json`,
    JSON.stringify(
      {
        receipt: "dx.extension.browser.package_output",
        adapterId,
        host: "browser",
        package: {
          root: packageRoot,
          fileCount: files.length,
          sha256: packageSha256,
          files
        },
        inputs: browserPackageSourceInputs,
        sourceRoot: sourceProof.sourceRoot,
        sourceInputs: sourceProof.sourceInputs,
        sourceSha256: sourceProof.sourceSha256,
        targets: [
          { name: "chromium" },
          { name: "edge" },
          { name: "firefox", extensionId: firefoxExtensionId }
        ],
        releaseClaims: {
          loadedHostVerified: false,
          signingVerified: false,
          releaseChecksumVerified: false,
          distributionVerified: false
        }
      },
      null,
      2
    )
  );

  return {
    receiptPath,
    receiptSha256: sha256(readFileSync(receiptPath)),
    packageSha256,
    filesVerified: files.length
  };
}

function writePackageFileInRoot(
  root: string,
  relativePath: string,
  source: string
): { relativePath: string; bytes: number; sha256: string } {
  const absolutePath = writeWorkspaceFile(root, `dist/browser/${relativePath}`, source);
  const bytes = readFileSync(absolutePath);

  return {
    relativePath,
    bytes: bytes.length,
    sha256: sha256(bytes)
  };
}

function writeBrowserSourceInputs(root: string): void {
  for (const relativePath of browserPackageSourceInputs) {
    writeWorkspaceFile(root, `hosts/browser/dx-browser/${relativePath}`, `browser source for ${relativePath}\n`);
  }
}

function readBrowserSourceProof(root: string): {
  sourceRoot: string;
  sourceInputs: ReturnType<typeof readSourceInputProofs>;
  sourceSha256: string;
} {
  const sourceRoot = join(root, "hosts", "browser", "dx-browser");
  const sourceInputs = readSourceInputProofs(sourceRoot, browserPackageSourceInputs);

  return {
    sourceRoot,
    sourceInputs,
    sourceSha256: hashSourceInputs(sourceInputs)
  };
}

function writeExtensionIdCaptureReceiptInRoot(root: string): string {
  return writeWorkspaceFile(
    root,
    `.dx/receipts/extensions/${adapterId}/extension-id-capture-latest.json`,
    JSON.stringify(
      {
        receipt: "dx.extension.browser.extension_id_capture",
        adapterId,
        host: "browser",
        captures: [
          {
            target: "chrome",
            extensionId: "abcdefghijklmnopabcdefghijklmnop"
          },
          {
            target: "edge",
            extensionId: "bcdefghijklmnopabcdefghijklmnopa"
          }
        ]
      },
      null,
      2
    )
  );
}

function writeNativeHostManifestInRoot(
  root: string,
  target: "chrome" | "edge" | "firefox",
  nativeHostPath: string,
  extensionId: string
): Record<string, unknown> {
  const manifestPath = writeWorkspaceFile(
    root,
    `native-host-manifests/${target}/dev.dx.browser.json`,
    JSON.stringify(
      target === "firefox"
        ? {
            name: "dev.dx.browser",
            type: "stdio",
            path: nativeHostPath,
            allowed_extensions: [extensionId]
          }
        : {
            name: "dev.dx.browser",
            type: "stdio",
            path: nativeHostPath,
            allowed_origins: [`chrome-extension://${extensionId}/`]
          },
      null,
      2
    )
  );
  const manifestBytes = readFileSync(manifestPath);
  const manifest = {
    target,
    manifestPath,
    sha256: sha256(manifestBytes),
    name: "dev.dx.browser",
    type: "stdio",
    nativeHostPath
  };

  return target === "firefox"
    ? { ...manifest, allowedExtensions: [extensionId], extensionId }
    : { ...manifest, allowedOrigins: [`chrome-extension://${extensionId}/`] };
}
