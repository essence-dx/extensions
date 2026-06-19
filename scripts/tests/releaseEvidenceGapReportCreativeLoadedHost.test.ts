import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { writeReleaseEvidenceGapReport } from "../write-release-evidence-gap-report.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-release-gaps-creative-loaded-host-"));
const adapters = [
  {
    adapterId: "dx.photoshop.command-center",
    host: "photoshop",
    hostApplication: "Photoshop",
    manifestPath: "hosts/adobe/dx-photoshop-uxp/dx.extension.toml",
    verificationMode: "uxp-developer-tool",
    commandIds: [
      "dx.photoshop.show_status",
      "dx.photoshop.search_assets",
      "dx.photoshop.copy_receipts_path"
    ],
    entrypoints: ["dxCommandCenterPanel", "dxShowReceipts", "dxShowStatus"],
    uxpManifestId: "dx.photoshop.command-center.development"
  },
  {
    adapterId: "dx.davinci-resolve.command-center",
    host: "davinci-resolve",
    hostApplication: "DaVinci Resolve",
    manifestPath: "hosts/blackmagic/dx-davinci-resolve/dx.extension.toml",
    verificationMode: "resolve-scripting",
    commandIds: [
      "dx.davinci-resolve.show_status",
      "dx.davinci-resolve.inspect_project",
      "dx.davinci-resolve.show_receipts"
    ]
  }
] as const;

try {
  writeWorkspaceFixtures();

  for (const adapter of adapters) {
    writeWorkspaceFile(
      `.dx/receipts/extensions/${adapter.adapterId}/loaded-host-latest.json`,
      JSON.stringify(fakeLoadedHostReceipt(adapter), null, 2)
    );
  }

  const weakReport = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-08T00:00:00.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });

  for (const adapter of adapters) {
    const requirement = hostExecutionRequirement(weakReport, adapter.adapterId);
    assert.equal(requirement.releaseValid, false, `${adapter.adapterId} fake loaded-host receipt must be weak`);
    assert.match(
      requirement.weakness ?? "",
      /expected command IDs|host application|verification mode|command results|entrypoint/i
    );
  }

  for (const adapter of adapters) {
    writeWorkspaceFile(
      `.dx/receipts/extensions/${adapter.adapterId}/loaded-host-latest.json`,
      JSON.stringify(validLoadedHostReceipt(adapter), null, 2)
    );
  }

  const validReport = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-08T00:00:30.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });

  for (const adapter of adapters) {
    const requirement = hostExecutionRequirement(validReport, adapter.adapterId);
    assert.equal(requirement.releaseValid, true, `${adapter.adapterId} valid loaded-host receipt must stay valid`);
  }

  writeWorkspaceFile(
    ".dx/receipts/extensions/dx.photoshop.command-center/loaded-host-latest.json",
    JSON.stringify(
      validLoadedHostReceipt({
        ...adapters[0],
        hostState: "empty"
      }),
      null,
      2
    )
  );
  const emptyHostStateReport = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-08T00:00:45.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });
  const emptyHostStateRequirement = hostExecutionRequirement(
    emptyHostStateReport,
    "dx.photoshop.command-center"
  );

  assert.equal(emptyHostStateRequirement.releaseValid, false);
  assert.match(
    emptyHostStateRequirement.weakness ?? "",
    /creative loaded-host receipt must verify a loaded host state/
  );

  writeWorkspaceFile(
    ".dx/receipts/extensions/dx.photoshop.command-center/loaded-host-latest.json",
    JSON.stringify(validLoadedHostReceipt(adapters[0]), null, 2)
  );

  writeWorkspaceFile("proof/photoshop.txt", "mutated Photoshop manual proof\n");
  const changedManualProofReport = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-08T00:01:00.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });
  const changedManualProofRequirement = hostExecutionRequirement(
    changedManualProofReport,
    "dx.photoshop.command-center"
  );

  assert.equal(changedManualProofRequirement.releaseValid, false);
  assert.match(changedManualProofRequirement.weakness ?? "", /manual proof file hash changed/);

  writeManualProofFile(adapters[0]);
  writeWorkspaceFile("tools/photoshop.exe", "mutated Photoshop executable\n");
  const changedExecutableReport = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-08T00:01:15.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });
  const changedExecutableRequirement = hostExecutionRequirement(
    changedExecutableReport,
    "dx.photoshop.command-center"
  );

  assert.equal(changedExecutableRequirement.releaseValid, false);
  assert.match(changedExecutableRequirement.weakness ?? "", /creative loaded-host host executable hash changed/);

  writeWorkspaceFile(
    ".dx/receipts/extensions/dx.davinci-resolve.command-center/package-output-latest.json",
    "{}\n"
  );
  const changedPackageOutputReport = writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-08T00:01:30.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });
  const changedPackageOutputRequirement = hostExecutionRequirement(
    changedPackageOutputReport,
    "dx.davinci-resolve.command-center"
  );

  assert.equal(changedPackageOutputRequirement.releaseValid, false);
  assert.match(changedPackageOutputRequirement.weakness ?? "", /linked package-output receipt hash changed/);
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("creative loaded-host release evidence classification verified");

function writeWorkspaceFixtures(): void {
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

  writeWorkspaceFile(
    "registry/release-evidence-gates.toml",
    `
schema = "dx.release_evidence_gates"
manifest_version = 1

${adapters
  .map(
    (adapter) => `
[[extensions]]
id = "${adapter.adapterId}"
stage = "not-release-ready"
required_evidence = ["host_execution", "package_output", "signing", "checksum", "distribution_review"]
evidence_receipt_requirements = ["host_execution=.dx/receipts/extensions/${adapter.adapterId}/loaded-host-latest.json", "package_output=.dx/receipts/extensions/${adapter.adapterId}/package-output-latest.json", "signing=.dx/receipts/extensions/${adapter.adapterId}/signing-latest.json", "checksum=.dx/receipts/extensions/${adapter.adapterId}/checksum-latest.json", "distribution_review=.dx/receipts/extensions/${adapter.adapterId}/distribution-latest.json"]
evidence_receipts = [".dx/receipts/extensions/${adapter.adapterId}/loaded-host-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/package-output-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/signing-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/checksum-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/distribution-latest.json"]
next_release_proof = "Run creative loaded-host smoke"
blocked_by = ["creative loaded-host proof"]
`
  )
  .join("\n")}
`
  );

  for (const adapter of adapters) {
    writeWorkspaceFile(adapter.manifestPath, `[extension]\nid = "${adapter.adapterId}"\n`);
    writePackageOutputReceipt(adapter);
    writeManualProofFile(adapter);
    writeHostExecutable(adapter);
  }
}

function fakeLoadedHostReceipt(adapter: (typeof adapters)[number]) {
  return {
    receipt: "dx.extension.creative.loaded_host",
    adapterId: adapter.adapterId,
    host: adapter.host,
    hostApplication: {
      name: "Wrong Host",
      version: "2026.1.0",
      executablePath: "G:/fake/host.exe",
      verificationMode: "wrong-mode",
      hostState: "loaded"
    },
    packageOutput: packageOutputLink(adapter),
    loadedHost: {
      commandIdsVisible: ["dx.fake.command"],
      commandResults: [
        {
          commandId: "dx.fake.command",
          status: "visible"
        }
      ],
      localServiceRequestsBlocked: true
    },
    manualProof: manualProofLink(adapter),
    releaseClaims: {
      loadedHostVerified: true
    },
    ...(adapter.host === "davinci-resolve"
      ? {
          davinciResolve: {
            loadedResolveVerified: true,
            scriptLanguage: "python",
            scriptLoadedInResolve: true,
            mutatesResolveProject: false,
            readOnlyProjectMetadataVerified: false,
            workflowIntegrationVerified: false
          }
        }
      : {
          adobeUxp: {
            uxpDeveloperToolPath: "G:/fake/uxp-developer-tool.exe",
            developerToolVerified: true,
            pluginLoaded: true,
            panelRendered: true,
            uxpManifestId: "wrong.manifest",
            entrypointsVisible: ["wrongEntrypoint"]
          }
        })
  };
}

function validLoadedHostReceipt(adapter: (typeof adapters)[number] & { hostState?: string }) {
  const baseReceipt = {
    receipt: "dx.extension.creative.loaded_host",
    adapterId: adapter.adapterId,
    host: adapter.host,
    hostApplication: {
      name: adapter.hostApplication,
      version: "2026.1.0",
      executablePath: hostExecutablePath(adapter),
      executableSha256: sha256(readFileSync(hostExecutablePath(adapter))),
      verificationMode: adapter.verificationMode,
      hostState: adapter.hostState ?? "loaded"
    },
    packageOutput: packageOutputLink(adapter),
    loadedHost: {
      commandIdsVisible: adapter.commandIds,
      commandResults: adapter.commandIds.map((commandId) => ({
        commandId,
        status: commandId.includes("show") ? "visible" : "proof-blocked"
      })),
      localServiceRequestsBlocked: true
    },
    manualProof: manualProofLink(adapter),
    releaseClaims: {
      loadedHostVerified: true
    }
  };

  return adapter.host === "davinci-resolve"
    ? {
        ...baseReceipt,
        davinciResolve: {
          loadedResolveVerified: true,
          scriptLanguage: "python",
          scriptLoadedInResolve: true,
          mutatesResolveProject: false,
          readOnlyProjectMetadataVerified: false,
          workflowIntegrationVerified: false
        }
      }
    : {
        ...baseReceipt,
        adobeUxp: {
          uxpDeveloperToolPath: "G:/fake/uxp-developer-tool.exe",
          developerToolVerified: true,
          pluginLoaded: true,
          panelRendered: true,
          uxpManifestId: adapter.uxpManifestId,
          entrypointsVisible: adapter.entrypoints
        }
      };
}

function packageOutputLink(adapter: (typeof adapters)[number]) {
  const receiptPath = absoluteWorkspacePath(`.dx/receipts/extensions/${adapter.adapterId}/package-output-latest.json`);
  const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));

  return {
    receiptPath,
    receiptSha256: sha256(readFileSync(receiptPath)),
    packageSha256: receipt.package.sha256
  };
}

function manualProofLink(adapter: (typeof adapters)[number]) {
  const proofFilePath = absoluteWorkspacePath(`proof/${adapter.host}.txt`);

  return {
    proofFilePath,
    proofFileSha256: sha256(readFileSync(proofFilePath))
  };
}

function hostExecutionRequirement(report: ReturnType<typeof writeReleaseEvidenceGapReport>, adapterId: string) {
  const extension = report.extensions.find((entry) => entry.id === adapterId);
  assert.ok(extension, `${adapterId} must appear in report`);

  const requirement = extension.evidenceRequirements.find((entry) => entry.kind === "host_execution");
  assert.ok(requirement, `${adapterId} must include host_execution requirement`);

  return requirement;
}

function writeWorkspaceFile(relativePath: string, source: string): void {
  const absolutePath = absoluteWorkspacePath(relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);
}

function writePackageOutputReceipt(adapter: (typeof adapters)[number]): void {
  const packageRoot = join(workspaceRoot, ...dirname(adapter.manifestPath).split("\\").join("/").split("/"));
  const packageFile = readPackageFileProof(packageRoot, "dx.extension.toml");

  writeJsonFile(`.dx/receipts/extensions/${adapter.adapterId}/package-output-latest.json`, {
    receipt:
      adapter.host === "davinci-resolve"
        ? "dx.extension.davinci_resolve.package_output"
        : "dx.extension.adobe_uxp.package_output",
    adapterId: adapter.adapterId,
    host: adapter.host,
    package: {
      root: packageRoot,
      format: adapter.host === "davinci-resolve" ? "davinci-resolve-script-package" : "adobe-uxp-plugin",
      fileCount: 1,
      sha256: hashPackageFiles([packageFile]),
      files: [packageFile]
    },
    releaseClaims: {
      loadedHostVerified: false,
      localServiceVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      distributionVerified: false
    }
  });
}

function writeManualProofFile(adapter: (typeof adapters)[number]): void {
  writeWorkspaceFile(`proof/${adapter.host}.txt`, `${adapter.adapterId} loaded-host manual proof\n`);
}

function writeHostExecutable(adapter: (typeof adapters)[number]): void {
  writeWorkspaceFile(`tools/${adapter.host}.exe`, `${adapter.hostApplication} executable\n`);
}

function hostExecutablePath(adapter: (typeof adapters)[number]): string {
  return absoluteWorkspacePath(`tools/${adapter.host}.exe`);
}

function writeJsonFile(relativePath: string, value: unknown): void {
  writeWorkspaceFile(relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readPackageFileProof(packageRoot: string, relativePath: string) {
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

function absoluteWorkspacePath(relativePath: string): string {
  return join(workspaceRoot, ...relativePath.split("/"));
}

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}
