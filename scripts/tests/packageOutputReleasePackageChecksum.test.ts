import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";

import {
  buildPackageOutputReleasePackages,
  packageOutputReleasePackageTargets
} from "../build-package-output-release-packages.ts";
import {
  browserPackageSourceInputs,
  hashSourceInputs,
  readSourceInputProofs,
  vsCodePackageSourceInputs,
  zedPackageSourceInputs
} from "../lib/source-input-proof.ts";
import { writeGzipTarball } from "../lib/gzip-tarball-writer.ts";
import { writeStoredZip } from "../lib/stored-zip-writer.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-package-output-release-packages-"));
const repositoryRoot = join(import.meta.dirname, "..", "..");
const proofPath = join(workspaceRoot, ".tmp", "proofs", "package-output-release-package-checksums.json");
const artifactRoot = join(workspaceRoot, ".tmp", "release-packages", "package-output");
const browserBrandedIconSource = "<svg><title>DX</title></svg>\n";
const browserBrandedIconReferences = [
  "action.default_icon.128",
  "action.default_icon.16",
  "action.default_icon.48",
  "icons.128",
  "icons.16",
  "icons.48"
];
const excludedAdapterIds = new Set([
  "dx.affinity-content.bridge",
  "dx.excel.command-center",
  "dx.google-workspace.command-center",
  "dx.powerpoint.command-center",
  "dx.word.command-center"
]);
const receiptTypesByAdapterId = new Map(
  [
    ["dx.blender.command-center", "dx.extension.blender.package_output"],
    ["dx.browser.command-center", "dx.extension.browser.package_output"],
    ["dx.canva.command-center", "dx.extension.figma_canva.package_output"],
    ["dx.davinci-resolve.command-center", "dx.extension.davinci_resolve.package_output"],
    ["dx.figma.command-center", "dx.extension.figma_canva.package_output"],
    ["dx.indesign.command-center", "dx.extension.adobe_uxp.package_output"],
    ["dx.intellij-platform.command-center", "dx.extension.intellij_platform.package_output"],
    ["dx.obsidian.command-center", "dx.extension.obsidian.package_output"],
    ["dx.photoshop.command-center", "dx.extension.adobe_uxp.package_output"],
    ["dx.premiere-pro.command-center", "dx.extension.adobe_uxp.package_output"],
    ["dx.sketch.command-center", "dx.extension.sketch.package_output"],
    ["dx.unity-editor.command-center", "dx.extension.unity_editor.package_output"],
    ["dx.unreal-engine.command-center", "dx.extension.unreal_engine.package_output"],
    ["dx.visual-studio.command-center", "dx.extension.visual_studio.package_output"],
    ["dx.vscode.command-center", "dx.extension.vscode.package_output"],
    ["dx.zed.command-center", "dx.extension.zed.package_output"]
  ] as const
);

try {
  const packageHashes = new Map<string, string>();
  const packageFileCounts = new Map<string, number>();

  assert.equal(packageOutputReleasePackageTargets.length, 16);
  assert.equal(
    packageOutputReleasePackageTargets.some((target) => target.adapterId === "dx.browser.command-center"),
    true
  );
  assert.equal(
    packageOutputReleasePackageTargets.some((target) => target.adapterId === "dx.zed.command-center"),
    true
  );
  assert.equal(
    packageOutputReleasePackageTargets.some((target) => excludedAdapterIds.has(target.adapterId)),
    false
  );

  for (const target of packageOutputReleasePackageTargets) {
    const fixture = writePackageOutputFixture(target.adapterId, target.host);
    packageHashes.set(target.adapterId, fixture.sha256);
    packageFileCounts.set(target.adapterId, fixture.fileCount);
  }

  const result = buildPackageOutputReleasePackages(workspaceRoot, {
    artifactRoot,
    proofPath
  });

  assert.equal(result.proofPath, proofPath);
  assert.equal(existsSync(proofPath), true);
  assert.equal(result.proofs.length, packageOutputReleasePackageTargets.length);
  assert.deepEqual(JSON.parse(readFileSync(proofPath, "utf8")), result.proofs);

  for (const target of packageOutputReleasePackageTargets) {
    const proof = result.proofs.find((candidate) => candidate.adapterId === target.adapterId);
    assert.ok(proof, `missing proof for ${target.adapterId}`);
    assert.equal(proof.host, target.host);
    assert.equal(proof.releaseArtifactKind, "zip");
    assert.equal(proof.artifactCreatedFromPackageOutput, true);
    assert.equal(proof.packageOutputSha256, packageHashes.get(target.adapterId));
    assert.equal(isAbsolute(proof.packageOutputReceiptPath), true);
    assert.equal(isAbsolute(proof.releaseArtifactPath), true);
    assert.equal(proof.releaseArtifactPath, join(artifactRoot, `${target.artifactName}.zip`));

    const artifact = result.artifacts.find((candidate) => candidate.adapterId === target.adapterId);
    assert.ok(artifact, `missing artifact for ${target.adapterId}`);
    assert.equal(artifact.entries, packageFileCounts.get(target.adapterId));
    assert.equal(artifact.path, proof.releaseArtifactPath);

    const artifactBytes = readFileSync(proof.releaseArtifactPath);
    assert.equal(proof.releaseArtifactSha256, sha256(artifactBytes));
    assert.equal(artifactBytes.subarray(0, 4).toString("binary"), "PK\u0003\u0004");
    assert.notEqual(artifactBytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])), -1);
    assert.notEqual(artifactBytes.indexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])), -1);
  }

  const browserOnlyProofPath = join(workspaceRoot, ".tmp", "proofs", "browser-release-package-checksum.json");
  const browserOnlyArtifactRoot = join(workspaceRoot, ".tmp", "release-packages", "browser");
  const browserOnlyResult = buildPackageOutputReleasePackages(workspaceRoot, {
    artifactRoot: browserOnlyArtifactRoot,
    proofPath: browserOnlyProofPath,
    adapterIds: ["dx.browser.command-center"]
  });

  assert.deepEqual(
    browserOnlyResult.proofs.map((proof) => proof.adapterId),
    ["dx.browser.command-center"]
  );
  assert.deepEqual(
    browserOnlyResult.artifacts.map((artifact) => artifact.adapterId),
    ["dx.browser.command-center"]
  );
  assert.equal(
    browserOnlyResult.proofs[0]?.releaseArtifactPath,
    join(browserOnlyArtifactRoot, "dx-browser-command-center.zip")
  );
  assert.deepEqual(JSON.parse(readFileSync(browserOnlyProofPath, "utf8")), browserOnlyResult.proofs);

  assert.throws(
    () =>
      buildPackageOutputReleasePackages(workspaceRoot, {
        artifactRoot,
        proofPath,
        adapterIds: ["dx.unknown.command-center"]
      }),
    /target is not configured/
  );

  const weakIntellijWorkspaceRoot = mkdtempSync(join(tmpdir(), "dx-weak-intellij-package-output-"));
  try {
    writePackageOutputFixture(
      "dx.intellij-platform.command-center",
      "intellij-platform",
      weakIntellijWorkspaceRoot,
      { includeReleaseArtifactProof: false }
    );
    assert.throws(
      () =>
        buildPackageOutputReleasePackages(weakIntellijWorkspaceRoot, {
          adapterIds: ["dx.intellij-platform.command-center"]
        }),
      /Gradle plugin ZIP proof/
    );
  } finally {
    rmSync(weakIntellijWorkspaceRoot, { recursive: true, force: true });
  }

  const weakVisualStudioWorkspaceRoot = mkdtempSync(join(tmpdir(), "dx-weak-visual-studio-package-output-"));
  try {
    writePackageOutputFixture(
      "dx.visual-studio.command-center",
      "visual-studio",
      weakVisualStudioWorkspaceRoot,
      { includeReleaseArtifactProof: false }
    );
    assert.throws(
      () =>
        buildPackageOutputReleasePackages(weakVisualStudioWorkspaceRoot, {
          adapterIds: ["dx.visual-studio.command-center"]
        }),
      /VSIX package proof/
    );
  } finally {
    rmSync(weakVisualStudioWorkspaceRoot, { recursive: true, force: true });
  }

  const wrapperSource = readFileSync(
    join(repositoryRoot, "scripts", "package-package-output-release-checksum-j1.ps1"),
    "utf8"
  );
  assert.match(wrapperSource, /param\(/);
  assert.match(wrapperSource, /\$AdapterId/);
  assert.match(wrapperSource, /--adapter-id/);
  assert.match(wrapperSource, /Set-DxSerialBuildEnvironment/);
  assert.match(wrapperSource, /Assert-NoCompetingHeavyProcess/);
  assert.match(wrapperSource, /DX_RELEASE_PACKAGE_CHECKSUM_PROOF_JSON/);
  assert.match(wrapperSource, /build-package-output-release-packages\.ts/);
  assert.match(wrapperSource, /smoke:release-package-checksum:j1/);
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("Package-output release package checksum workflow verified");

function writePackageOutputFixture(
  adapterId: string,
  host: string,
  targetWorkspaceRoot = workspaceRoot,
  options: { includeReleaseArtifactProof?: boolean } = {}
): { sha256: string; fileCount: number } {
  const packageRoot = join(targetWorkspaceRoot, "package-output", adapterId);
  const files = [
    writePackageFile(packageRoot, "manifest.json", JSON.stringify({ adapterId, host }, null, 2)),
    writePackageFile(packageRoot, "assets/command-center.txt", `${host} command center\n`)
  ];

  if (adapterId === "dx.browser.command-center") {
    files.push(
      writePackageFile(packageRoot, "chromium/static/dx.svg", browserBrandedIconSource),
      writePackageFile(packageRoot, "edge/static/dx.svg", browserBrandedIconSource),
      writePackageFile(packageRoot, "firefox/static/dx.svg", browserBrandedIconSource)
    );
  }

  const packageOutputSha256 = hashPackageFiles(files);
  const receiptType = receiptTypesByAdapterId.get(adapterId);
  const sourceProof = writeSourceInputProof(adapterId, targetWorkspaceRoot);

  assert.ok(receiptType, `missing package-output fixture receipt type for ${adapterId}`);

  writeWorkspaceFile(
    `.dx/receipts/extensions/${adapterId}/package-output-latest.json`,
    JSON.stringify(
      {
        receipt: receiptType,
        adapterId,
        host,
        package: {
          root: packageRoot,
          fileCount: files.length,
          sha256: packageOutputSha256,
          files
        },
        ...(sourceProof ?? {}),
        ...releaseArtifactProof(adapterId, targetWorkspaceRoot, packageRoot, files, options),
        releaseClaims: {
          loadedHostVerified: false,
          signingVerified: false,
          distributionVerified: false,
          releaseChecksumVerified: false
        }
      },
      null,
      2
    ),
    targetWorkspaceRoot
  );

  return {
    sha256: packageOutputSha256,
    fileCount: files.length
  };
}

function writeSourceInputProof(adapterId: string, targetWorkspaceRoot: string): {
  sourceRoot: string;
  sourceInputs: ReturnType<typeof readSourceInputProofs>;
  sourceSha256: string;
} | undefined {
  const sourceInputsByAdapterId = new Map<string, Record<string, string>>([
    [
      "dx.blender.command-center",
      {
        "__init__.py": "blender add-on\n",
        "blender_manifest.toml": "id = \"dx_blender_command_center\"\n"
      }
    ],
    [
      "dx.browser.command-center",
      Object.fromEntries(
        browserPackageSourceInputs.map((relativePath) => [
          relativePath,
          `browser source for ${relativePath}\n`
        ])
      )
    ],
    [
      "dx.canva.command-center",
      {
        "canva-app.json": "{\"name\":\"DX Canva\"}\n",
        "src/app.tsx": "export const CanvaApp = () => null;\n",
        "src/commandPlans.ts": "export const commandPlans = [];\n",
        "src/messages.ts": "export const messages = {};\n"
      }
    ],
    [
      "dx.figma.command-center",
      {
        "manifest.json": "{\"name\":\"DX Figma\"}\n",
        "src/commandPlans.ts": "export const commandPlans = [];\n",
        "src/main.ts": "export const figmaMain = true;\n",
        "src/messages.ts": "export const messages = {};\n",
        "ui.html": "<main>DX</main>\n"
      }
    ],
    [
      "dx.vscode.command-center",
      Object.fromEntries(
        vsCodePackageSourceInputs.map((relativePath) => [
          relativePath,
          `VS Code source for ${relativePath}\n`
        ])
      )
    ],
    [
      "dx.zed.command-center",
      Object.fromEntries(
        zedPackageSourceInputs.map((relativePath) => [
          relativePath,
          `Zed source for ${relativePath}\n`
        ])
      )
    ],
    [
      "dx.obsidian.command-center",
      {
        "manifest.json": "{\"id\":\"dx-command-center\"}\n",
        "src/dxCommandRunner.ts": "export const runDxCommand = () => undefined;\n",
        "src/main.ts": "export const obsidianMain = true;\n"
      }
    ],
    [
      "dx.sketch.command-center",
      {
        "manifest.json": "{\"name\":\"DX Sketch\"}\n",
        "src/commandPlans.ts": "export const commandPlans = [];\n",
        "src/index.ts": "export const sketchMain = true;\n",
        "src/messages.ts": "export const messages = {};\n"
      }
    ]
  ]);
  const sourceFiles = sourceInputsByAdapterId.get(adapterId);

  if (!sourceFiles) {
    return undefined;
  }

  const sourceRoot = join(targetWorkspaceRoot, "source-inputs", adapterId);
  const relativePaths = Object.keys(sourceFiles).sort();

  for (const [relativePath, source] of Object.entries(sourceFiles)) {
    writePackageFile(sourceRoot, relativePath, source);
  }

  const sourceInputs = readSourceInputProofs(sourceRoot, relativePaths);

  return {
    sourceRoot,
    sourceInputs,
    sourceSha256: hashSourceInputs(sourceInputs)
  };
}

function releaseArtifactProof(
  adapterId: string,
  targetWorkspaceRoot: string,
  packageRoot: string,
  files: Array<{ relativePath: string; bytes: number; sha256: string }>,
  options: { includeReleaseArtifactProof?: boolean }
): Record<string, unknown> {
  if (adapterId === "dx.browser.command-center") {
    return {
      targets: ["chromium", "edge", "firefox"].map((targetName) => ({
        name: targetName,
        brandedIcon: {
          relativePath: `${targetName}/static/dx.svg`,
          sha256: sha256(browserBrandedIconSource),
          manifestReferences: browserBrandedIconReferences
        }
      }))
    };
  }

  if (options.includeReleaseArtifactProof === false) {
    return {};
  }

  if (adapterId === "dx.intellij-platform.command-center") {
    return {
      gradlePluginPackage: writeArchiveFixture(
        targetWorkspaceRoot,
        "artifacts/dx-intellij-platform-0.1.0.zip",
        packageRoot,
        files,
        "zip",
        "zipHeaderVerified"
      )
    };
  }

  if (adapterId === "dx.visual-studio.command-center") {
    return {
      vsix: writeArchiveFixture(
        targetWorkspaceRoot,
        "artifacts/dx-visual-studio-0.1.0.vsix",
        packageRoot,
        files,
        "zip",
        "zipHeaderVerified"
      )
    };
  }

  if (adapterId === "dx.vscode.command-center") {
    return {
      vsix: writeArchiveFixture(
        targetWorkspaceRoot,
        "artifacts/dx-vscode-0.1.0.vsix",
        packageRoot,
        files,
        "zip",
        "zipHeaderVerified"
      )
    };
  }

  if (adapterId === "dx.unity-editor.command-center") {
    return {
      upmTarball: writeArchiveFixture(
        targetWorkspaceRoot,
        "artifacts/dev.dx.unity-command-center-0.1.0.tgz",
        packageRoot,
        files,
        "gzip-tarball",
        "gzipHeaderVerified"
      )
    };
  }

  if (adapterId === "dx.unreal-engine.command-center") {
    return {
      packagedPlugin: writeArchiveFixture(
        targetWorkspaceRoot,
        "artifacts/DXUnrealCommandCenter-0.1.0.zip",
        packageRoot,
        files,
        "zip",
        "zipHeaderVerified"
      )
    };
  }

  return {};
}

function writeArchiveFixture(
  targetWorkspaceRoot: string,
  relativePath: string,
  packageRoot: string,
  files: Array<{ relativePath: string; bytes: number; sha256: string }>,
  format: "zip" | "gzip-tarball",
  verifiedFlag: string
): Record<string, unknown> {
  const artifactPath = join(targetWorkspaceRoot, ...relativePath.split("/"));
  const entries = files.map((file) => ({
    relativePath: file.relativePath,
    sourcePath: join(packageRoot, ...file.relativePath.split("/"))
  }));
  const archive = format === "zip"
    ? writeStoredZip(artifactPath, entries)
    : writeGzipTarball(artifactPath, entries);

  return {
    path: archive.path,
    fileName: relativePath.split("/").at(-1),
    bytes: archive.bytes,
    sha256: archive.sha256,
    [verifiedFlag]: true
  };
}

function writePackageFile(
  packageRoot: string,
  relativePath: string,
  source: string
): { relativePath: string; bytes: number; sha256: string } {
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

function writeWorkspaceFile(relativePath: string, source: string, targetWorkspaceRoot = workspaceRoot): string {
  const targetPath = join(targetWorkspaceRoot, ...relativePath.split("/"));
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
