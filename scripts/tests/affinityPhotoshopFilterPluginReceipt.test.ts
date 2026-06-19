import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { writeAffinityContentPackageReceipt } from "../write-affinity-content-package-receipt.ts";
import { writeAffinityLoadedAppReceipt } from "../write-affinity-loaded-app-receipt.ts";
import { writeAffinityManualImportReceipt } from "../write-affinity-manual-import-receipt.ts";
import { writeAffinityPhotoshopFilterPluginReceipt } from "../write-affinity-photoshop-filter-plugin-receipt.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-affinity-photoshop-filter-plugin-"));

try {
  const fixture = writeFixture();
  const receipt = writeAffinityPhotoshopFilterPluginReceipt(workspaceRoot, {
    generatedAt: "2026-06-08T00:00:00.000Z",
    verificationCommand: "npm run smoke:affinity-photoshop-filter-plugin:j1",
    proof: filterPluginProof(fixture)
  });

  assert.equal(receipt.receipt, "dx.extension.affinity_content.photoshop_filter_plugin");
  assert.equal(receipt.adapterId, "dx.affinity-content.bridge");
  assert.equal(receipt.host, "affinity");
  assert.equal(receipt.generatedAt, "2026-06-08T00:00:00.000Z");
  assert.equal(receipt.verificationCommand, "npm run smoke:affinity-photoshop-filter-plugin:j1");
  assert.equal(receipt.receiptPath.endsWith("photoshop-filter-plugin-latest.json"), true);
  assert.equal(receipt.loadedAppReceiptPath, fixture.loadedAppReceiptPath);
  assert.equal(receipt.loadedAppReceiptSha256, sha256(readFileSync(fixture.loadedAppReceiptPath)));
  assert.equal(receipt.manualProof.proofFilePath, fixture.filterProofFilePath);
  assert.equal(receipt.manualProof.proofFileSha256, sha256(readFileSync(fixture.filterProofFilePath)));
  assert.deepEqual(receipt.filterPlugin, {
    kind: "photoshop-compatible-64-bit-filter",
    artifactPath: fixture.filterPluginArtifactPath,
    fileName: "dx-affinity-metadata-filter.8bf",
    bytes: readFileSync(fixture.filterPluginArtifactPath).length,
    sha256: sha256(readFileSync(fixture.filterPluginArtifactPath)),
    loadedByAffinityPhoto: true,
    metadataOnly: true,
    storesAffinityPayloads: false,
    mutatesAffinityDocument: false
  });
  assert.deepEqual(receipt.releaseClaims, {
    loadedAffinityAppVerified: true,
    photoshopFilterPluginVerified: true
  });
  assert.equal(existsSync(receipt.receiptPath), true);
  assert.deepEqual(JSON.parse(readFileSync(receipt.receiptPath, "utf8")), receipt);

  assert.throws(
    () =>
      writeAffinityPhotoshopFilterPluginReceipt(workspaceRoot, {
        proof: {
          ...filterPluginProof(fixture),
          loadedByAffinityPhoto: false
        }
      }),
    /must verify the Photoshop-compatible filter is loaded by Affinity Photo/
  );
  assert.throws(
    () =>
      writeAffinityPhotoshopFilterPluginReceipt(workspaceRoot, {
        proof: {
          ...filterPluginProof(fixture),
          filterPluginArtifactPath: writeWorkspaceFile("plugins/dx-affinity-metadata-filter.txt", "filter\n")
        }
      }),
    /artifact must be a Photoshop-compatible .8bf filter plugin/
  );
  assert.throws(
    () =>
      writeAffinityPhotoshopFilterPluginReceipt(workspaceRoot, {
        proof: {
          ...filterPluginProof(fixture),
          documentName: "Private Affinity document"
        } as Parameters<typeof writeAffinityPhotoshopFilterPluginReceipt>[1]["proof"]
      }),
    /privacy-sensitive Affinity filter plugin proof field: documentName/
  );
  assert.throws(
    () =>
      writeAffinityPhotoshopFilterPluginReceipt(workspaceRoot, {
        proof: {
          ...filterPluginProof(fixture),
          loadedAppReceiptPath: writeWeakLoadedAppReceipt()
        }
      }),
    /must link to a loaded Affinity Photo app receipt/
  );

  const wrapperSource = readFileSync(
    join(import.meta.dirname, "..", "smoke-affinity-photoshop-filter-plugin-j1.ps1"),
    "utf8"
  );
  assert.match(wrapperSource, /Set-DxSerialBuildEnvironment/);
  assert.match(wrapperSource, /DX_AFFINITY_PHOTOSHOP_FILTER_PLUGIN_PROOF_JSON/);
  assert.match(wrapperSource, /test:affinity-photoshop-filter-plugin-receipt/);
  assert.match(wrapperSource, /write-affinity-photoshop-filter-plugin-receipt\.ts/);
  assert.match(wrapperSource, /check:generated-output-ignore/);
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("Affinity Photoshop-compatible filter plugin receipt verified");

interface Fixture {
  filterPluginArtifactPath: string;
  filterProofFilePath: string;
  loadedAppReceiptPath: string;
}

function writeFixture(): Fixture {
  const packageRoot = join(workspaceRoot, "content-package");
  writeWorkspaceFile(
    "content-package/affinity-content-manifest.json",
    JSON.stringify(
      {
        name: "DX Affinity Content Bridge",
        supportedHosts: ["Affinity Photo 2"],
        supportedContentTypes: [{ type: "assets", extensions: [".afassets"] }]
      },
      null,
      2
    )
  );
  writeWorkspaceFile("content-package/assets/dx-icons.afassets", "affinity asset bytes\n");
  const contentPackage = writeAffinityContentPackageReceipt({
    packageRoot,
    receiptPath: join(workspaceRoot, ".dx", "receipts", "extensions", "dx.affinity-content.bridge", "content-package-latest.json"),
    generatedAt: "2026-06-08T00:00:00.000Z",
    verificationCommand: "npm run package:affinity-content:j1"
  });
  const manualProofFilePath = writeWorkspaceFile(
    "proof/manual-import.txt",
    "Imported DX Affinity assets into the Affinity Photo Assets panel.\n"
  );
  const manualImport = writeAffinityManualImportReceipt(workspaceRoot, {
    generatedAt: "2026-06-08T00:00:00.000Z",
    verificationCommand: "npm run smoke:affinity-manual-import:j1",
    proof: {
      affinityHost: "Affinity Photo 2",
      hostVersion: "2.6.0",
      contentPackageReceiptPath: contentPackage.receiptPath,
      proofFilePath: manualProofFilePath,
      importedContentTypes: ["assets"],
      importedArtifactPaths: ["assets/dx-icons.afassets"],
      importSurfaces: ["Assets panel"],
      operator: "essencefromexistence",
      notes: ["Manual import only; no Affinity automation was used."]
    }
  });
  const hostExecutablePath = writeWorkspaceFile("host/Affinity Photo 2.exe", "Affinity Photo executable fixture\n");
  const loadedAppProofFilePath = writeWorkspaceFile(
    "proof/loaded-app.txt",
    "Verified imported DX Affinity content is visible inside Affinity Photo.\n"
  );
  const loadedApp = writeAffinityLoadedAppReceipt(workspaceRoot, {
    generatedAt: "2026-06-08T00:00:00.000Z",
    verificationCommand: "npm run smoke:affinity-loaded-app:j1",
    proof: {
      affinityHost: "Affinity Photo 2",
      hostVersion: "2.6.0",
      hostExecutablePath,
      contentPackageReceiptPath: contentPackage.receiptPath,
      manualImportReceiptPath: manualImport.receiptPath,
      proofFilePath: loadedAppProofFilePath,
      loadedAppVerified: true,
      contentPackageLoaded: true,
      manualImportVisible: true,
      importedContentTypes: ["assets"],
      importedArtifactPaths: ["assets/dx-icons.afassets"],
      importSurfaces: ["Assets panel"],
      mutatesAffinityDocument: false,
      storesAffinityPayloads: false
    }
  });

  return {
    filterPluginArtifactPath: writeWorkspaceFile(
      "plugins/dx-affinity-metadata-filter.8bf",
      "DX Affinity Photoshop-compatible filter fixture\n"
    ),
    filterProofFilePath: writeWorkspaceFile(
      "proof/photoshop-filter-plugin.txt",
      "Loaded the DX Affinity Photoshop-compatible filter plugin in Affinity Photo 2.\n"
    ),
    loadedAppReceiptPath: loadedApp.receiptPath
  };
}

function filterPluginProof(
  fixture: Fixture
): Parameters<typeof writeAffinityPhotoshopFilterPluginReceipt>[1]["proof"] {
  return {
    loadedAppReceiptPath: fixture.loadedAppReceiptPath,
    proofFilePath: fixture.filterProofFilePath,
    filterPluginArtifactPath: fixture.filterPluginArtifactPath,
    loadedByAffinityPhoto: true,
    metadataOnly: true,
    mutatesAffinityDocument: false,
    storesAffinityPayloads: false
  };
}

function writeWeakLoadedAppReceipt(): string {
  return writeWorkspaceFile(
    ".dx/receipts/extensions/dx.affinity-content.bridge/weak-loaded-app.json",
    JSON.stringify(
      {
        receipt: "dx.extension.affinity_content.loaded_app",
        adapterId: "dx.affinity-content.bridge",
        host: "affinity",
        hostApplication: {
          name: "Affinity Designer",
          version: "2.6.0"
        },
        releaseClaims: {
          loadedAffinityAppVerified: true
        }
      },
      null,
      2
    )
  );
}

function writeWorkspaceFile(relativePath: string, source: string): string {
  const absolutePath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);

  return absolutePath;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
