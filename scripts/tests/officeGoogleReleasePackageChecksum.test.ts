import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";

import {
  buildOfficeGoogleReleasePackages,
  officeGoogleReleasePackageTargets
} from "../build-office-google-release-packages.ts";
import { hashSourceInputs, readSourceInputProofs } from "../lib/source-input-proof.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-office-google-release-packages-"));
const repositoryRoot = join(import.meta.dirname, "..", "..");
const proofPath = join(workspaceRoot, ".tmp", "proofs", "office-google-release-package-checksums.json");
const artifactRoot = join(workspaceRoot, ".tmp", "release-packages");

try {
  const packageHashes = new Map<string, string>();

  for (const target of officeGoogleReleasePackageTargets) {
    packageHashes.set(target.adapterId, writePackageOutputFixture(target.adapterId, target.host));
  }

  const result = buildOfficeGoogleReleasePackages(workspaceRoot, {
    artifactRoot,
    proofPath
  });

  assert.equal(result.proofPath, proofPath);
  assert.equal(existsSync(proofPath), true);
  assert.equal(result.proofs.length, 4);
  assert.deepEqual(JSON.parse(readFileSync(proofPath, "utf8")), result.proofs);

  for (const target of officeGoogleReleasePackageTargets) {
    const proof = result.proofs.find((candidate) => candidate.adapterId === target.adapterId);
    assert.ok(proof, `missing proof for ${target.adapterId}`);
    assert.equal(proof.host, target.host);
    assert.equal(proof.releaseArtifactKind, "zip");
    assert.equal(proof.artifactCreatedFromPackageOutput, true);
    assert.equal(proof.packageOutputSha256, packageHashes.get(target.adapterId));
    assert.equal(isAbsolute(proof.packageOutputReceiptPath), true);
    assert.equal(isAbsolute(proof.releaseArtifactPath), true);
    assert.equal(proof.releaseArtifactPath, join(artifactRoot, `${target.artifactName}.zip`));

    const artifactBytes = readFileSync(proof.releaseArtifactPath);
    assert.equal(proof.releaseArtifactSha256, sha256(artifactBytes));
    assert.equal(artifactBytes.subarray(0, 4).toString("binary"), "PK\u0003\u0004");
    assert.notEqual(artifactBytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])), -1);
    assert.notEqual(artifactBytes.indexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])), -1);
  }

  const wrapperSource = readFileSync(
    join(repositoryRoot, "scripts", "package-office-google-release-checksum-j1.ps1"),
    "utf8"
  );
  assert.match(wrapperSource, /Set-DxSerialBuildEnvironment/);
  assert.match(wrapperSource, /Assert-NoCompetingHeavyProcess/);
  assert.match(wrapperSource, /DX_RELEASE_PACKAGE_CHECKSUM_PROOF_JSON/);
  assert.match(wrapperSource, /build-office-google-release-packages\.ts/);
  assert.match(wrapperSource, /smoke:release-package-checksum:j1/);
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("Office and Google release package checksum workflow verified");

function writePackageOutputFixture(adapterId: string, host: string): string {
  const packageRoot = join(workspaceRoot, "package-output", adapterId);
  const files = [
    writePackageFile(packageRoot, "manifest.xml", `<manifest adapter="${adapterId}" />\n`),
    writePackageFile(packageRoot, "assets/command-center.txt", `${host} command center\n`)
  ];
  const packageOutputSha256 = hashPackageFiles(files);
  const sourceProof = writeSourceInputProof(adapterId);

  writeWorkspaceFile(
    `.dx/receipts/extensions/${adapterId}/package-output-latest.json`,
    JSON.stringify(
      {
        receipt: "fixture.package_output",
        adapterId,
        host,
        package: {
          root: packageRoot,
          fileCount: files.length,
          sha256: packageOutputSha256,
          files
        },
        ...sourceProof,
        releaseClaims: {
          loadedHostVerified: false,
          signingVerified: false,
          distributionVerified: false,
          releaseChecksumVerified: false
        }
      },
      null,
      2
    )
  );

  return packageOutputSha256;
}

function writeSourceInputProof(adapterId: string): {
  sourceRoot: string;
  sourceInputs: ReturnType<typeof readSourceInputProofs>;
  sourceSha256: string;
} {
  if (adapterId === "dx.google-workspace.command-center") {
    const sourceRoot = join(workspaceRoot, "hosts", "google-workspace", "dx-google-workspace-addon");
    const paths = [
      "appsscript.json",
      "src/cards.ts",
      "src/commandPlans.ts",
      "src/entrypoints.ts",
      "src/localServiceBoundary.ts",
      "src/messages.ts"
    ];

    writePackageFile(sourceRoot, "appsscript.json", "{\"runtimeVersion\":\"V8\"}\n");
    writePackageFile(sourceRoot, "src/cards.ts", "export const cards = [];\n");
    writePackageFile(sourceRoot, "src/commandPlans.ts", "export const commandPlans = [];\n");
    writePackageFile(sourceRoot, "src/entrypoints.ts", "export const entrypoints = [];\n");
    writePackageFile(sourceRoot, "src/localServiceBoundary.ts", "export const boundary = {};\n");
    writePackageFile(sourceRoot, "src/messages.ts", "export const messages = {};\n");

    const sourceInputs = readSourceInputProofs(sourceRoot, paths);

    return {
      sourceRoot,
      sourceInputs,
      sourceSha256: hashSourceInputs(sourceInputs)
    };
  }

  const officeFolderByAdapterId = new Map([
    ["dx.excel.command-center", "dx-excel"],
    ["dx.powerpoint.command-center", "dx-powerpoint"],
    ["dx.word.command-center", "dx-word"]
  ]);
  const folder = officeFolderByAdapterId.get(adapterId);
  assert.ok(folder, `missing Office source fixture folder for ${adapterId}`);

  const sourceRoot = join(workspaceRoot, "hosts", "office");
  const paths = [
    `${folder}/manifest.xml`,
    `${folder}/src/commandPlans.ts`,
    `${folder}/src/messages.ts`,
    `${folder}/src/taskpane.ts`,
    `${folder}/static/taskpane.html`,
    "shared/localServiceBoundary.ts"
  ];

  writePackageFile(sourceRoot, `${folder}/manifest.xml`, `<manifest adapter="${adapterId}" />\n`);
  writePackageFile(sourceRoot, `${folder}/src/commandPlans.ts`, "export const commandPlans = [];\n");
  writePackageFile(sourceRoot, `${folder}/src/messages.ts`, "export const messages = {};\n");
  writePackageFile(sourceRoot, `${folder}/src/taskpane.ts`, "export const taskpane = true;\n");
  writePackageFile(sourceRoot, `${folder}/static/taskpane.html`, "<main>DX</main>\n");
  writePackageFile(sourceRoot, "shared/localServiceBoundary.ts", "export const localServiceBoundary = {};\n");

  const sourceInputs = readSourceInputProofs(sourceRoot, paths);

  return {
    sourceRoot,
    sourceInputs,
    sourceSha256: hashSourceInputs(sourceInputs)
  };
}

function writePackageFile(packageRoot: string, relativePath: string, source: string) {
  const targetPath = join(packageRoot, ...relativePath.split("/"));
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, source);
  const bytes = readFileSync(targetPath);

  return {
    relativePath,
    bytes: bytes.length,
    sha256: sha256(bytes)
  };
}

function writeWorkspaceFile(relativePath: string, source: string): string {
  const targetPath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, source);

  return targetPath;
}

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
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
