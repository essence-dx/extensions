import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { writeAffinityContentPackageReceipt } from "../write-affinity-content-package-receipt.ts";
import { writeAffinityLoadedAppReceipt } from "../write-affinity-loaded-app-receipt.ts";
import { writeAffinityManualImportReceipt } from "../write-affinity-manual-import-receipt.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-affinity-loaded-app-"));

try {
  const fixture = writeFixture();
  const receipt = writeAffinityLoadedAppReceipt(workspaceRoot, {
    generatedAt: "2026-06-08T00:00:00.000Z",
    verificationCommand: "npm run smoke:affinity-loaded-app:j1",
    proof: loadedAppProof(fixture)
  });

  assert.equal(receipt.receipt, "dx.extension.affinity_content.loaded_app");
  assert.equal(receipt.adapterId, "dx.affinity-content.bridge");
  assert.equal(receipt.host, "affinity");
  assert.equal(receipt.generatedAt, "2026-06-08T00:00:00.000Z");
  assert.equal(receipt.verificationCommand, "npm run smoke:affinity-loaded-app:j1");
  assert.equal(receipt.receiptPath.endsWith("loaded-app-latest.json"), true);
  assert.equal(receipt.hostApplication.name, "Affinity Photo");
  assert.equal(receipt.hostApplication.version, "2.6.0");
  assert.equal(receipt.hostApplication.executablePath, fixture.hostExecutablePath);
  assert.equal(receipt.hostApplication.executableSha256, sha256(readFileSync(fixture.hostExecutablePath)));
  assert.equal(receipt.hostApplication.loadedAppState, "loaded");
  assert.equal(receipt.contentPackage.receiptPath, fixture.contentPackageReceiptPath);
  assert.equal(receipt.contentPackage.receiptSha256, sha256(readFileSync(fixture.contentPackageReceiptPath)));
  assert.equal(receipt.contentPackage.packageSha256, fixture.contentPackageSha256);
  assert.equal(receipt.manualImport.receiptPath, fixture.manualImportReceiptPath);
  assert.equal(receipt.manualImport.receiptSha256, sha256(readFileSync(fixture.manualImportReceiptPath)));
  assert.equal(receipt.manualProof.proofFilePath, fixture.loadedAppProofFilePath);
  assert.equal(receipt.manualProof.proofFileSha256, sha256(readFileSync(fixture.loadedAppProofFilePath)));
  assert.deepEqual(receipt.loadedApp.importedContentTypes, ["assets"]);
  assert.deepEqual(receipt.loadedApp.importedArtifactPaths, ["assets/dx-icons.afassets"]);
  assert.deepEqual(receipt.loadedApp.importSurfaces, ["Assets panel"]);
  assert.equal(receipt.loadedApp.contentPackageLoaded, true);
  assert.equal(receipt.loadedApp.manualImportVisible, true);
  assert.equal(receipt.loadedApp.mutatesAffinityDocument, false);
  assert.equal(receipt.loadedApp.storesAffinityPayloads, false);
  assert.deepEqual(receipt.releaseClaims, {
    contentPackageVerified: true,
    manualImportVerified: true,
    loadedAffinityAppVerified: true,
    nativeSdkPluginVerified: false,
    photoshopFilterPluginVerified: false,
    signingVerified: false,
    releaseChecksumVerified: false,
    distributionVerified: false
  });
  assert.equal(existsSync(receipt.receiptPath), true);
  assert.deepEqual(JSON.parse(readFileSync(receipt.receiptPath, "utf8")), receipt);

  assert.throws(
    () =>
      writeAffinityLoadedAppReceipt(workspaceRoot, {
        proof: {
          ...loadedAppProof(fixture),
          loadedAppVerified: false
        }
      }),
    /must verify a real loaded Affinity app/
  );
  assert.throws(
    () =>
      writeAffinityLoadedAppReceipt(workspaceRoot, {
        proof: {
          ...loadedAppProof(fixture),
          importSurfaces: ["Swatches panel"]
        }
      }),
    /loaded-app proof must match the manual import receipt/
  );
  assert.throws(
    () =>
      writeAffinityLoadedAppReceipt(workspaceRoot, {
        proof: {
          ...loadedAppProof(fixture),
          documentName: "Private client file"
        } as Parameters<typeof writeAffinityLoadedAppReceipt>[1]["proof"]
      }),
    /privacy-sensitive Affinity loaded-app proof field: documentName/
  );
  assert.throws(
    () =>
      writeAffinityLoadedAppReceipt(workspaceRoot, {
        proof: {
          ...loadedAppProof(fixture),
          hostExecutablePath: join(workspaceRoot, "missing-affinity.exe")
        }
      }),
    /host executable does not exist/
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("Affinity loaded app receipt verified");

interface Fixture {
  contentPackageReceiptPath: string;
  contentPackageSha256: string;
  hostExecutablePath: string;
  loadedAppProofFilePath: string;
  manualImportReceiptPath: string;
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

  return {
    contentPackageReceiptPath: contentPackage.receiptPath,
    contentPackageSha256: contentPackage.package.sha256,
    hostExecutablePath: writeWorkspaceFile("host/Affinity Photo 2.exe", "Affinity Photo executable fixture\n"),
    loadedAppProofFilePath: writeWorkspaceFile(
      "proof/loaded-app.txt",
      "Verified imported DX Affinity content is visible inside Affinity Photo.\n"
    ),
    manualImportReceiptPath: manualImport.receiptPath
  };
}

function loadedAppProof(fixture: Fixture): Parameters<typeof writeAffinityLoadedAppReceipt>[1]["proof"] {
  return {
    affinityHost: "Affinity Photo 2",
    hostVersion: "2.6.0",
    hostExecutablePath: fixture.hostExecutablePath,
    contentPackageReceiptPath: fixture.contentPackageReceiptPath,
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
  };
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
