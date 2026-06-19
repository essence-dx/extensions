import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { writeAffinityLoadedAppReceipt } from "../write-affinity-loaded-app-receipt.ts";
import { writeAffinityPhotoshopFilterPluginReceipt } from "../write-affinity-photoshop-filter-plugin-receipt.ts";
import { writeReleaseEvidenceGapReport } from "../write-release-evidence-gap-report.ts";
import { hashSourceInputs, readSourceInputProofs } from "../lib/source-input-proof.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-release-gaps-affinity-content-"));
const adapterId = "dx.affinity-content.bridge";
const contentPackageReceiptPath = `.dx/receipts/extensions/${adapterId}/content-package-latest.json`;

try {
  const fixture = writeFixture();
  const looseReport = writeReport();

  assert.equal(requirementByKind(looseReport, "package_output").releaseValid, true);
  assert.equal(requirementByKind(looseReport, "content_package").releaseValid, true);
  assert.equal(requirementByKind(looseReport, "manual_import").releaseValid, true);
  assert.equal(requirementByKind(looseReport, "host_execution").releaseValid, false);
  assert.match(
    requirementByKind(looseReport, "host_execution").weakness ?? "",
    /Affinity loaded-app receipt is missing loaded-app proof/
  );

  const loadedAppReceiptPath = writeLoadedAppReceipt(fixture, { includeLoadedAppProof: true });
  const baseReport = writeReport();

  assert.equal(requirementByKind(baseReport, "host_execution").releaseValid, true);
  assert.equal(requirementByKind(baseReport, "photoshop_filter_plugin").releaseValid, false);
  assert.equal(requirementByKind(baseReport, "photoshop_filter_plugin").exists, false);

  writePhotoshopFilterPluginReceipt(fixture, loadedAppReceiptPath);
  const filterReport = writeReport();

  assert.equal(requirementByKind(filterReport, "photoshop_filter_plugin").releaseValid, true);

  writeFileSync(
    fixture.filterPluginArtifactPath,
    fixture.filterPluginArtifactSource.replace("fixture", "payload")
  );
  const changedFilterReport = writeReport();

  assert.equal(requirementByKind(changedFilterReport, "photoshop_filter_plugin").releaseValid, false);
  assert.match(
    requirementByKind(changedFilterReport, "photoshop_filter_plugin").weakness ?? "",
    /Affinity filter plugin artifact file hash changed/
  );

  writeFileSync(fixture.filterPluginArtifactPath, fixture.filterPluginArtifactSource);
  writeFileSync(fixture.hostExecutablePath, "changed Affinity executable\n");
  const changedExecutableReport = writeReport();

  assert.equal(requirementByKind(changedExecutableReport, "host_execution").releaseValid, false);
  assert.match(
    requirementByKind(changedExecutableReport, "host_execution").weakness ?? "",
    /Affinity loaded-app host executable file hash changed/
  );

  writeFileSync(fixture.hostExecutablePath, fixture.hostExecutableSource);
  writeFileSync(fixture.artifactPath, "changed affinity assets\n");
  const changedReport = writeReport();

  assert.equal(requirementByKind(changedReport, "content_package").releaseValid, false);
  assert.match(
    requirementByKind(changedReport, "content_package").weakness ?? "",
    /package output file hash changed/
  );
  assert.equal(requirementByKind(changedReport, "manual_import").releaseValid, false);
  assert.match(
    requirementByKind(changedReport, "manual_import").weakness ?? "",
    /Affinity manual-import content-package/
  );
  assert.equal(requirementByKind(changedReport, "host_execution").releaseValid, false);
  assert.match(
    requirementByKind(changedReport, "host_execution").weakness ?? "",
    /Affinity loaded-app content-package/
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("Affinity content-package release evidence freshness verified");

interface AffinityFixture {
  artifactPath: string;
  contentPackageReceiptAbsolutePath: string;
  filterPluginArtifactPath: string;
  filterPluginArtifactSource: string;
  filterProofFilePath: string;
  hostExecutablePath: string;
  hostExecutableSource: string;
  loadedAppProofFilePath: string;
  manualImportReceiptPath: string;
  packageSha256: string;
}

function writeFixture(): AffinityFixture {
  writeWorkspaceFile(
    "registry/official-extensions.toml",
    `
schema = "dx.extensions.registry"
manifest_version = 1

[[extensions]]
id = "${adapterId}"
name = "DX Affinity Content Bridge"
path = "hosts/affinity/dx-affinity-content"
manifest = "hosts/affinity/dx-affinity-content/dx.extension.toml"
status = "experimental"
professional_targets = ["affinity.photo", "affinity.designer", "affinity.publisher"]
`
  );
  writeWorkspaceFile("hosts/affinity/dx-affinity-content/dx.extension.toml", `[extension]\nid = "${adapterId}"\n`);
  writeWorkspaceFile(
    "registry/release-evidence-gates.toml",
    `
schema = "dx.release_evidence_gates"
manifest_version = 1

[[extensions]]
id = "${adapterId}"
stage = "not-release-ready"
required_evidence = ["host_execution", "package_output", "signing", "checksum", "distribution_review", "manual_import", "content_package", "photoshop_filter_plugin"]
evidence_receipt_requirements = ["host_execution=.dx/receipts/extensions/${adapterId}/loaded-app-latest.json", "manual_import=.dx/receipts/extensions/${adapterId}/manual-import-latest.json", "photoshop_filter_plugin=.dx/receipts/extensions/${adapterId}/photoshop-filter-plugin-latest.json", "package_output=${contentPackageReceiptPath}", "content_package=${contentPackageReceiptPath}", "signing=.dx/receipts/extensions/${adapterId}/signing-latest.json", "checksum=.dx/receipts/extensions/${adapterId}/checksum-latest.json", "distribution_review=.dx/receipts/extensions/${adapterId}/distribution-latest.json"]
evidence_receipts = [".dx/receipts/extensions/${adapterId}/loaded-app-latest.json", ".dx/receipts/extensions/${adapterId}/manual-import-latest.json", ".dx/receipts/extensions/${adapterId}/photoshop-filter-plugin-latest.json", "${contentPackageReceiptPath}", ".dx/receipts/extensions/${adapterId}/signing-latest.json", ".dx/receipts/extensions/${adapterId}/checksum-latest.json", ".dx/receipts/extensions/${adapterId}/distribution-latest.json"]
next_release_proof = "Keep Affinity content package artifacts current."
blocked_by = ["manual import proof", "Photoshop-compatible filter plugin proof", "signing"]
`
  );

  const adapterRoot = join(workspaceRoot, "hosts", "affinity", "dx-affinity-content");
  const sourceInputPaths = ["affinity-content-manifest.json", "src/contentPlans.ts", "src/importGuide.ts"];
  writePackageFile(adapterRoot, "src/contentPlans.ts", "export const contentPlans = [];\n");
  writePackageFile(adapterRoot, "src/importGuide.ts", "export const importGuide = 'Import DX content.';\n");
  const packageRoot = join(workspaceRoot, "content-package");
  const artifactPath = writePackageFile(packageRoot, "assets/dx-icons.afassets", "affinity assets\n");
  const manifestSource = JSON.stringify(
    {
      name: "DX Affinity Content Bridge",
      supportedHosts: ["Affinity Photo 2"],
      supportedContentTypes: [{ type: "assets", extensions: [".afassets"] }]
    },
    null,
    2
  );
  writePackageFile(
    adapterRoot,
    "affinity-content-manifest.json",
    manifestSource
  );
  writePackageFile(packageRoot, "affinity-content-manifest.json", manifestSource);
  const files = ["affinity-content-manifest.json", "assets/dx-icons.afassets"].map((relativePath) =>
    readPackageFileProof(packageRoot, relativePath)
  );
  const artifactProof = files.find((file) => file.relativePath === "assets/dx-icons.afassets");
  assert.ok(artifactProof);

  const packageSha256 = hashPackageFiles(files);
  const sourceInputs = readSourceInputProofs(adapterRoot, sourceInputPaths);
  const contentPackageReceiptAbsolutePath = writeJsonFile(contentPackageReceiptPath, {
    receipt: "dx.extension.affinity_content.content_package",
    adapterId,
    host: "affinity",
    package: {
      root: packageRoot,
      format: "affinity-content-package-layout",
      fileCount: files.length,
      sha256: packageSha256,
      files
    },
    inputs: sourceInputPaths,
    sourceRoot: adapterRoot,
    sourceInputs,
    sourceSha256: hashSourceInputs(sourceInputs),
    supportedHosts: ["Affinity Photo 2"],
    contentTypes: ["assets"],
    contentArtifacts: [
      {
        ...artifactProof,
        contentType: "assets",
        extension: ".afassets"
      }
    ],
    releaseClaims: {
      manualImportVerified: false,
      loadedAffinityAppVerified: false,
      nativeSdkPluginVerified: false,
      photoshopFilterPluginVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      distributionVerified: false
    }
  });
  const manualProofFilePath = writeWorkspaceFile(
    `proof/${adapterId}/manual-import.txt`,
    "Imported DX Affinity assets into Affinity Photo 2.\n"
  );

  const manualImportReceiptPath = writeJsonFile(`.dx/receipts/extensions/${adapterId}/manual-import-latest.json`, {
    receipt: "dx.extension.affinity_content.manual_import",
    adapterId,
    host: "affinity",
    affinityHost: {
      name: "Affinity Photo 2",
      version: "2.5.0"
    },
    contentPackage: {
      receiptPath: contentPackageReceiptAbsolutePath,
      receiptSha256: sha256(readFileSync(contentPackageReceiptAbsolutePath)),
      packageSha256
    },
    manualProof: {
      proofFilePath: manualProofFilePath,
      proofFileSha256: sha256(readFileSync(manualProofFilePath)),
      importedContentTypes: ["assets"],
      importedArtifactPaths: ["assets/dx-icons.afassets"],
      importSurfaces: ["Assets panel"],
      operator: "essencefromexistence"
    },
    releaseClaims: {
      contentPackageVerified: true,
      manualImportVerified: true,
      loadedAffinityAppVerified: false,
      nativeSdkPluginVerified: false,
      photoshopFilterPluginVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      distributionVerified: false
    }
  });

  const loadedAppProofFilePath = writeWorkspaceFile(
    `proof/${adapterId}/loaded-app.txt`,
    "Loaded the DX Affinity content bridge package in Affinity Photo 2.\n"
  );
  const filterProofFilePath = writeWorkspaceFile(
    `proof/${adapterId}/photoshop-filter-plugin.txt`,
    "Loaded the DX Affinity Photoshop-compatible filter plugin in Affinity Photo 2.\n"
  );
  const filterPluginArtifactSource = "DX Affinity Photoshop-compatible filter fixture\n";
  const filterPluginArtifactPath = writeWorkspaceFile(
    "plugins/dx-affinity-metadata-filter.8bf",
    filterPluginArtifactSource
  );
  const hostExecutableSource = "Affinity Photo executable fixture\n";
  const hostExecutablePath = writeWorkspaceFile("host/Affinity Photo 2.exe", hostExecutableSource);
  const fixture = {
    artifactPath,
    contentPackageReceiptAbsolutePath,
    filterPluginArtifactPath,
    filterPluginArtifactSource,
    filterProofFilePath,
    hostExecutablePath,
    hostExecutableSource,
    loadedAppProofFilePath,
    manualImportReceiptPath,
    packageSha256
  };

  writeLoadedAppReceipt(fixture, { includeLoadedAppProof: false });

  return fixture;
}

function writeLoadedAppReceipt(
  fixture: AffinityFixture,
  options: { includeLoadedAppProof: boolean }
): string {
  if (options.includeLoadedAppProof) {
    return writeAffinityLoadedAppReceipt(workspaceRoot, {
      generatedAt: "2026-06-08T00:00:00.000Z",
      verificationCommand: "npm run smoke:affinity-loaded-app:j1",
      proof: {
        affinityHost: "Affinity Photo 2",
        hostVersion: "2.5.0",
        hostExecutablePath: fixture.hostExecutablePath,
        contentPackageReceiptPath: fixture.contentPackageReceiptAbsolutePath,
        manualImportReceiptPath: fixture.manualImportReceiptPath,
        proofFilePath: fixture.loadedAppProofFilePath,
        loadedAppVerified: true,
        contentPackageLoaded: true,
        manualImportVisible: true,
        importedContentTypes: ["assets"],
        importedArtifactPaths: ["assets/dx-icons.afassets"],
        importSurfaces: ["Assets panel"],
        mutatesAffinityDocument: false,
        storesAffinityPayloads: false
      }
    }).receiptPath;
  }

  const receiptPath = `.dx/receipts/extensions/${adapterId}/loaded-app-latest.json`;
  writeJsonFile(`.dx/receipts/extensions/${adapterId}/loaded-app-latest.json`, {
    receipt: "dx.extension.affinity_content.loaded_app",
    adapterId,
    host: "affinity",
    generatedAt: "2026-06-08T00:00:00.000Z",
    verificationCommand: "npm run smoke:affinity-loaded-app:j1",
    receiptPath: join(workspaceRoot, ...receiptPath.split("/")),
    hostApplication: {
      name: "Affinity Photo",
      version: "2.5.0",
      executablePath: fixture.hostExecutablePath,
      executableSha256: sha256(readFileSync(fixture.hostExecutablePath)),
      loadedAppState: "loaded"
    },
    contentPackage: {
      receiptPath: fixture.contentPackageReceiptAbsolutePath,
      receiptSha256: sha256(readFileSync(fixture.contentPackageReceiptAbsolutePath)),
      packageSha256: fixture.packageSha256
    },
    manualImport: {
      receiptPath: fixture.manualImportReceiptPath,
      receiptSha256: sha256(readFileSync(fixture.manualImportReceiptPath))
    },
    manualProof: {
      proofFilePath: fixture.loadedAppProofFilePath,
      proofFileSha256: sha256(readFileSync(fixture.loadedAppProofFilePath))
    },
    ...(options.includeLoadedAppProof
      ? {
          loadedApp: {
            contentPackageLoaded: true,
            manualImportVisible: true,
            importedContentTypes: ["assets"],
            importedArtifactPaths: ["assets/dx-icons.afassets"],
            importSurfaces: ["Assets panel"],
            mutatesAffinityDocument: false,
            storesAffinityPayloads: false
          }
        }
      : {}),
    releaseClaims: {
      contentPackageVerified: true,
      manualImportVerified: true,
      loadedAffinityAppVerified: true,
      nativeSdkPluginVerified: false,
      photoshopFilterPluginVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      distributionVerified: false
    }
  });

  return join(workspaceRoot, ...receiptPath.split("/"));
}

function writePhotoshopFilterPluginReceipt(
  fixture: AffinityFixture,
  loadedAppReceiptPath: string
): string {
  const receipt = writeAffinityPhotoshopFilterPluginReceipt(workspaceRoot, {
    generatedAt: "2026-06-08T00:00:00.000Z",
    verificationCommand: "npm run smoke:affinity-photoshop-filter-plugin:j1",
    proof: {
      loadedAppReceiptPath,
      proofFilePath: fixture.filterProofFilePath,
      filterPluginArtifactPath: fixture.filterPluginArtifactPath,
      loadedByAffinityPhoto: true,
      metadataOnly: true,
      mutatesAffinityDocument: false,
      storesAffinityPayloads: false
    }
  });

  return receipt.receiptPath;
}

function writeReport() {
  return writeReleaseEvidenceGapReport(workspaceRoot, {
    generatedAt: "2026-06-08T00:00:00.000Z",
    verificationCommand: "npm run report:release-evidence-gaps:j1"
  });
}

function requirementByKind(
  report: ReturnType<typeof writeReleaseEvidenceGapReport>,
  kind: string
) {
  const extension = report.extensions.find((entry) => entry.id === adapterId);
  assert.ok(extension, "Affinity gap entry must exist");

  const requirement = extension.evidenceRequirements.find((entry) => entry.kind === kind);
  assert.ok(requirement, `Affinity must include ${kind} requirement`);

  return requirement;
}

function writeJsonFile(relativePath: string, value: unknown): string {
  return writeWorkspaceFile(relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeWorkspaceFile(relativePath: string, source: string): string {
  const absolutePath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);

  return absolutePath;
}

function writePackageFile(packageRoot: string, relativePath: string, source: string): string {
  const absolutePath = join(packageRoot, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);

  return absolutePath;
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

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}
