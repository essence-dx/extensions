import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { writeAffinityManualImportReceipt } from "../write-affinity-manual-import-receipt.ts";
import { hashSourceInputs, readSourceInputProofs } from "../lib/source-input-proof.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-affinity-manual-import-"));

try {
  const sourceRoot = join(workspaceRoot, "hosts", "affinity", "dx-affinity-content");
  const sourceInputPaths = ["affinity-content-manifest.json", "src/contentPlans.ts", "src/importGuide.ts"];
  writePackageFile(sourceRoot, "affinity-content-manifest.json", "{}\n");
  writePackageFile(sourceRoot, "src/contentPlans.ts", "export const contentPlans = [];\n");
  writePackageFile(sourceRoot, "src/importGuide.ts", "export const importGuide = 'Import DX content.';\n");
  const packageRoot = join(workspaceRoot, "content-package");
  writePackageFile(packageRoot, "assets/dx-icons.afassets", "affinity asset bytes\n");
  writePackageFile(packageRoot, "affinity-content-manifest.json", "{}\n");
  const packageFiles = ["affinity-content-manifest.json", "assets/dx-icons.afassets"].map((relativePath) =>
    readPackageFileProof(packageRoot, relativePath)
  );
  const packageSha256 = hashPackageFiles(packageFiles);
  const sourceInputs = readSourceInputProofs(sourceRoot, sourceInputPaths);
  const contentArtifact = packageFiles.find((file) => file.relativePath === "assets/dx-icons.afassets");
  assert.ok(contentArtifact);

  const contentPackageReceiptPath = writeWorkspaceFile(
    ".dx/receipts/extensions/dx.affinity-content.bridge/content-package-latest.json",
    JSON.stringify(
      {
        receipt: "dx.extension.affinity_content.content_package",
        adapterId: "dx.affinity-content.bridge",
        host: "affinity",
        package: {
          root: packageRoot,
          format: "affinity-content-package-layout",
          fileCount: packageFiles.length,
          sha256: packageSha256,
          files: packageFiles
        },
        inputs: sourceInputPaths,
        sourceRoot,
        sourceInputs,
        sourceSha256: hashSourceInputs(sourceInputs),
        supportedHosts: ["Affinity Photo 2"],
        contentTypes: ["assets"],
        contentArtifacts: [
          {
            ...contentArtifact,
            relativePath: "assets/dx-icons.afassets",
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
      },
      null,
      2
    )
  );
  const proofFilePath = writeWorkspaceFile(
    "manual-proof/affinity-photo-import-note.txt",
    "Imported DX asset package into Affinity Photo 2 Assets panel.\n"
  );
  const receipt = writeAffinityManualImportReceipt(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run smoke:affinity-manual-import:j1",
    proof: {
      affinityHost: "Affinity Photo 2",
      hostVersion: "2.6.0",
      contentPackageReceiptPath,
      proofFilePath,
      importedContentTypes: ["assets"],
      importedArtifactPaths: ["assets/dx-icons.afassets"],
      importSurfaces: ["Assets panel"],
      operator: "essencefromexistence",
      notes: ["Manual import only; no Affinity automation was used."]
    }
  });

  assert.equal(receipt.receipt, "dx.extension.affinity_content.manual_import");
  assert.equal(receipt.adapterId, "dx.affinity-content.bridge");
  assert.equal(receipt.host, "affinity");
  assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
  assert.equal(receipt.verificationCommand, "npm run smoke:affinity-manual-import:j1");
  assert.equal(receipt.receiptPath.endsWith("manual-import-latest.json"), true);
  assert.equal(receipt.affinityHost.name, "Affinity Photo 2");
  assert.equal(receipt.affinityHost.version, "2.6.0");
  assert.equal(receipt.contentPackage.receiptPath, contentPackageReceiptPath);
  assert.equal(
    receipt.contentPackage.receiptSha256,
    createHash("sha256").update(readFileSync(contentPackageReceiptPath)).digest("hex")
  );
  assert.equal(receipt.contentPackage.packageSha256, packageSha256);
  assert.equal(receipt.manualProof.proofFilePath, proofFilePath);
  assert.equal(
    receipt.manualProof.proofFileSha256,
    createHash("sha256").update(readFileSync(proofFilePath)).digest("hex")
  );
  assert.deepEqual(receipt.manualProof.importedContentTypes, ["assets"]);
  assert.deepEqual(receipt.manualProof.importedArtifactPaths, ["assets/dx-icons.afassets"]);
  assert.deepEqual(receipt.manualProof.importSurfaces, ["Assets panel"]);
  assert.equal(receipt.manualProof.operator, "essencefromexistence");
  assert.deepEqual(receipt.releaseClaims, {
    contentPackageVerified: true,
    manualImportVerified: true,
    loadedAffinityAppVerified: false,
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
      writeAffinityManualImportReceipt(workspaceRoot, {
        proof: {
          ...manualImportFixture(contentPackageReceiptPath, proofFilePath),
          importedArtifactPaths: []
        }
      }),
    /manual import proof must list at least one imported artifact/
  );
  assert.throws(
    () =>
      writeAffinityManualImportReceipt(workspaceRoot, {
        proof: {
          ...manualImportFixture(contentPackageReceiptPath, proofFilePath),
          proofFilePath: join(workspaceRoot, "missing-proof.txt")
        }
      }),
    /manual proof file does not exist/
  );
  assert.throws(
    () =>
      writeAffinityManualImportReceipt(workspaceRoot, {
        proof: {
          ...manualImportFixture(contentPackageReceiptPath, proofFilePath),
          importedArtifactPaths: ["fonts/missing-font.affont"]
        }
      }),
    /imported artifact is not present in the content package receipt/
  );
  assert.throws(
    () =>
      writeAffinityManualImportReceipt(workspaceRoot, {
        proof: {
          ...manualImportFixture(contentPackageReceiptPath, proofFilePath),
          importedContentTypes: ["fonts"]
        }
      }),
    /imported content type is not present in the content package receipt/
  );
  assert.throws(
    () =>
      writeAffinityManualImportReceipt(workspaceRoot, {
        proof: {
          ...manualImportFixture(writeWrongReceiptType(), proofFilePath)
        }
      }),
    /must link to an Affinity content-package receipt/
  );
  assert.throws(
    () =>
      writeAffinityManualImportReceipt(workspaceRoot, {
        proof: {
          ...manualImportFixture(contentPackageReceiptPath, writeWorkspaceFile("manual-proof/empty.txt", ""))
        }
      }),
    /manual proof file must not be empty/
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("Affinity manual import receipt verified");

function manualImportFixture(
  contentPackageReceiptPath: string,
  proofFilePath: string
): Parameters<typeof writeAffinityManualImportReceipt>[1]["proof"] {
  return {
    affinityHost: "Affinity Designer 2",
    hostVersion: "2.6.0",
    contentPackageReceiptPath,
    proofFilePath,
    importedContentTypes: ["assets"],
    importedArtifactPaths: ["assets/dx-icons.afassets"],
    importSurfaces: ["Assets panel"],
    operator: "essencefromexistence",
    notes: []
  };
}

function writeWorkspaceFile(relativePath: string, source: string): string {
  const absolutePath = join(workspaceRoot, relativePath);
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
    sha256: createHash("sha256").update(bytes).digest("hex")
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

function writeWrongReceiptType(): string {
  return writeWorkspaceFile(
    ".dx/receipts/extensions/dx.affinity-content.bridge/wrong-receipt.json",
    JSON.stringify(
      {
        receipt: "dx.extension.affinity_content.manual_import",
        adapterId: "dx.affinity-content.bridge",
        contentArtifacts: [
          {
            relativePath: "assets/dx-icons.afassets",
            contentType: "assets"
          }
        ]
      },
      null,
      2
    )
  );
}
